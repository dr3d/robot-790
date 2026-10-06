"""Exercise launcher configuration without loading models or stopping services."""
import json
import os
import subprocess
from pathlib import Path

import pytest


@pytest.mark.skipif(os.name != "nt", reason="Windows launchers")
@pytest.mark.parametrize("launcher", [
    "start_realtime_gold.ps1", "start_realtime_eric_qwen3.ps1", "restart_realtime_gold.ps1",
])
@pytest.mark.parametrize("setting,expected", [
    (None, "bfloat16"), ("bfloat16", "bfloat16"), ("float16", "float16"), ("invalid", None),
])
def test_launchers_read_precision_from_dotenv_before_external_actions(tmp_path, launcher, setting, expected):
    source_dir = Path(__file__).resolve().parents[1] / "scripts"
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    for name in ("load_env.ps1", "tts_precision.ps1"):
        (scripts / name).write_bytes((source_dir / name).read_bytes())
    if setting is not None:
        (tmp_path / ".env").write_text(f"ROBOT_790_TTS_DTYPE={setting}\n", encoding="utf-8")
    script = r'''
$ErrorActionPreference = 'Stop'
$tokens = $null; $parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    $env:ROBOT790_TEST_SOURCE, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$setting = $ast.Find({ param($node)
    $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and
    $node.Left.Extent.Text -eq '$TtsDtype'
}, $true)
if (!$setting) { throw 'Missing precision resolution before launch' }
# Run the real configuration prelude, ending before any model or service action.
$prefix = [IO.File]::ReadAllText($env:ROBOT790_TEST_SOURCE).Substring(0, $setting.Extent.EndOffset)
$prefix += "`n[pscustomobject]@{precision=`$TtsDtype} | ConvertTo-Json -Compress"
[IO.File]::WriteAllText($env:ROBOT790_TEST_COPY, $prefix)
& $env:ROBOT790_TEST_COPY
'''
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", script],
        env={**os.environ, "ROBOT_790_TTS_DTYPE": "", "ROBOT790_TEST_SOURCE": str(source_dir / launcher),
             "ROBOT790_TEST_COPY": str(scripts / launcher)},
        capture_output=True, text=True, timeout=15,
    )
    if expected is None:
        assert result.returncode != 0
        assert "ROBOT_790_TTS_DTYPE must be bfloat16 or float16" in result.stderr
    else:
        assert result.returncode == 0, result.stderr
        assert json.loads(result.stdout)["precision"] == expected
