param(
    [string] $HostAddress = "127.0.0.1",
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

$LanAddress = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "169.254*" -and $_.IPAddress -ne "127.0.0.1" -and $_.InterfaceAlias -notlike "vEthernet*" } |
    Select-Object -First 1 -ExpandProperty IPAddress

Write-Host "Starting Robot 790 STS page on $HostAddress`:$Port"
Write-Host "Local: http://127.0.0.1:$Port/"
if ($HostAddress -eq "127.0.0.1") {
    Write-Host "Apartment HTTPS: start_sts_lan.ps1"
} elseif ($LanAddress) {
    Write-Host "LAN:   http://$LanAddress`:$Port/"
}
& $Python -m robot_790d.sts_page_server --host $HostAddress --port $Port --directory $PageRoot
