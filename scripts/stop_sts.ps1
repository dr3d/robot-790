param(
    [switch] $RealtimeOnly,
    [switch] $PageOnly
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ports = @()
if (-not $PageOnly) {
    $ports += 8765
}
if (-not $RealtimeOnly) {
    $ports += 8790
}

if ($ports.Count -eq 0) {
    Write-Host "Nothing selected."
    exit 0
}

$processes = @(Get-CimInstance Win32_Process)
$targetIds = New-Object "System.Collections.Generic.HashSet[int]"

foreach ($connection in Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue) {
    if ($ports -contains [int]$connection.LocalPort) {
        [void]$targetIds.Add([int]$connection.OwningProcess)
    }
}

foreach ($process in $processes) {
    $commandLine = [string]$process.CommandLine
    if (-not $commandLine.Contains($RepoRoot)) {
        continue
    }

    $isRealtime = $commandLine -match 'robot_790d\.realtime_entry|start_realtime_gold\.ps1|restart_realtime_gold\.ps1|start_realtime_eric_qwen3\.ps1|start_realtime_server\.ps1'
    $isPage = $commandLine -match 'robot_790d\.sts_page_server|start_sts_page\.ps1'

    if ((-not $PageOnly -and $isRealtime) -or (-not $RealtimeOnly -and $isPage)) {
        [void]$targetIds.Add([int]$process.ProcessId)
    }
}

if ($targetIds.Count -eq 0) {
    Write-Host "Robot 790 STS is not running on ports $($ports -join ', ')."
    exit 0
}

Write-Host "Stopping Robot 790 STS processes:"
$processes |
    Where-Object { $targetIds.Contains([int]$_.ProcessId) } |
    Select-Object ProcessId, Name, @{Name = "Command"; Expression = { $_.CommandLine }} |
    Format-Table -AutoSize

foreach ($processId in $targetIds) {
    if ($processId -ne $PID) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Milliseconds 500

$remaining = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $ports -contains [int]$_.LocalPort }

if ($remaining) {
    Write-Warning "Some selected ports are still listening:"
    $remaining | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize
} else {
    Write-Host "Stopped. Selected ports are no longer listening."
}
