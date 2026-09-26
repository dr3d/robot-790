import logging
from types import SimpleNamespace

import pytest

from robot_790d.tts_capacity import install_tts_capacity_patch, split_for_capacity


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
        yield text

    def decode(talker_input_embeds, talker_graph, max_new_tokens=4096):
        yield SimpleNamespace(shape=(talker_input_embeds.count, 16)), {}

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
