"""OpenAI-compatible Qwen3-TTS speech endpoint for Robot 790."""

import os
import wave
import asyncio
import logging
import importlib
from io import BytesIO
from typing import Any
from contextlib import asynccontextmanager
from dataclasses import dataclass
from collections.abc import AsyncIterator

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import Field, BaseModel
from fastapi.responses import Response


logger = logging.getLogger("robot_790_tts")

DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8000
DEFAULT_MODEL = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
DEFAULT_LANGUAGE = "English"
DEFAULT_VOICE = "Aiden"
SUPPORTED_VOICES = ("Aiden", "Ryan", "Dylan", "Eric", "Ono_Anna", "Serena", "Sohee", "Uncle_Fu", "Vivian")


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _env_bool(name: str, default: bool) -> bool:
    value = _env(name)
    if not value:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class QwenTtsSettings:
    """Runtime settings for the Qwen3-TTS backend."""

    model_id: str = DEFAULT_MODEL
    language: str = DEFAULT_LANGUAGE
    voice: str = DEFAULT_VOICE
    device_map: str = "cuda:0"
    dtype: str = "bfloat16"
    attn_implementation: str = ""
    warmup: bool = False
    mock: bool = False


def settings_from_env() -> QwenTtsSettings:
    """Read Qwen3-TTS server settings from environment variables."""
    return QwenTtsSettings(
        model_id=_env("QWEN_TTS_MODEL", DEFAULT_MODEL),
        language=_env("QWEN_TTS_LANGUAGE", DEFAULT_LANGUAGE),
        voice=_env("QWEN_TTS_VOICE", DEFAULT_VOICE),
        device_map=_env("QWEN_TTS_DEVICE_MAP", "cuda:0"),
        dtype=_env("QWEN_TTS_DTYPE", "bfloat16"),
        attn_implementation=_env("QWEN_TTS_ATTN_IMPLEMENTATION"),
        warmup=_env_bool("QWEN_TTS_WARMUP", False),
        mock=_env_bool("QWEN_TTS_MOCK", False),
    )


class SpeechRequest(BaseModel):
    """OpenAI-style speech request with Qwen3-TTS extensions."""

    model: str | None = None
    input: str = Field(min_length=1, max_length=4000)
    voice: str | None = None
    response_format: str = "wav"
    language: str | None = None
    instruct: str | None = None


class QwenTtsBackend:
    """Lazy Qwen3-TTS CustomVoice backend."""

    def __init__(self, settings: QwenTtsSettings | None = None) -> None:
        """Initialize the backend without loading model weights yet."""
        self.settings = settings or settings_from_env()
        self._model: Any | None = None
        self._lock = asyncio.Lock()

    @property
    def ready(self) -> bool:
        """Return whether the backend can synthesize without loading first."""
        return self.settings.mock or self._model is not None

    async def warmup(self) -> None:
        """Optionally load the model and run one short synthesis."""
        if self.settings.warmup:
            await self.synthesize("Hello from Qwen three T T S.", voice=self.settings.voice)

    async def synthesize(
        self,
        text: str,
        *,
        voice: str | None = None,
        language: str | None = None,
        instruct: str | None = None,
        model: str | None = None,
    ) -> tuple[bytes, int]:
        """Synthesize speech and return WAV bytes plus sample rate."""
        selected_voice = _normalize_voice(voice or self.settings.voice)
        selected_language = (language or self.settings.language).strip() or DEFAULT_LANGUAGE
        selected_model = (model or self.settings.model_id).strip() or self.settings.model_id
        if self.settings.mock:
            return _mock_tone_wav(text), 16000

        async with self._lock:
            return await asyncio.to_thread(
                self._synthesize_sync,
                text,
                selected_voice,
                selected_language,
                instruct or "",
                selected_model,
            )

    def _synthesize_sync(
        self,
        text: str,
        voice: str,
        language: str,
        instruct: str,
        model_id: str,
    ) -> tuple[bytes, int]:
        model = self._load_model(model_id)
        wavs, sample_rate = model.generate_custom_voice(
            text=text,
            language=language,
            speaker=voice,
            instruct=instruct,
        )
        if not wavs:
            raise RuntimeError("Qwen3-TTS returned no audio.")
        return _array_to_wav_bytes(wavs[0], int(sample_rate)), int(sample_rate)

    def _load_model(self, model_id: str) -> Any:
        if self._model is not None:
            return self._model

        try:
            torch = importlib.import_module("torch")
            qwen_tts = importlib.import_module("qwen_tts")
        except ModuleNotFoundError as exc:
            raise RuntimeError("Install qwen-tts and a CUDA-capable PyTorch environment before real serving.") from exc

        dtype = getattr(torch, self.settings.dtype, torch.bfloat16)
        kwargs: dict[str, object] = {
            "device_map": self.settings.device_map,
            "dtype": dtype,
        }
        if self.settings.attn_implementation:
            kwargs["attn_implementation"] = self.settings.attn_implementation

        logger.info("Loading Qwen3-TTS model %s on %s", model_id, self.settings.device_map)
        self._model = qwen_tts.Qwen3TTSModel.from_pretrained(model_id, **kwargs)
        return self._model


def _normalize_voice(voice: str) -> str:
    voice_by_lowercase = {candidate.lower(): candidate for candidate in SUPPORTED_VOICES}
    normalized = voice_by_lowercase.get(voice.strip().lower())
    if normalized is None:
        raise ValueError(f"Unsupported Qwen3-TTS voice {voice!r}; expected one of {', '.join(SUPPORTED_VOICES)}.")
    return normalized


def _array_to_wav_bytes(samples: Any, sample_rate: int) -> bytes:
    sample_array = np.asarray(samples)
    if sample_array.ndim > 1:
        sample_array = sample_array.reshape(-1)
    if np.issubdtype(sample_array.dtype, np.floating):
        sample_array = np.clip(sample_array, -1.0, 1.0)
        sample_array = (sample_array * 32767.0).astype(np.int16)
    else:
        sample_array = sample_array.astype(np.int16)

    with BytesIO() as buffer:
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(sample_array.tobytes())
        return buffer.getvalue()


def _mock_tone_wav(text: str) -> bytes:
    duration_s = min(max(len(text) / 24.0, 0.25), 1.0)
    sample_rate = 16000
    t = np.linspace(0.0, duration_s, int(sample_rate * duration_s), endpoint=False)
    tone = np.sin(2.0 * np.pi * 440.0 * t) * 0.1
    return _array_to_wav_bytes(tone, sample_rate)


def create_app(backend: QwenTtsBackend | None = None) -> FastAPI:
    """Create the Qwen3-TTS FastAPI app."""
    tts_backend = backend or QwenTtsBackend()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        await tts_backend.warmup()
        yield

    app = FastAPI(title="Robot 790 Qwen3-TTS Server", lifespan=lifespan)

    @app.get("/health")
    async def health() -> dict[str, object]:
        return {
            "status": "ok",
            "backend": "qwen3tts",
            "ready": tts_backend.ready,
            "model": tts_backend.settings.model_id,
            "mock": tts_backend.settings.mock,
            "voices": list(SUPPORTED_VOICES),
        }

    @app.get("/v1/voices")
    async def voices() -> dict[str, object]:
        return {"voices": list(SUPPORTED_VOICES), "default": tts_backend.settings.voice}

    @app.get("/v1/models")
    async def models() -> dict[str, object]:
        return {"data": [{"id": tts_backend.settings.model_id, "object": "model", "owned_by": "qwen"}]}

    @app.post("/v1/audio/speech")
    async def speech(request: SpeechRequest) -> Response:
        response_format = request.response_format.lower().strip()
        if response_format != "wav":
            raise HTTPException(status_code=400, detail="Only response_format='wav' is currently supported.")
        try:
            wav_bytes, _sample_rate = await tts_backend.synthesize(
                request.input,
                voice=request.voice,
                language=request.language,
                instruct=request.instruct,
                model=request.model,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            logger.exception("Qwen3-TTS synthesis failed")
            raise HTTPException(status_code=500, detail=f"Qwen3-TTS synthesis failed: {exc}") from exc

        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={"Content-Disposition": 'attachment; filename="speech.wav"'},
        )

    return app


app = create_app()


def main() -> None:
    """Run the local Qwen3-TTS server."""
    logging.basicConfig(level=getattr(logging, _env("QWEN_TTS_LOG_LEVEL", "INFO").upper(), logging.INFO))
    uvicorn.run(app, host=_env("QWEN_TTS_HOST", DEFAULT_HOST), port=int(_env("QWEN_TTS_PORT", str(DEFAULT_PORT))))


if __name__ == "__main__":
    main()
