import json
import os
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

from robot_790d import sts_page_server


@pytest.fixture
def restart_handler(tmp_path, monkeypatch):
    # Isolate launcher receipts and logs, and never stop or load a real model.
    (tmp_path / "scripts").mkdir()
    (tmp_path / "scripts" / "restart_realtime_gold.ps1").touch()
    monkeypatch.setattr(sts_page_server, "__file__", str(tmp_path / "src" / "robot_790d" / "sts_page_server.py"))
    launched, replies = [], []

    def launch(args, **kwargs):
        launched.append(args)
        return SimpleNamespace(pid=123)

    monkeypatch.setattr(sts_page_server.subprocess, "Popen", launch)
    handler = object.__new__(sts_page_server.StsPageHandler)
    monkeypatch.setattr(handler, "_send_json", lambda status, payload: replies.append((status, payload)))
    return handler, launched, replies


@pytest.mark.parametrize("mtp", ["on", "off", "default"])
@pytest.mark.parametrize("preset", ["qwen27-mtp-vlow", "custom"])
def test_restart_forwards_mtp_without_changing_other_load_settings(restart_handler, monkeypatch, mtp, preset):
    handler, launched, replies = restart_handler
    payload = {"preset": preset, "mtp": mtp, "model": "fixture/model", "context_length": 65536, "parallel": 4}
    monkeypatch.setattr(handler, "_read_json_body", lambda: payload)
    handler._handle_realtime_restart()
    assert replies[-1][0] == 202
    assert replies[-1][1]["mtp"] == mtp
    args = launched[0]
    for key, value in {"-Mtp": mtp, "-Preset": preset, "-ContextLength": "65536", "-Parallel": "4"}.items():
        assert args[args.index(key) + 1] == value


def test_older_restart_requests_keep_lm_studio_default(restart_handler, monkeypatch):
    handler, launched, replies = restart_handler
    monkeypatch.setattr(handler, "_read_json_body", lambda: {"preset": "qwen27-mtp-vlow"})
    handler._handle_realtime_restart()
    assert replies[-1][0] == 202
    args = launched[0]
    assert args[args.index("-Mtp") + 1] == "default"


@pytest.mark.parametrize("mtp", [True, None, {}, "OFF", "on; Write-Output injected"])
def test_invalid_mtp_rejected_before_launch(restart_handler, monkeypatch, mtp):
    handler, launched, replies = restart_handler
    monkeypatch.setattr(handler, "_read_json_body", lambda: {"mtp": mtp})
    handler._handle_realtime_restart()
    assert replies[-1][0] == 400
    assert launched == []


@pytest.mark.parametrize("preset", ["openai", "qwen4"])
def test_mtp_rejected_for_presets_without_the_control(restart_handler, monkeypatch, preset):
    handler, launched, replies = restart_handler
    monkeypatch.setattr(handler, "_read_json_body", lambda: {"preset": preset, "mtp": "on"})
    handler._handle_realtime_restart()
    assert replies[-1][0] == 400
    assert launched == []


@pytest.mark.skipif(os.name != "nt", reason="Windows model launcher")
def test_shipped_powershell_load_arguments_enable_disable_and_inherit_mtp():
    script_path = Path(__file__).resolve().parents[1] / "scripts" / "restart_realtime_gold.ps1"
    # Evaluate only the actual argument-building AST nodes, never the restart or lms calls.
    script = r"""
$tokens = $null; $parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    $env:ROBOT790_TEST_LAUNCHER, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$assignment = $ast.Find({ param($node)
    $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and
    $node.Left.Extent.Text -eq '$modelLoadArgs'
}, $true)
$choice = $ast.Find({ param($node)
    $node -is [System.Management.Automation.Language.IfStatementAst] -and
    $node.Clauses[0].Item1.Extent.Text -eq '$Mtp -eq "on"'
}, $true)
if (!$assignment -or !$choice) { throw 'Missing model load argument builder' }
$build = [scriptblock]::Create($assignment.Extent.Text + "`n" + $choice.Extent.Text)
$selected = @{ Model = 'fixture/model'; ContextLength = 131072 }
$modelToLoad = 'fixture/installed-model'
$parallelPredictions = 4
$results = @{}
foreach ($Mtp in @('on', 'off', 'default')) {
    . $build
    $results[$Mtp] = $modelLoadArgs
}
$results | ConvertTo-Json -Compress
"""
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", script],
        env={**os.environ, "ROBOT790_TEST_LAUNCHER": str(script_path)},
        capture_output=True, text=True, check=True, timeout=15,
    )
    args = json.loads(result.stdout)
    baseline = ["load", "fixture/installed-model", "--parallel", 4, "--context-length", 131072,
                "--gpu", "max", "--identifier", "fixture/model", "-y"]
    assert args["default"] == baseline
    assert args["on"] == baseline + ["--speculative-draft-mtp"]
    assert args["off"] == baseline + ["--no-speculative-draft-mtp"]


@pytest.mark.skipif(os.name != "nt", reason="Windows model launcher")
def test_missing_model_is_rejected_before_stopping_realtime(tmp_path):
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    launcher = scripts / "restart_realtime_gold.ps1"
    original = Path(__file__).resolve().parents[1] / "scripts" / launcher.name
    launcher.write_bytes(original.read_bytes())
    (scripts / "stop_sts.ps1").write_text("throw 'STOP WAS CALLED'", encoding="utf-8")
    (scripts / "start_realtime_eric_qwen3.ps1").write_text("throw 'START WAS CALLED'", encoding="utf-8")
    script = r"""
function lms {
    $global:LASTEXITCODE = 0
    if (($args -join ' ') -ne 'ls --json') { throw 'Unexpected model mutation' }
    '[]'
}
try {
    & $env:ROBOT790_TEST_LAUNCHER -Preset qwen27-mtp-vlow -Mtp off
    throw 'Expected missing-model failure'
} catch {
    $_.Exception.Message
}
"""
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", script],
        env={**os.environ, "ROBOT790_TEST_LAUNCHER": str(launcher)},
        capture_output=True, text=True, check=True, timeout=15,
    )
    assert "Installed model key 'qwen3.8-27b-mtp' was not found" in result.stdout
    assert "Realtime has not been stopped" in result.stdout
    assert "WAS CALLED" not in result.stdout
