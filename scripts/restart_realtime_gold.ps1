param(
    [int] $DelaySeconds = 1,
    [ValidateSet("qwen27-mtp-vlow", "qwen27", "qwen9", "qwen4", "nemotron30", "openai", "custom")]
    [string] $Preset = "qwen27-mtp-vlow",
    [string] $Model = "",
    [ValidateSet("", "low", "medium", "xhigh", "none")]
    [string] $Reasoning = "none",
    [int] $ContextLength = 131072,
    [int] $Parallel = 0,
    [ValidateSet("bfloat16", "float16")]
    [string] $TtsDtype = "bfloat16"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$StopScript = Join-Path $PSScriptRoot "stop_sts.ps1"
$StartScript = Join-Path $PSScriptRoot "start_realtime_eric_qwen3.ps1"
$LogDir = Join-Path $RepoRoot "logs"
$OutLog = Join-Path $LogDir "sts-realtime.out.log"
$ErrLog = Join-Path $LogDir "sts-realtime.err.log"
$EnvLoader = Join-Path $PSScriptRoot "load_env.ps1"

if (Test-Path -LiteralPath $EnvLoader) {
    . $EnvLoader -Quiet
}

if (-not (Test-Path $StopScript)) {
    throw "Missing stop script at $StopScript"
}
if (-not (Test-Path $StartScript)) {
    throw "Missing realtime launcher at $StartScript"
}

$presets = @{
    "qwen27-mtp-vlow" = @{
        Label = "Qwen 27B MTP Fast"
        Provider = "lmstudio"
        Model = "qwen3.8-27b-nvfp4-mtp"
        Reasoning = "none"
        AudioMaxTokens = 64
        ContextLength = 131072
        Parallel = 4
    }
    qwen27 = @{
        Label = "Qwen 27B"
        Provider = "lmstudio"
        Model = "qwen/qwen3.8-27b"
        Reasoning = "low"
        AudioMaxTokens = 64
        ContextLength = 131072
        Parallel = 1
    }
    qwen9 = @{
        Label = "Qwen 9B"
        Provider = "lmstudio"
        Model = "qwen/qwen3.5-9b"
        Reasoning = "low"
        AudioMaxTokens = 64
        ContextLength = 131072
        Parallel = 1
    }
    qwen4 = @{
        Label = "Qwen 4B"
        Provider = "lmstudio"
        Model = "qwen3.5-4b"
        Reasoning = "none"
        AudioMaxTokens = 64
        ContextLength = 131072
        Parallel = 1
    }
    nemotron30 = @{
        Label = "Nemotron 30B A3B"
        Provider = "lmstudio"
        Model = "nvidia-nemotron-3.5-lightning-30b-a3b"
        Reasoning = "none"
        AudioMaxTokens = 192
        ContextLength = 65536
        Parallel = 1
    }
    openai = @{
        Label = "OpenAI"
        Provider = "openai"
        Model = if ($env:ROBOT_790_OPENAI_LLM_MODEL) { $env:ROBOT_790_OPENAI_LLM_MODEL } else { "gpt-4.1-mini" }
        BaseUrl = if ($env:ROBOT_790_OPENAI_LLM_BASE_URL) { $env:ROBOT_790_OPENAI_LLM_BASE_URL } else { "https://api.openai.com/v1" }
        ApiKey = if ($env:ROBOT_790_OPENAI_LLM_API_KEY) { $env:ROBOT_790_OPENAI_LLM_API_KEY } else { $env:OPENAI_API_KEY }
        Reasoning = ""
        AudioMaxTokens = 64
        ContextLength = 0
        Parallel = 0
    }
}

$selected = $presets[$Preset]
if ($Preset -eq "custom") {
    $Model = $Model.Trim()
    if (-not $Model) {
        throw "Custom preset needs -Model with an LM Studio model key."
    }
    if ($Model -match '[\r\n]') {
        throw "Custom model key cannot contain newlines."
    }
    if ($Model.Length -gt 240) {
        throw "Custom model key is too long."
    }
    $ContextLength = [Math]::Max(4096, [Math]::Min(262144, $ContextLength))
    $Parallel = if ($Parallel -gt 0) { [Math]::Max(1, [Math]::Min(8, $Parallel)) } else { 4 }
    $selected = @{
        Label = "Custom LM Studio"
        Provider = "lmstudio"
        Model = $Model
        Reasoning = $Reasoning
        AudioMaxTokens = 64
        ContextLength = $ContextLength
        Parallel = $Parallel
    }
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

& $StopScript -RealtimeOnly
if ($DelaySeconds -gt 0) {
    Start-Sleep -Seconds $DelaySeconds
}

if ($selected.Provider -eq "lmstudio") {
    try {
        $parallelPredictions = if ($selected.Parallel) { [int] $selected.Parallel } else { 1 }
        & lms unload --all | Out-Null
        & lms load $selected.Model --parallel $parallelPredictions --context-length $selected.ContextLength --gpu max --identifier $selected.Model -y | Out-Null
    } catch {
        throw "Could not switch LM Studio to $($selected.Model): $($_.Exception.Message)"
    }
} else {
    if (-not $selected.ApiKey) {
        throw "OpenAI preset needs OPENAI_API_KEY or ROBOT_790_OPENAI_LLM_API_KEY in .env."
    }
    try {
        & lms unload --all | Out-Null
    } catch {
        Write-Warning "Could not unload LM Studio models before OpenAI preset: $($_.Exception.Message)"
    }
}

$startArgs = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $StartScript,
    "-LlmBaseUrl",
    $(if ($selected.BaseUrl) { $selected.BaseUrl } else { "http://127.0.0.1:1234/v1" }),
    "-LlmApiKey",
    $(if ($selected.Provider -eq "openai") { "__env__" } elseif ($selected.ApiKey) { $selected.ApiKey } else { "none" }),
    "-LlmModel",
    $selected.Model,
    "-NumPipelines",
    "1",
    "-StreamBatchSentences",
    "1",
    "-AudioMaxTokens",
    [string] $selected.AudioMaxTokens,
    "-TtsDtype",
    $TtsDtype
)

if ($selected.Reasoning) {
    $startArgs += @("-ReasoningEffort", $selected.Reasoning)
} else {
    $startArgs += @("-OmitReasoningEffort")
}

$process = Start-Process `
    -FilePath powershell.exe `
    -ArgumentList $startArgs `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -WindowStyle Hidden `
    -PassThru

Write-Host "Restarted Robot 790 realtime backend as $($selected.Label) ($($selected.Model)) process $($process.Id)."
