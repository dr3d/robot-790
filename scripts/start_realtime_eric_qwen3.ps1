param(
    [string] $HostAddress = "127.0.0.1",
    [int] $Port = 8765,
    [int] $NumPipelines = 1,
    [int] $StreamBatchSentences = 1,
    [string] $LlmBaseUrl = "http://127.0.0.1:1234/v1",
    [string] $LlmApiKey = "none",
    [string] $LlmModel = "qwen/qwen3.8-27b",
    [ValidateSet("", "low", "medium", "xhigh", "none")]
    [string] $ReasoningEffort = "low",
    [switch] $OmitReasoningEffort,
    [int] $AudioMaxTokens = 64,
    [int] $TextMaxTokens = 0,
    [string] $TtsModel = "C:\Users\dr3d\ComfyUI_windows_portable\ComfyUI\models\TTS\Qwen3-TTS-12Hz-0.6B-CustomVoice",
    [ValidateSet("bfloat16", "float16")]
    [string] $TtsDtype = "bfloat16",
    [string] $Speaker = "Eric",
    [string] $TtsInstruct = "Speak as Eric with dry wit, natural pacing, restrained warmth, and crisp articulation.",
    [string] $PromptPath = "",
    [string[]] $ExtraArgs = @()
)

$ErrorActionPreference = "Stop"

$EnvLoader = Join-Path $PSScriptRoot "load_env.ps1"
if (Test-Path -LiteralPath $EnvLoader) {
    . $EnvLoader -Quiet
}

if ($TextMaxTokens -gt 0) {
    $env:ROBOT_790_TEXT_MAX_TOKENS = [string] $TextMaxTokens
} else {
    Remove-Item Env:\ROBOT_790_TEXT_MAX_TOKENS -ErrorAction SilentlyContinue
}

$Launcher = Join-Path $PSScriptRoot "start_realtime_server.ps1"
if (-not $PromptPath) {
    $PromptPath = Join-Path (Split-Path -Parent $PSScriptRoot) "prompts\robot-790-reachy-no-tools.md"
}
if (-not (Test-Path $PromptPath)) {
    throw "Missing realtime prompt at $PromptPath"
}
$SystemPrompt = (Get-Content -Path $PromptPath -Raw).Trim()
$SystemPrompt = ($SystemPrompt -replace '[\r\n]+', ' ' -replace '"', "'")

$qwenArgs = @(
    "--device", "cuda",
    "--stt", "parakeet-tdt",
    "--tts", "qwen3",
    "--qwen3_tts_model_name", $TtsModel,
    "--qwen3_tts_backend", "torch",
    "--qwen3_tts_device", "cuda",
    "--qwen3_tts_dtype", $TtsDtype,
    "--qwen3_tts_attn_implementation", "eager",
    "--qwen3_tts_speaker", $Speaker,
    "--qwen3_tts_instruct", $TtsInstruct,
    "--qwen3_tts_language", "English",
    "--llm_backend", "chat-completions",
    "--responses_api_base_url", $LlmBaseUrl
)

if ($LlmApiKey -and $LlmApiKey -ne "__env__") {
    $qwenArgs += @("--responses_api_api_key", $LlmApiKey)
}

if ($OmitReasoningEffort) {
    $ReasoningEffort = ""
}

if ($ReasoningEffort) {
    $qwenArgs += @("--responses_api_reasoning_effort", $ReasoningEffort)
}

$qwenArgs += @(
    "--responses_api_audio_max_tokens", $AudioMaxTokens,
    "--model_name", $LlmModel,
    "--init_chat_prompt", $SystemPrompt
)

if ($ExtraArgs.Count -gt 0) {
    $qwenArgs += $ExtraArgs
}

Write-Host "Starting Robot 790 realtime voice with Qwen3-TTS speaker $Speaker"
Write-Host "LLM model: $LlmModel"
if ($ReasoningEffort) {
    Write-Host "LLM reasoning effort: $ReasoningEffort"
} else {
    Write-Host "LLM reasoning effort: omitted; using chat_template_kwargs.enable_thinking=false"
}
Write-Host "LLM audio max tokens: $AudioMaxTokens"
if ($TextMaxTokens -gt 0) {
    Write-Host "LLM text max tokens: $TextMaxTokens"
} else {
    Write-Host "LLM text max tokens: unlimited"
}
Write-Host "TTS model: $TtsModel"
Write-Host "TTS precision: $TtsDtype"
Write-Host "TTS instruct: $TtsInstruct"
Write-Host "Prompt: $PromptPath"
& $Launcher -HostAddress $HostAddress -Port $Port -NumPipelines $NumPipelines -StreamBatchSentences $StreamBatchSentences -ExtraArgs $qwenArgs
