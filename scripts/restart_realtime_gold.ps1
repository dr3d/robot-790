param(
    [int] $DelaySeconds = 1,
    [ValidateSet("qwen27", "qwen9", "qwen4", "nemotron30")]
    [string] $Preset = "qwen27"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$StopScript = Join-Path $PSScriptRoot "stop_sts.ps1"
$StartScript = Join-Path $PSScriptRoot "start_realtime_eric_qwen3.ps1"
$LogDir = Join-Path $RepoRoot "logs"
$OutLog = Join-Path $LogDir "sts-realtime.out.log"
$ErrLog = Join-Path $LogDir "sts-realtime.err.log"

if (-not (Test-Path $StopScript)) {
    throw "Missing stop script at $StopScript"
}
if (-not (Test-Path $StartScript)) {
    throw "Missing realtime launcher at $StartScript"
}

$presets = @{
    qwen27 = @{
        Label = "Qwen 27B"
        Model = "qwen/qwen3.8-27b"
        Reasoning = "low"
        AudioMaxTokens = 64
        ContextLength = 131072
    }
    qwen9 = @{
        Label = "Qwen 9B"
        Model = "qwen/qwen3.5-9b"
        Reasoning = "low"
        AudioMaxTokens = 64
        ContextLength = 131072
    }
    qwen4 = @{
        Label = "Qwen 4B"
        Model = "qwen3.5-4b"
        Reasoning = "none"
        AudioMaxTokens = 64
        ContextLength = 131072
    }
    nemotron30 = @{
        Label = "Nemotron 30B A3B"
        Model = "nvidia-nemotron-3.5-lightning-30b-a3b"
        Reasoning = "none"
        AudioMaxTokens = 192
        ContextLength = 65536
    }
}

$selected = $presets[$Preset]

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

& $StopScript -RealtimeOnly
if ($DelaySeconds -gt 0) {
    Start-Sleep -Seconds $DelaySeconds
}

try {
    $loadedModels = & lms ps |
        Where-Object { $_ -and $_ -notmatch '^\s*IDENTIFIER\s+' } |
        ForEach-Object { ($_ -split '\s+')[0] } |
        Where-Object { $_ }
    foreach ($loaded in $loadedModels) {
        & lms unload $loaded | Out-Null
    }
    & lms load $selected.Model --parallel 1 --context-length $selected.ContextLength --gpu max --identifier $selected.Model -y | Out-Null
} catch {
    throw "Could not switch LM Studio to $($selected.Model): $($_.Exception.Message)"
}

$startArgs = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $StartScript,
    "-LlmModel",
    $selected.Model,
    "-ReasoningEffort",
    $selected.Reasoning,
    "-NumPipelines",
    "1",
    "-StreamBatchSentences",
    "1",
    "-AudioMaxTokens",
    [string] $selected.AudioMaxTokens
)

$process = Start-Process `
    -FilePath powershell.exe `
    -ArgumentList $startArgs `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -WindowStyle Hidden `
    -PassThru

Write-Host "Restarted Robot 790 realtime backend as $($selected.Label) ($($selected.Model)) process $($process.Id)."
