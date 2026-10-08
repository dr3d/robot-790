"""Export only the portable STS core, refusing accidental consumer drift."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

FILES = {
    "src/robot_790d/bounded_stt.py": "work/src/robot_790d/bounded_stt.py",
    "tests/test_bounded_stt.py": "work/tests/test_bounded_stt.py",
    "docs/sts-maintenance.md": "docs/sts-maintenance.md",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def synchronize(source, target, apply=False):
    source, target = Path(source).resolve(), Path(target).resolve()
    if source == target or not (target / "work/src/robot_790d/realtime_entry.py").is_file():
        raise ValueError("Target must be the separate Docker repository")
    hook = "    apply_bounded_stt_patch()\n    apply_parakeet_voice_shape_patch()"
    for entry in [source / "src/robot_790d/realtime_entry.py", target / "work/src/robot_790d/realtime_entry.py"]:
        text = entry.read_text(encoding="utf-8")
        if hook not in text or "audio = audio[-15 * sample_rate:]" not in text:
            raise ValueError(f"Missing bounded STT startup/voice-shape integration in {entry}")
    receipt = target / "provenance/shared-sts.json"
    previous = json.loads(receipt.read_text()) if receipt.exists() else {"files": {}}
    outputs = []
    manifest = {"schema": 1, "source": "robot-790", "core": "bounded-stt-v1", "files": {}}
    for name, relative in FILES.items():
        data = (source / name).read_bytes()
        expected = digest(data)
        destination = target / relative
        actual = digest(destination.read_bytes()) if destination.exists() else None
        old = previous["files"].get(relative, {}).get("sha256")
        if apply:
            if actual is not None and actual not in (old, expected):
                raise ValueError(f"Consumer edit preserved; reconcile {relative} before exporting")
        elif actual != expected or old != expected:
            raise ValueError(f"Shared STS drift or missing receipt: {relative}")
        outputs.append((destination, data))
        manifest["files"][relative] = {"source": name, "sha256": expected}
    if apply:
        for destination, data in outputs:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
        receipt.parent.mkdir(parents=True, exist_ok=True)
        receipt.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    result = synchronize(Path(__file__).resolve().parents[1], args.target, args.apply)
    print(f"Shared STS {'exported' if args.apply else 'verified'}: {len(result['files'])} files")
