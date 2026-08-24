param(
    [string] $HostAddress = "127.0.0.1",
    [int] $Port = 8765,
    [int] $NumPipelines = 4,
    [int] $StreamBatchSentences = 1,
    [string[]] $ExtraArgs = @()
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $RepoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    throw "Missing speech-to-speech in the project venv. Install it with: .\.venv\Scripts\python.exe -m pip install -e .[realtime]"
}

$env:PYTHONIOENCODING = "utf-8"

Write-Host "Starting Robot 790 realtime server at ws://$HostAddress`:$Port/v1/realtime with $NumPipelines pipeline(s)"
Write-Host "Streaming TTS in $StreamBatchSentences sentence batch(es)"
& $Python -m robot_790d.realtime_entry --mode realtime --ws_host $HostAddress --ws_port $Port --num_pipelines $NumPipelines --stream_batch_sentences $StreamBatchSentences @ExtraArgs
