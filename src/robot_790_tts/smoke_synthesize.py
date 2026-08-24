"""Generate one Qwen3-TTS WAV file through the local server backend."""

import asyncio
import argparse
from pathlib import Path

from robot_790_tts.server import DEFAULT_MODEL, QwenTtsBackend


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a local Qwen3-TTS smoke-test WAV.")
    parser.add_argument("--voice", required=True, help="Qwen3-TTS CustomVoice speaker, such as Aiden or Eric.")
    parser.add_argument("--text", required=True, help="Text to synthesize.")
    parser.add_argument("--output", required=True, type=Path, help="Output WAV path.")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Qwen3-TTS model id or local model directory.")
    parser.add_argument("--language", default="English", help="Synthesis language.")
    parser.add_argument("--instruct", default="", help="Optional speaking style instruction.")
    return parser.parse_args()


async def _run() -> None:
    args = _parse_args()
    backend = QwenTtsBackend()
    wav_bytes, sample_rate = await backend.synthesize(
        args.text,
        voice=args.voice,
        language=args.language,
        instruct=args.instruct,
        model=args.model,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(wav_bytes)
    print(f"Wrote {args.output} at {sample_rate} Hz")


def main() -> None:
    """Run the smoke synthesis command."""
    asyncio.run(_run())


if __name__ == "__main__":
    main()
