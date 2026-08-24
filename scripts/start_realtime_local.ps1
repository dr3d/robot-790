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
$env:PYTHONIOENCODING = "utf-8"

Write-Host "Starting Robot 790 local realtime voice loop"
Write-Host "Face URL: $env:ROBOT_790_FACE_URL"
Write-Host "Note: installed speech-to-speech CLI does not support --tool-module; face tools are not attached in this mode."
& $SpeechToSpeech --mode local @ExtraArgs
