param(
    [int] $DelaySeconds = 1,
    [ValidateSet("qwen27-mtp-vlow", "qwen27", "qwen9", "qwen4", "nemotron30", "openai", "custom")]
    [string] $Preset = "qwen27-mtp-vlow",
    [string] $Model = "",
    [ValidateSet("", "on", "low", "medium", "xhigh", "none")]
    [string] $Reasoning = "none",
    [int] $ContextLength = 131072,
    [int] $Parallel = 0,
    [ValidateSet("default", "on", "off")]
    [string] $Mtp = "default",
    [ValidateSet("", "bfloat16", "float16")]
    [string] $TtsDtype = "",
    [ValidateSet("0.6B", "1.7B")]
    [string] $TtsModelSize = "0.6B"
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
$TtsDtype = & (Join-Path $PSScriptRoot "tts_precision.ps1") -Override $TtsDtype

function Stop-StaleLmStudioBackends {
    param(
        [string] $SelectedModel
    )

    # LM Studio can leave an old llama-server alive even after `lms unload --all`.
    # Kill only the known pre-NVFP4 27B backend when it is not the selected model.
    if ($SelectedModel -eq "qwen/qwen3.8-27b") {
        return
    }

    Get-CimInstance Win32_Process |
        Where-Object {
            $_.Name -eq "llama-server.exe" -and
            $_.CommandLine -match 'lmstudio-community\\Qwen3\.8-27B-GGUF|Qwen3\.8-27B-Q4_K_M\.gguf'
        } |
        ForEach-Object {
            Write-Warning "Stopping stale LM Studio backend $($_.ProcessId): qwen/qwen3.8-27b"
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
}

if (-not (Test-Path $StopScript)) {
    throw "Missing stop script at $StopScript"
}
if (-not (Test-Path $StartScript)) {
    throw "Missing realtime launcher at $StartScript"
}

$presets = @{
    "qwen27-mtp-vlow" = @{
        Label = "Qwen 27B NVFP4"
        Provider = "lmstudio"
        Model = "qwen3.8-27b-nvfp4-mtp"
        LoadModel = "qwen3.8-27b-mtp"
        Reasoning = if ($Reasoning -in @("on", "low", "medium", "xhigh")) { "on" } else { "none" }
        AudioMaxTokens = 64
        ContextLength = 131072
        Parallel = 2
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
    $Parallel = if ($Parallel -gt 0) { [Math]::Max(1, [Math]::Min(8, $Parallel)) } else { 2 }
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

# A context selected in STS applies to named local presets as well as Custom.
if ($selected.Provider -eq "lmstudio" -and $PSBoundParameters.ContainsKey("ContextLength")) {
    $selected.ContextLength = [Math]::Max(4096, [Math]::Min(262144, $ContextLength))
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# An API identifier assigned at load time need not be an installed model key.
$modelToLoad = if ($selected.LoadModel) { $selected.LoadModel } else { $selected.Model }
if ($selected.Provider -eq "lmstudio") {
    $catalogJson = & lms ls --json
    if ($LASTEXITCODE -ne 0) { throw "Could not read LM Studio's model catalogue; realtime has not been stopped." }
    $catalog = @($catalogJson | ConvertFrom-Json)
    if (-not ($catalog | Where-Object { $_.modelKey -eq $modelToLoad })) {
        throw "Installed model key '$modelToLoad' was not found. Use a key from lms ls. Realtime has not been stopped."
    }
}

$TtsModelDirectory = if ($env:ROBOT_790_TTS_MODEL_DIR) {
    $env:ROBOT_790_TTS_MODEL_DIR
} else {
    Join-Path $env:USERPROFILE "ComfyUI_windows_portable\ComfyUI\models\TTS"
}
$TtsModelPath = Join-Path $TtsModelDirectory "Qwen3-TTS-12Hz-$TtsModelSize-CustomVoice"
if (-not (Test-Path -LiteralPath (Join-Path $TtsModelPath "config.json")) -or
    -not (Get-ChildItem -LiteralPath $TtsModelPath -Filter '*.safetensors' -File -ErrorAction SilentlyContinue)) {
    throw "Speech model $TtsModelSize is not installed at $TtsModelPath. Realtime has not been stopped."
}

& $StopScript -RealtimeOnly
if ($DelaySeconds -gt 0) {
    Start-Sleep -Seconds $DelaySeconds
}

$Python = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$SelectedBaseUrl = if ($selected.BaseUrl) { $selected.BaseUrl } else { "http://127.0.0.1:1234/v1" }
& $Python -m robot_790d.runtime_model --model $selected.Model --base-url $SelectedBaseUrl
if ($LASTEXITCODE -ne 0) { throw "Could not publish the selected LLM model." }

if ($selected.Provider -eq "lmstudio") {
    try {
        $parallelPredictions = if ($selected.Parallel) { [int] $selected.Parallel } else { 1 }
        & lms unload --all | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "LM Studio unload failed." }
        Stop-StaleLmStudioBackends -SelectedModel $selected.Model
        $modelLoadArgs = @("load", $modelToLoad, "--parallel", $parallelPredictions, "--context-length", $selected.ContextLength, "--gpu", "max", "--identifier", $selected.Model, "-y")
        if ($Mtp -eq "on") {
            $modelLoadArgs += "--speculative-draft-mtp"
        } elseif ($Mtp -eq "off") {
            $modelLoadArgs += "--no-speculative-draft-mtp"
        }
        Write-Host "Loading $($selected.Model) with requested MTP setting: $Mtp"
        & lms @modelLoadArgs | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "LM Studio model load failed." }
        Stop-StaleLmStudioBackends -SelectedModel $selected.Model
    } catch {
        throw "Could not switch LM Studio to $($selected.Model): $($_.Exception.Message)"
    }
} else {
    if (-not $selected.ApiKey) {
        throw "OpenAI preset needs OPENAI_API_KEY or ROBOT_790_OPENAI_LLM_API_KEY in .env."
    }
    try {
        & lms unload --all | Out-Null
        Stop-StaleLmStudioBackends -SelectedModel ""
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
    $TtsDtype,
    "-TtsModel",
    ('"{0}"' -f $TtsModelPath)
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
