param(
    [string] $HostAddress = "127.0.0.1",
    [int] $Port = 8792,
    [string] $DaemonUrl = "http://reachy-mini.local:8000/",
    [switch] $AllowMotion
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$EnvLoader = Join-Path $PSScriptRoot "load_env.ps1"

if (Test-Path -LiteralPath $EnvLoader) {
    . $EnvLoader -Quiet
}

if (-not (Test-Path $Python)) {
    throw "Missing project venv at $Python."
}

$argsList = @(
    "-m",
    "robot_790d.reachy_embodiment_server",
    "--host",
    $HostAddress,
    "--port",
    [string] $Port,
    "--daemon-url",
    $DaemonUrl
)

if ($AllowMotion) {
    $argsList += "--allow-motion"
}

$mode = if ($AllowMotion) { "motion requests enabled" } else { "motion gated" }
Write-Host "Starting Robot 790 Reachy adapter at http://$HostAddress`:$Port/ ($mode)"
& $Python @argsList
