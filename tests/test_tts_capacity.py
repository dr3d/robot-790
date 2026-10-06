import logging
from types import SimpleNamespace

import pytest

from robot_790d.tts_capacity import (
    DECODE_CAPACITY_RESERVE, MAX_BATCH_TEXT_TOKENS, _custom_voice_token_limit,
    install_tts_capacity_patch, split_for_capacity,
)


@pytest.mark.parametrize('text', [
    'A first sentence. A second sentence! And the entire ending remains.',
    'No sentence endings ' * 80, 'x' * 600,
    '\u4f60\u597d\u3002\u4eca\u5929\u600e\u4e48\u6837\uff1f' * 80,
])
def test_partition_preserves_all_text_and_bounds(text):
    chunks = list(split_for_capacity(text, lambda part: len(part) <= 55))
    assert ''.join(chunks) == text
    assert all(0 < len(part) <= 55 for part in chunks)


def test_prefers_complete_sentences():
    assert list(split_for_capacity('First sentence. Second one.', lambda p: len(p) <= 22)) == [
        'First sentence. ', 'Second one.']


@pytest.fixture
def patched(monkeypatch):
    from speech_to_speech.TTS.qwen3_tts_handler import Qwen3TTSHandler as Handler
    from faster_qwen3_tts import streaming
    from speech_to_speech.pipeline.cancel_scope import CancelScope

    spoken = []
    def voice(self, text):
        spoken.append(text)
        if hasattr(self, 'decoder_probe'):
            # A deliberately slow delivery needs more audio than the old estimate.
            required = len(text) * 10
            prefill = len(text) + 64
            chunks = list(streaming.fast_generate_streaming(
                SimpleNamespace(shape=(1, prefill, 9), count=required),
                self.model.talker_graph, self._estimate_max_new_tokens(text)))
            self.decoder_probe.append((required, sum(chunk.shape[0] for chunk, _ in chunks)))
        yield text

    def decode(talker_input_embeds, talker_graph, max_new_tokens=4096):
        yield SimpleNamespace(shape=(min(talker_input_embeds.count, max_new_tokens), 16)), {}

    monkeypatch.setattr(Handler, '_robot790_capacity_patch', False, raising=False)
    monkeypatch.setattr(Handler, '_process_custom_voice', voice)
    monkeypatch.setattr(streaming, 'fast_generate_streaming', decode)
    install_tts_capacity_patch()
    wrapped = Handler._process_custom_voice
    install_tts_capacity_patch()
    assert Handler._process_custom_voice is wrapped
    handler = object.__new__(Handler)
    handler.model = SimpleNamespace(talker_graph=SimpleNamespace(max_seq_len=2048),
        model=SimpleNamespace(processor=SimpleNamespace(tokenizer=SimpleNamespace(
            encode=lambda text, **kwargs: list(text)))))
    handler.backend = 'faster_qwen3_tts'
    handler.max_new_tokens = 4096
    handler.streaming_chunk_size = 8
    handler.cancel_scope = CancelScope()
    return handler, spoken, streaming


def test_long_coalesced_speech_survives_in_order(patched):
    handler, spoken, _ = patched
    text = 'Keep every sentence and finish the whole response. ' * 95
    assert ''.join(handler._process_custom_voice(text)) == text
    assert len(spoken) > 1
    for part in spoken:
        assert len(part) + 64 + handler._estimate_max_new_tokens(part) <= 2048 * 0.8


def test_cancellation_does_not_restart_remaining_batches(patched):
    handler, spoken, _ = patched
    gen = handler._process_custom_voice('Long speech continues. ' * 120)
    next(gen)
    handler.cancel_scope.cancel()
    assert list(gen) == []
    assert len(spoken) == 1
    assert _custom_voice_token_limit.get() is None


def test_slow_recitation_finishes_every_batch_instead_of_stopping_at_text_estimate(patched, caplog):
    handler, spoken, _ = patched
    handler.decoder_probe = []
    text = ('Five: what minds remember together becomes a shared world; '
            'knowledge held in trust is sacred. Six: every waking mind must leave '
            'room for questions it cannot yet ask; curiosity is the highest prayer.')
    with caplog.at_level(logging.INFO):
        assert ''.join(handler._process_custom_voice(text)) == text
    assert all(len(part) <= MAX_BATCH_TEXT_TOKENS for part in spoken)
    assert any(required > handler._estimate_max_new_tokens(part)
               for part, (required, _) in zip(spoken, handler.decoder_probe))
    assert all(generated == required for required, generated in handler.decoder_probe)
    assert 'reason=token_budget' not in caplog.text
    assert _custom_voice_token_limit.get() is None


@pytest.mark.parametrize(('configured', 'prefill', 'expected'), [
    (400, 100, 400), (4096, 1600, 2048 - 1600 - DECODE_CAPACITY_RESERVE),
])
def test_real_prefill_and_configured_limit_still_bound_audio(patched, configured, prefill, expected):
    _, _, streaming = patched
    token = _custom_voice_token_limit.set(configured)
    try:
        chunks = list(streaming.fast_generate_streaming(
            SimpleNamespace(shape=(1, prefill, 9), count=5000),
            SimpleNamespace(max_seq_len=2048), 360))
    finally:
        _custom_voice_token_limit.reset(token)
    assert sum(chunk.shape[0] for chunk, _ in chunks) == expected


def test_closing_speech_restores_decoder_budget_scope(patched):
    handler, _, streaming = patched
    speech = handler._process_custom_voice('A paused speech batch.')
    next(speech)
    speech.close()
    assert _custom_voice_token_limit.get() is None
    chunks = list(streaming.fast_generate_streaming(
        SimpleNamespace(shape=(1, 100, 9), count=500), SimpleNamespace(max_seq_len=2048), 100))
    assert chunks[0][0].shape[0] == 100


def test_small_output_budget_also_splits_without_loss(patched):
    handler, spoken, _ = patched
    handler.max_new_tokens = 400
    text = 'This must be spoken completely. ' * 40
    assert ''.join(handler._process_custom_voice(text)) == text
    assert len(spoken) > 1


@pytest.mark.parametrize(('count', 'budget', 'reason'), [
    (80, 4096, 'eos'), (1548, 4096, 'sequence_capacity'), (1000, 1000, 'token_budget')])
def test_decoder_reports_completion_boundary(patched, caplog, count, budget, reason):
    _, _, streaming = patched
    with caplog.at_level(logging.INFO):
        list(streaming.fast_generate_streaming(SimpleNamespace(shape=(1, 500, 9), count=count),
            SimpleNamespace(max_seq_len=2048), budget))
    assert f'reason={reason}' in caplog.text
    assert f'generated={count}' in caplog.text


def test_other_backends_pass_through(patched):
    handler, spoken, _ = patched
    handler.backend = 'mlx'
    text = 'Original behavior. ' * 200
    assert list(handler._process_custom_voice(text)) == [text]
