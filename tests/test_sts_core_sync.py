import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "sts_core_sync", Path(__file__).resolve().parents[1] / "scripts/sync_sts_core.py"
)
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def fixture(tmp_path):
    source, target = tmp_path / "source", tmp_path / "consumer"
    hook = ("    apply_bounded_stt_patch()\n    apply_parakeet_voice_shape_patch()\n"
            "        audio = audio[-15 * sample_rate:]")
    for root, relative in [
        (source, "src/robot_790d/realtime_entry.py"),
        (target, "work/src/robot_790d/realtime_entry.py"),
    ]:
        p = root / relative
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(hook)
    for name in sync.FILES:
        p = source / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("first version\n")
    return source, target


def test_export_update_and_drift_check(tmp_path):
    source, target = fixture(tmp_path)
    sync.synchronize(source, target, apply=True)
    sync.synchronize(source, target)
    module = "src/robot_790d/bounded_stt.py"
    (source / module).write_text("second version\n")
    with pytest.raises(ValueError, match="drift"):
        sync.synchronize(source, target)
    sync.synchronize(source, target, apply=True)
    sync.synchronize(source, target)
    assert (target / "work" / module).read_text() == "second version\n"


def test_consumer_edit_aborts_entire_export_before_other_files_are_written(tmp_path):
    source, target = fixture(tmp_path)
    sync.synchronize(source, target, apply=True)
    receipt = (target / "provenance/shared-sts.json").read_bytes()
    (source / "src/robot_790d/bounded_stt.py").write_text("new source\n")
    edited = target / "work/tests/test_bounded_stt.py"
    edited.write_text("local change\n")
    with pytest.raises(ValueError, match="Consumer edit preserved"):
        sync.synchronize(source, target, apply=True)
    assert edited.read_text() == "local change\n"
    assert (target / "work/src/robot_790d/bounded_stt.py").read_text() == "first version\n"
    assert (target / "provenance/shared-sts.json").read_bytes() == receipt


def test_missing_integration_hook_is_rejected(tmp_path):
    source, target = fixture(tmp_path)
    (target / "work/src/robot_790d/realtime_entry.py").write_text("missing hook")
    with pytest.raises(ValueError, match="integration"):
        sync.synchronize(source, target, apply=True)
