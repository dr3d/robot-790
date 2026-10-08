"""Continuous-room listening regression: no GPU or live conversation required."""
from contextlib import contextmanager
from threading import Event
from types import SimpleNamespace

import numpy as np
import pytest

from robot_790d.bounded_stt import BoundedTurnTranscriber, DecodeDeferred, apply_bounded_stt_patch


class Recognizer:
    # Each second encodes a word, so we can prove no lost/repeated content.
    def __init__(self, rate=20):
        self.rate = rate
        self.calls = []

    def decode(self, audio):
        self.calls.append(len(audio) / self.rate)
        words = []
        i = 0
        while i < len(audio):
            j = i + 1
            while j < len(audio) and audio[j] == audio[i]:
                j += 1
            words.append({'word': f'w{int(audio[i])}', 'start': i / self.rate, 'end': j / self.rate})
            i = j
        return SimpleNamespace(text=' '.join(w['word'] for w in words), timestamp={'word': words})


def speech(seconds, rate=20):
    return np.repeat(np.arange(seconds, dtype=np.float32), rate)


def test_thirty_minutes_600_revisions_keep_every_word_without_punctuation_or_growing_decode():
    model = Recognizer()
    engine = BoundedTurnTranscriber(model.rate)
    audio = speech(1800)
    for seconds in range(3, 1801, 3):
        text = engine.transcribe(audio[:seconds * model.rate], 'room', model.decode)
        assert text.split() == [f'w{i}' for i in range(seconds)]
    assert max(model.calls) <= 15
    assert sum(model.calls) < 5 * 1800  # linear decoding, not the entire history per revision
    before = len(model.calls)
    assert engine.transcribe(audio, 'room', model.decode) == text  # final reuses exact partial
    assert len(model.calls) == before
    assert all(not isinstance(v, np.ndarray) for p in engine.pieces for v in vars(p).values())


def test_cold_backlog_is_chunked_even_without_any_progressive_updates():
    model = Recognizer()
    text = BoundedTurnTranscriber(model.rate).transcribe(speech(1309), 'room', model.decode)
    assert text.split() == [f'w{i}' for i in range(1309)]
    assert max(model.calls) <= 15
    assert sum(model.calls) < 1500


def test_actual_audio_edits_shrink_and_new_turn_cannot_reuse_wrong_text():
    model = Recognizer()
    engine = BoundedTurnTranscriber(model.rate)
    audio = speech(50)
    engine.transcribe(audio, 'a', model.decode)
    audio[:20] = 999
    text = engine.transcribe(audio, 'a', model.decode)
    assert text.split() == ['w999'] + [f'w{i}' for i in range(1, 50)]
    assert engine.transcribe(audio[:100], 'a', model.decode).split() == ['w999', 'w1', 'w2', 'w3', 'w4']
    assert engine.transcribe(speech(3), 'b', model.decode) == 'w0 w1 w2'
    assert engine.transcribe(np.array([]), 'b', model.decode) == ''


def test_cancel_during_backlog_stops_before_the_next_decode():
    model = Recognizer()
    engine = BoundedTurnTranscriber(model.rate)
    with pytest.raises(DecodeDeferred):
        engine.transcribe(speech(300), 'room', model.decode, current=lambda: not model.calls)
    assert len(model.calls) == 1
    assert model.calls[0] <= 15


def test_missing_timestamps_falls_back_without_dropping_or_duplicating_text():
    model = Recognizer()
    def decode(audio):
        result = model.decode(audio)
        result.timestamp = {}
        return result
    text = BoundedTurnTranscriber(model.rate).transcribe(speech(90), 'room', decode)
    assert text.split() == [f'w{i}' for i in range(90)]
    assert max(model.calls) <= 15


def test_genuine_repeated_words_are_not_deduplicated_as_generic_text_overlap():
    model = Recognizer()
    def decode(audio):
        result = model.decode(audio)
        for word in result.timestamp['word']:
            word['word'] = 'yes'
        result.text = ' '.join('yes' for _ in result.timestamp['word'])
        return result
    text = BoundedTurnTranscriber(model.rate).transcribe(speech(90), 'room', decode)
    assert text.split() == ['yes'] * 90


def test_timestamp_drift_at_a_shared_boundary_uses_matching_audio_overlap():
    from robot_790d.bounded_stt import _overlap_prefix
    assert _overlap_prefix([('person', 13.52), ('asks', 13.8)],
                           [('Person', 13.86), ('asks', 14.18), ('about', 14.46)]) == 2
    assert _overlap_prefix([('yes', 12.5), ('yes', 13.5)],
                           [('yes', 13.75), ('yes', 14.5)]) == 0


@pytest.fixture
def handler(monkeypatch):
    from speech_to_speech.STT.parakeet_tdt_handler import ParakeetTDTSTTHandler as Handler
    # Restore every class mutation after each test.
    monkeypatch.setattr(Handler, 'process', Handler.process)
    monkeypatch.setattr(Handler, 'on_session_end', Handler.on_session_end)
    monkeypatch.setattr(Handler, '_robot790_bounded_stt', False, raising=False)
    apply_bounded_stt_patch()
    patched = Handler.process
    apply_bounded_stt_patch()
    assert Handler.process is patched
    obj = object.__new__(Handler)
    obj.sample_rate = 20
    obj.backend = 'nano_parakeet'
    obj.stop_event = Event()
    obj.enable_live_transcription = True
    obj.start_language = 'en'
    obj.last_language = 'en'
    obj.speculative_turns = None
    obj._clear_live_transcription_line = lambda: None
    obj.latest = True
    obj._is_latest_turn_item = lambda *a, **k: obj.latest
    model = Recognizer()
    obj.model = SimpleNamespace(transcribe=lambda audio, timestamps: model.decode(audio))
    obj.locks = []
    obj.busy = False
    @contextmanager
    def lock(name, timeout):
        obj.locks.append('acquire')
        try:
            yield not obj.busy
        finally:
            obj.locks.append('release')
    obj._compute_lock_context = lock
    return obj, model


def item(seconds=3, revision=0, mode='progressive', turn='room'):
    from speech_to_speech.pipeline.messages import VADAudio
    return VADAudio(audio=speech(seconds), mode=mode, turn_id=turn, turn_revision=revision)


def test_real_handler_revisions_and_final_preserve_text_and_do_not_create_extra_turns(handler):
    from speech_to_speech.pipeline.messages import PartialTranscription, Transcription
    obj, model = handler
    for revision in range(1, 31):
        result = list(obj.process(item(revision * 3, revision)))
        assert len(result) == 1
        assert isinstance(result[0], PartialTranscription)
        assert result[0].turn_revision == revision
        assert result[0].text.split() == [f'w{i}' for i in range(revision * 3)]
    before = len(model.calls)
    final = item(90, 30, 'final')
    output = list(obj.process(final))
    assert len(output) == 1 and isinstance(output[0], Transcription)
    assert output[0].turn_id == 'room' and output[0].turn_revision == 30
    assert output[0].speech_stopped_at_s == final.created_at_s
    assert output[0].text == result[0].text
    assert len(model.calls) == before
    reopened = list(obj.process(item(95, 31, 'final')))[0]
    assert reopened.text.split() == [f'w{i}' for i in range(95)]
    assert max(model.calls) <= 15
    assert obj.locks == ['acquire', 'release'] * len(model.calls)


def test_stale_disconnect_and_busy_inputs_do_not_emit_or_continue_decoding(handler):
    obj, model = handler
    def stale_during_decode(audio, timestamps):
        result = model.decode(audio)
        obj.latest = False
        return result
    obj.model.transcribe = stale_during_decode
    assert list(obj.process(item(180))) == []
    assert len(model.calls) == 1
    assert obj.processing_final is False
    obj.latest = True
    obj.stop_event.set()
    assert list(obj.process(item(180))) == []
    assert len(model.calls) == 1
    obj.stop_event.clear()
    obj.busy = True
    assert list(obj.process(item(180))) == []
    assert len(model.calls) == 1


def test_session_reset_and_final_only_mode(handler):
    obj, model = handler
    obj.enable_live_transcription = False
    assert list(obj.process(item(90))) == []
    assert not model.calls
    assert len(list(obj.process(item(90, mode='final')))) == 1
    obj.on_session_end()
    assert obj._robot790_turn_transcriber is None
    assert list(obj.process(item(2, mode='final')))[0].text == 'w0 w1'


def test_model_failure_cleans_processing_flag_and_retry_keeps_bound(handler):
    obj, model = handler
    def fail(audio, timestamps):
        raise RuntimeError('decoder failure')
    obj.model.transcribe = fail
    with pytest.raises(RuntimeError, match='decoder failure'):
        list(obj.process(item(80, mode='final')))
    assert obj.processing_final is False
    obj.model.transcribe = lambda audio, timestamps: model.decode(audio)
    assert len(list(obj.process(item(80, mode='final')))) == 1
    assert max(model.calls) <= 15
