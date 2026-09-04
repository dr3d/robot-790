from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = ROOT / "config" / "face" / "robot-790-face.json"
POSE_FIELDS = ["open", "width", "curve", "skew", "teeth", "tension", "slant", "upperLift"]
FIRMWARE_PATHS = [
    ROOT / "firmware" / "esp32-s3-face" / "src" / "main.cpp",
    ROOT / "firmware" / "esp32-face" / "src" / "main.cpp",
]


def load_spec() -> dict:
    return json.loads(SPEC_PATH.read_text(encoding="utf-8"))


def assert_pose_close(actual: dict[str, float], expected: dict[str, float]) -> None:
    assert set(actual) == set(POSE_FIELDS)
    for field in POSE_FIELDS:
        assert actual[field] == expected[field]


def parse_browser_mouth_shapes(source: str) -> list[str]:
    match = re.search(r"const mouths = \[(?P<items>[^\]]+)\];", source)
    assert match, "browser face mouth shape list not found"
    return re.findall(r'"([^"]+)"', match.group("items"))


def parse_browser_mouth_poses(source: str) -> dict[str, dict[str, float]]:
    poses: dict[str, dict[str, float]] = {}
    for match in re.finditer(r"^\s*(?P<shape>[a-z_]+): \{ (?P<body>[^}]+) \},?$", source, re.MULTILINE):
        body = match.group("body")
        values = {
            item.group("field"): float(item.group("value"))
            for item in re.finditer(r"(?P<field>[A-Za-z]+): (?P<value>-?\d+(?:\.\d+)?)", body)
        }
        if set(values) == set(POSE_FIELDS):
            poses[match.group("shape")] = values
    return poses


def parse_firmware_poses(source: str) -> dict[str, list[float]]:
    poses: dict[str, list[float]] = {}
    pattern = r"case MouthShape::(?P<name>\w+): return \{(?P<body>[^}]+)\};"
    for match in re.finditer(pattern, source):
        values = [float(value) for value in re.findall(r"-?\d+(?:\.\d+)?(?=f)", match.group("body"))]
        if len(values) == len(POSE_FIELDS):
            poses[match.group("name")] = values
    default_match = re.search(r"default: return \{(?P<body>[^}]+)\};", source)
    assert default_match, "firmware neutral default mouth pose not found"
    poses["Neutral"] = [float(value) for value in re.findall(r"-?\d+(?:\.\d+)?(?=f)", default_match.group("body"))]
    return poses


def test_generated_face_contract_is_current() -> None:
    result = subprocess.run(
        [sys.executable, "scripts/generate_face_contract.py", "--check"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_browser_face_mouth_contract_matches_spec() -> None:
    spec = load_spec()["mouth"]
    source = (ROOT / "web" / "face-sim" / "index.html").read_text(encoding="utf-8")
    assert parse_browser_mouth_shapes(source) == spec["shapeOrder"]

    browser_poses = parse_browser_mouth_poses(source)
    assert sorted(browser_poses) == sorted(spec["shapeOrder"])
    for shape in spec["shapeOrder"]:
        assert_pose_close(browser_poses[shape], spec["shapes"][shape]["pose"])


def test_live_firmware_mouth_contract_matches_spec() -> None:
    spec = load_spec()["mouth"]
    expected_by_cpp_name = {
        item["cppName"]: [float(item["pose"][field]) for field in POSE_FIELDS]
        for shape in spec["shapeOrder"]
        for item in [spec["shapes"][shape]]
    }

    for firmware_path in FIRMWARE_PATHS:
        source = firmware_path.read_text(encoding="utf-8")
        for shape in spec["shapeOrder"]:
            assert f'"{shape}"' in source
        poses = parse_firmware_poses(source)
        for cpp_name, expected_values in expected_by_cpp_name.items():
            assert poses.get(cpp_name) == expected_values, f"{firmware_path}: {cpp_name}"
