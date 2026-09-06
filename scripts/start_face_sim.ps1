param(
    [string] $HostAddress = "127.0.0.1",
    [int] $Port = 8791
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

Write-Host "Starting Robot 790 browser face at http://$HostAddress`:$Port/"
& $Python -m robot_790d.face_sim_server --host $HostAddress --port $Port
