param(
    [string] $Voice = "Eric",
    [int] $Port = 8000,
    [string] $Model = "C:\Users\dr3d\ComfyUI_windows_portable\ComfyUI\models\TTS\Qwen3-TTS-12Hz-0.6B-CustomVoice",
    [string] $HostAddress = "127.0.0.1",
    [string] $HfHome = "",
    [switch] $Mock
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $RepoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    throw "Missing project venv at $Python. Create it with: python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -e .[tts]"
}

if (-not $HfHome) {
    $HfHome = Join-Path (Split-Path -Parent $RepoRoot) "hf_cache"
}

$env:HF_HOME = $HfHome
$env:QWEN_TTS_MODEL = $Model
$env:QWEN_TTS_VOICE = $Voice
$env:QWEN_TTS_HOST = $HostAddress
$env:QWEN_TTS_PORT = "$Port"
$env:QWEN_TTS_ATTN_IMPLEMENTATION = ""
$env:QWEN_TTS_WARMUP = "0"
$env:QWEN_TTS_MOCK = if ($Mock) { "1" } else { "0" }

Write-Host "Starting Robot 790 Qwen3-TTS on http://$HostAddress`:$Port with voice $Voice"
Write-Host "HF_HOME=$env:HF_HOME"
& $Python -m robot_790_tts.server
