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

$LanAddress = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "169.254*" -and $_.IPAddress -ne "127.0.0.1" -and $_.InterfaceAlias -notlike "vEthernet*" } |
    Select-Object -First 1 -ExpandProperty IPAddress

Write-Host "Starting Robot 790 realtime server on $HostAddress`:$Port with $NumPipelines pipeline(s)"
Write-Host "Local: ws://127.0.0.1:$Port/v1/realtime"
if ($HostAddress -eq "127.0.0.1") {
    Write-Host "Apartment HTTPS: start_sts_lan.ps1"
} elseif ($LanAddress) {
    Write-Host "LAN:   ws://$LanAddress`:$Port/v1/realtime"
}
Write-Host "Streaming TTS in $StreamBatchSentences sentence batch(es)"
& $Python -m robot_790d.realtime_entry --mode realtime --ws_host $HostAddress --ws_port $Port --num_pipelines $NumPipelines --stream_batch_sentences $StreamBatchSentences @ExtraArgs
