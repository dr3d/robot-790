param(
    [string] $FaceUrl = "http://esp32-eyes.local/",
    [string[]] $ExtraArgs = @()
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$SpeechToSpeech = Join-Path $RepoRoot ".venv\Scripts\speech-to-speech.exe"

if (-not (Test-Path $SpeechToSpeech)) {
    throw "Missing speech-to-speech in the project venv. Install it with: .\.venv\Scripts\python.exe -m pip install -e .[realtime]"
}

$env:ROBOT_790_FACE_URL = $FaceUrl

Write-Host "Starting Robot 790 local realtime voice loop"
Write-Host "Face URL: $env:ROBOT_790_FACE_URL"
& $SpeechToSpeech local --tool-module robot_790d.realtime_tools @ExtraArgs
