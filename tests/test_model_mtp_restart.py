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


@pytest.mark.parametrize("reasoning", ["on", "none", "low", "medium", "xhigh"])
@pytest.mark.parametrize("preset", ["qwen27-mtp-vlow", "custom"])
def test_restart_forwards_thinking_choice(restart_handler, monkeypatch, reasoning, preset):
    handler, launched, replies = restart_handler
    monkeypatch.setattr(handler, "_read_json_body", lambda: {
        "preset": preset, "model": "qwen3.8-27b-mtp", "reasoning": reasoning,
    })
    handler._handle_realtime_restart()
    assert replies[-1][0] == 202
    assert replies[-1][1]["reasoning"] == reasoning
    args = launched[0]
    assert args[args.index("-Reasoning") + 1] == reasoning


def test_older_restart_requests_keep_lm_studio_default(restart_handler, monkeypatch):
    handler, launched, replies = restart_handler
    monkeypatch.setattr(handler, "_read_json_body", lambda: {"preset": "qwen27-mtp-vlow"})
    handler._handle_realtime_restart()
    assert replies[-1][0] == 202
    args = launched[0]
    assert args[args.index("-Mtp") + 1] == "default"
    assert args[args.index("-Reasoning") + 1] == "none"


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


@pytest.mark.parametrize("model", ["0.6B", "1.7B"])
@pytest.mark.parametrize("precision", ["bfloat16", "float16"])
def test_restart_forwards_model_and_ignores_old_browser_precision(restart_handler, monkeypatch, model, precision):
    handler, launched, replies = restart_handler
    monkeypatch.setattr(sts_page_server, "model_installed", lambda size: True)
    monkeypatch.setattr(handler, "_read_json_body", lambda: {"tts_model": model, "tts_dtype": precision})
    handler._handle_realtime_restart()
    assert replies[-1][0] == 202
    assert replies[-1][1]["tts_model"] == model
    args = launched[0]
    assert args[args.index("-TtsModelSize") + 1] == model
    assert "-TtsDtype" not in args
    assert "tts_dtype" not in replies[-1][1]


@pytest.mark.parametrize("model", [None, {}, [], "1.2B", "1.7B; unexpected", "1.7B"])
def test_invalid_or_uninstalled_speech_model_cannot_launch_restart(restart_handler, monkeypatch, model):
    handler, launched, replies = restart_handler
    monkeypatch.setattr(sts_page_server, "model_installed", lambda size: False)
    monkeypatch.setattr(handler, "_read_json_body", lambda: {"tts_model": model})
    handler._handle_realtime_restart()
    assert replies[-1][0] == 400
    assert launched == []


@pytest.mark.skipif(os.name != "nt", reason="Windows model launcher")
def test_nvfp4_restart_selection_and_launch_preserve_binary_thinking():
    script_path = Path(__file__).resolve().parents[1] / "scripts" / "restart_realtime_gold.ps1"
    script = r'''
$tokens = $null; $parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    $env:ROBOT790_TEST_LAUNCHER, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$presetsNode = $ast.Find({ param($node)
    $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and
    $node.Left.Extent.Text -eq '$presets'
}, $true)
$reasoningNode = $ast.Find({ param($node)
    $node -is [System.Management.Automation.Language.IfStatementAst] -and
    $node.Clauses[0].Item1.Extent.Text -eq '$selected.Reasoning'
}, $true)
if (!$presetsNode -or !$reasoningNode) { throw 'Missing reasoning argument builder' }
$results = @{}
foreach ($Reasoning in @('none', 'on', 'low', 'medium', 'xhigh', '')) {
    . ([scriptblock]::Create($presetsNode.Extent.Text))
    $selected = $presets['qwen27-mtp-vlow']
    $startArgs = @()
    . ([scriptblock]::Create($reasoningNode.Extent.Text))
    $results[$Reasoning] = $startArgs
}
$results | ConvertTo-Json -Compress
'''
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", script],
        env={**os.environ, "ROBOT790_TEST_LAUNCHER": str(script_path)},
        capture_output=True, text=True, check=True, timeout=15,
    )
    args = json.loads(result.stdout)
    for mode in ("none", ""):
        assert args[mode] == ["-ReasoningEffort", "none"]
    for mode in ("on", "low", "medium", "xhigh"):
        assert args[mode] == ["-ReasoningEffort", "on"]


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
    (scripts / "tts_precision.ps1").write_bytes((original.parent / "tts_precision.ps1").read_bytes())
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


@pytest.mark.skipif(os.name != "nt", reason="Windows model launcher")
def test_speech_model_path_and_precision_reach_the_realtime_launcher(tmp_path):
    script_path = Path(__file__).resolve().parents[1] / "scripts" / "restart_realtime_gold.ps1"
    script = r'''
$tokens = $null; $parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    $env:ROBOT790_TEST_LAUNCHER, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$assignment = $ast.Find({ param($node)
    $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and
    $node.Left.Extent.Text -eq '$startArgs'
}, $true)
if (!$assignment) { throw 'Missing realtime argument builder' }
$selected = @{Model='fixture/model'; Provider='lmstudio'; AudioMaxTokens=64}
$StartScript='fixture-start.ps1'
$TtsModelPath=Join-Path $env:ROBOT790_TEST_TTS_ROOT 'Qwen3-TTS-12Hz-1.7B-CustomVoice'
$TtsDtype='float16'
. ([scriptblock]::Create($assignment.Extent.Text))
$startArgs | ConvertTo-Json -Compress
'''
    root = tmp_path / "models with spaces"
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", script],
        env={**os.environ, "ROBOT790_TEST_LAUNCHER": str(script_path), "ROBOT790_TEST_TTS_ROOT": str(root)},
        capture_output=True, text=True, check=True, timeout=15,
    )
    args = json.loads(result.stdout)
    assert args[args.index("-TtsDtype") + 1] == "float16"
    assert args[args.index("-TtsModel") + 1] == f'"{root / "Qwen3-TTS-12Hz-1.7B-CustomVoice"}"'


@pytest.mark.skipif(os.name != "nt", reason="Windows model launcher")
def test_missing_speech_weights_are_rejected_before_stopping_realtime(tmp_path):
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    launcher = scripts / "restart_realtime_gold.ps1"
    launcher.write_bytes((Path(__file__).resolve().parents[1] / "scripts" / launcher.name).read_bytes())
    (scripts / "tts_precision.ps1").write_bytes(
        (Path(__file__).resolve().parents[1] / "scripts" / "tts_precision.ps1").read_bytes())
    (scripts / "stop_sts.ps1").write_text("throw 'STOP WAS CALLED'", encoding="utf-8")
    (scripts / "start_realtime_eric_qwen3.ps1").write_text("throw 'START WAS CALLED'", encoding="utf-8")
    script = r'''
function lms {
    $global:LASTEXITCODE = 0
    if (($args -join ' ') -ne 'ls --json') { throw 'Unexpected model mutation' }
    '[{"modelKey":"qwen3.8-27b-mtp"}]'
}
try {
    & $env:ROBOT790_TEST_LAUNCHER -Preset qwen27-mtp-vlow -TtsModelSize 1.7B
    throw 'Expected missing speech-model failure'
} catch { $_.Exception.Message }
'''
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", script],
        env={**os.environ, "ROBOT790_TEST_LAUNCHER": str(launcher),
             "ROBOT_790_TTS_MODEL_DIR": str(tmp_path / "missing speech models")},
        capture_output=True, text=True, check=True, timeout=15,
    )
    assert "Speech model 1.7B is not installed" in result.stdout
    assert "Realtime has not been stopped" in result.stdout
    assert "WAS CALLED" not in result.stdout
