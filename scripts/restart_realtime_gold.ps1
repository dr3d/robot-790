param(
    [int] $DelaySeconds = 1
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$StopScript = Join-Path $PSScriptRoot "stop_sts.ps1"
$StartScript = Join-Path $PSScriptRoot "start_realtime_gold.ps1"
$LogDir = Join-Path $RepoRoot "logs"
$OutLog = Join-Path $LogDir "sts-realtime.out.log"
$ErrLog = Join-Path $LogDir "sts-realtime.err.log"

if (-not (Test-Path $StopScript)) {
    throw "Missing stop script at $StopScript"
}
if (-not (Test-Path $StartScript)) {
    throw "Missing gold realtime launcher at $StartScript"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

& $StopScript -RealtimeOnly
if ($DelaySeconds -gt 0) {
    Start-Sleep -Seconds $DelaySeconds
}

$process = Start-Process `
    -FilePath powershell.exe `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $StartScript) `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -WindowStyle Hidden `
    -PassThru

Write-Host "Restarted Robot 790 realtime gold backend as process $($process.Id)."
