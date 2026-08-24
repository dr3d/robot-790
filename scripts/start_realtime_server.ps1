param(
    [string] $HostAddress = "127.0.0.1",
    [int] $Port = 8765,
    [string[]] $ExtraArgs = @()
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$SpeechToSpeech = Join-Path $RepoRoot ".venv\Scripts\speech-to-speech.exe"

if (-not (Test-Path $SpeechToSpeech)) {
    throw "Missing speech-to-speech in the project venv. Install it with: .\.venv\Scripts\python.exe -m pip install -e .[realtime]"
}

Write-Host "Starting Robot 790 realtime server at ws://$HostAddress`:$Port/v1/realtime"
& $SpeechToSpeech serve --host $HostAddress --port $Port @ExtraArgs
