import wave
from io import BytesIO

import numpy as np
from fastapi.testclient import TestClient

from robot_790_tts.server import QwenTtsBackend, QwenTtsSettings, create_app, _array_to_wav_bytes


def test_array_to_wav_bytes_writes_valid_wav() -> None:
    """WAV conversion produces a readable mono 16-bit file."""
    wav_bytes = _array_to_wav_bytes(np.array([0.0, 0.5, -0.5], dtype=np.float32), 16000)

    with wave.open(BytesIO(wav_bytes), "rb") as wav_file:
        assert wav_file.getframerate() == 16000
        assert wav_file.getnchannels() == 1
        assert wav_file.getsampwidth() == 2
        assert wav_file.getnframes() == 3


def test_speech_endpoint_returns_wav_in_mock_mode() -> None:
    """The mock speech endpoint returns WAV bytes."""
    backend = QwenTtsBackend(QwenTtsSettings(mock=True))
    client = TestClient(create_app(backend))

    response = client.post(
        "/v1/audio/speech",
        json={
            "model": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
            "input": "Hello from Robot 790.",
            "voice": "Aiden",
            "response_format": "wav",
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    with wave.open(BytesIO(response.content), "rb") as wav_file:
        assert wav_file.getframerate() == 16000
        assert wav_file.getnframes() > 0


def test_speech_endpoint_rejects_unknown_voice() -> None:
    """Unknown Qwen voice names return a caller error."""
    backend = QwenTtsBackend(QwenTtsSettings(mock=True))
    client = TestClient(create_app(backend))

    response = client.post(
        "/v1/audio/speech",
        json={
            "input": "Hello from Robot 790.",
            "voice": "NotARealVoice",
            "response_format": "wav",
        },
    )

    assert response.status_code == 400
    assert "Unsupported Qwen3-TTS voice" in response.json()["detail"]


def test_health_and_voice_catalog() -> None:
    """Health and voice catalog endpoints expose server metadata."""
    backend = QwenTtsBackend(QwenTtsSettings(mock=True, voice="Eric"))
    client = TestClient(create_app(backend))

    health = client.get("/health").json()
    voices = client.get("/v1/voices").json()

    assert health["status"] == "ok"
    assert health["mock"] is True
    assert voices["default"] == "Eric"
    assert "Aiden" in voices["voices"]
