param(
    [ValidateRange(0.001, 24)]
    [double] $Hours = 8,
    [switch] $Stop
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Directory = Join-Path $RepoRoot 'logs\live\llm-metrics'
New-Item -ItemType Directory -Path $Directory -Force | Out-Null
if ($Stop) {
    New-Item -ItemType File -Path (Join-Path $Directory 'stop.request') -Force | Out-Null
    Write-Host 'Requested LLM metrics capture stop; no servers or models are stopped.'
    return
}
$Python = Join-Path $RepoRoot '.venv\Scripts\python.exe'
$Lms = Join-Path $env:USERPROFILE '.lmstudio\bin\lms.exe'
if (-not (Test-Path -LiteralPath $Lms)) { throw "LM Studio CLI not found: $Lms" }
$Arguments = @('-m', 'robot_790d.llm_metrics', '--lms', "`"$Lms`"",
    '--directory', "`"$Directory`"", '--hours', $Hours.ToString([cultureinfo]::InvariantCulture))
$Process = Start-Process -FilePath $Python -ArgumentList $Arguments -WorkingDirectory $RepoRoot -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 3
if ($Process.HasExited -and $Process.ExitCode -ne 0) { throw 'LLM metrics capture failed; inspect status.json.' }
$StatusPath = Join-Path $Directory 'status.json'
if (Test-Path -LiteralPath $StatusPath) {
    Get-Content -LiteralPath $StatusPath -Raw | ConvertFrom-Json | Format-List
} else {
    throw 'LLM metrics capture did not create its status file.'
}
