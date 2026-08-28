param(
    [int] $Port = 8790
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$PageRoot = Join-Path $RepoRoot "web\sts"
$EnvLoader = Join-Path $PSScriptRoot "load_env.ps1"

if (Test-Path -LiteralPath $EnvLoader) {
    . $EnvLoader -Quiet
}

if (-not (Test-Path $Python)) {
    throw "Missing project venv at $Python."
}

if (-not (Test-Path $PageRoot)) {
    throw "Missing STS page folder at $PageRoot."
}

Write-Host "Starting Robot 790 STS page at http://127.0.0.1:$Port/"
& $Python -m robot_790d.sts_page_server --host 127.0.0.1 --port $Port --directory $PageRoot
