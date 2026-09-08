$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$stopped = [System.Collections.Generic.HashSet[int]]::new()
$fakeProcesses = @(
    [pscustomobject]@{ ProcessId = 4001; Name = 'python.exe'; CommandLine = "$root\.venv\Scripts\python.exe -m robot_790d.realtime_entry" },
    [pscustomobject]@{ ProcessId = 4002; Name = 'python.exe'; CommandLine = "$root\.venv\Scripts\python.exe -m robot_790d.sts_page_server" },
    [pscustomobject]@{ ProcessId = 4003; Name = 'caddy.exe'; CommandLine = "$root\.local\sts-lan\bin\caddy.exe run" },
    [pscustomobject]@{ ProcessId = 4004; Name = 'python.exe'; CommandLine = "$root\.venv\Scripts\python.exe -m robot_790d.face_sim_server" }
)
$fakeListeners = @(
    [pscustomobject]@{ LocalAddress = '127.0.0.1'; LocalPort = 8765; OwningProcess = 4001 },
    [pscustomobject]@{ LocalAddress = '127.0.0.1'; LocalPort = 8790; OwningProcess = 4002 },
    [pscustomobject]@{ LocalAddress = '192.168.0.150'; LocalPort = 8765; OwningProcess = 4003 },
    [pscustomobject]@{ LocalAddress = '192.168.0.150'; LocalPort = 8790; OwningProcess = 4003 },
    [pscustomobject]@{ LocalAddress = '192.168.0.150'; LocalPort = 8791; OwningProcess = 4003 },
    [pscustomobject]@{ LocalAddress = '127.0.0.1'; LocalPort = 8791; OwningProcess = 4004 }
)

# These replace all system/process operations; the real stop script runs against fixtures only.
function Get-CimInstance { param($ClassName) $fakeProcesses }
function Get-NetTCPConnection {
    param($State, $ErrorAction)
    $fakeListeners | Where-Object { -not $stopped.Contains($_.OwningProcess) }
}
function Stop-Process { param($Id, [switch]$Force, $ErrorAction) [void]$stopped.Add($Id) }
function Start-Sleep { param($Milliseconds) }

foreach ($mode in @('all', 'realtime', 'page')) {
    $stopped.Clear()
    $options = @{}
    $expected = @(4001, 4002)
    if ($mode -eq 'realtime') { $options.RealtimeOnly = $true; $expected = @(4001) }
    if ($mode -eq 'page') { $options.PageOnly = $true; $expected = @(4002) }
    & (Join-Path $root 'scripts\stop_sts.ps1') @options
    if ($stopped.Count -ne $expected.Count) { throw "$mode stopped the wrong number of processes." }
    foreach ($processId in $expected) {
        if (-not $stopped.Contains($processId)) { throw "$mode missed its selected service." }
    }
    if ($stopped.Contains(4003) -or $stopped.Contains(4004)) {
        throw "$mode stopped the LAN gateway or browser face."
    }
    Write-Output "PASS: $mode stop preserves gateway and face."
}
