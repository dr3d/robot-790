param(
    [string] $HostAddress = "127.0.0.1",
    [int] $Port = 8765,
    [int] $NumPipelines = 1,
    [int] $StreamBatchSentences = 1,
    [string] $LlmBaseUrl = "http://127.0.0.1:1234/v1",
    [string] $LlmApiKey = "none",
    [string] $LlmModel = "qwen3.5-4b",
    [ValidateSet("low", "medium", "xhigh")]
    [string] $ReasoningEffort = "low",
    [int] $AudioMaxTokens = 48,
    [string] $TtsModel = "C:\Users\dr3d\ComfyUI_windows_portable\ComfyUI\models\TTS\Qwen3-TTS-12Hz-0.6B-CustomVoice",
    [string] $Speaker = "Eric",
    [string] $TtsInstruct = "Speak as Eric with dry wit, natural pacing, restrained warmth, and crisp articulation.",
    [string] $PromptPath = "",
    [string[]] $ExtraArgs = @()
)

$ErrorActionPreference = "Stop"

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
    "--qwen3_tts_dtype", "bfloat16",
    "--qwen3_tts_attn_implementation", "eager",
    "--qwen3_tts_speaker", $Speaker,
    "--qwen3_tts_instruct", $TtsInstruct,
    "--qwen3_tts_language", "English",
    "--llm_backend", "chat-completions",
    "--responses_api_base_url", $LlmBaseUrl,
    "--responses_api_api_key", $LlmApiKey,
    "--responses_api_reasoning_effort", $ReasoningEffort,
    "--responses_api_audio_max_tokens", $AudioMaxTokens,
    "--model_name", $LlmModel,
    "--init_chat_prompt", $SystemPrompt
)

if ($ExtraArgs.Count -gt 0) {
    $qwenArgs += $ExtraArgs
}

Write-Host "Starting Robot 790 realtime voice with Qwen3-TTS speaker $Speaker"
Write-Host "LLM model: $LlmModel"
Write-Host "LLM reasoning effort: $ReasoningEffort"
Write-Host "LLM audio max tokens: $AudioMaxTokens"
Write-Host "TTS model: $TtsModel"
Write-Host "TTS instruct: $TtsInstruct"
Write-Host "Prompt: $PromptPath"
& $Launcher -HostAddress $HostAddress -Port $Port -NumPipelines $NumPipelines -StreamBatchSentences $StreamBatchSentences -ExtraArgs $qwenArgs
