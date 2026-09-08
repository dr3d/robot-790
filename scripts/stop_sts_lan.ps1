param([switch] $RemoveFirewallRule)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Binary = Join-Path $RepoRoot ".local\sts-lan\bin\caddy.exe"
$processes = @(Get-Process -Name caddy -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $Binary })
foreach ($process in $processes) {
    Stop-Process -Id $process.Id -ErrorAction Stop
    Write-Host "Stopped apartment gateway PID $($process.Id)."
}
if ($RemoveFirewallRule) {
    Get-NetFirewallRule -Name "Robot790-Apartment-HTTPS" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Write-Host "Removed the apartment HTTPS firewall rule."
}
Write-Host "Local STS, the browser face, realtime, and certificate files were left alone."
