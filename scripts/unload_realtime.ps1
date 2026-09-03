param(
    [switch] $KeepLmStudio
)

$ErrorActionPreference = "Stop"

$StopScript = Join-Path $PSScriptRoot "stop_sts.ps1"
$EnvLoader = Join-Path $PSScriptRoot "load_env.ps1"

if (Test-Path -LiteralPath $EnvLoader) {
    . $EnvLoader -Quiet
}

if (-not (Test-Path -LiteralPath $StopScript)) {
    throw "Missing stop script at $StopScript"
}

& $StopScript -RealtimeOnly

if ($KeepLmStudio) {
    Write-Host "Realtime stopped; LM Studio model left loaded."
    exit 0
}

try {
    & lms unload --all | Out-Null
    Write-Host "Realtime stopped and LM Studio models unloaded."
} catch {
    throw "Realtime stopped, but LM Studio unload failed: $($_.Exception.Message)"
}
