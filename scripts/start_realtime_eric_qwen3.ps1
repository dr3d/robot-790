param(
    [string] $HostAddress = "127.0.0.1",
    [int] $Port = 8765,
    [int] $NumPipelines = 1,
    [int] $StreamBatchSentences = 1,
    [string] $LlmBaseUrl = "http://127.0.0.1:1234/v1",
    [string] $LlmApiKey = "none",
    [string] $LlmModel = "qwen3.5-4b",
    [string] $TtsModel = "C:\Users\dr3d\ComfyUI_windows_portable\ComfyUI\models\TTS\Qwen3-TTS-12Hz-0.6B-CustomVoice",
    [string] $Speaker = "Eric",
    [string[]] $ExtraArgs = @()
)

$ErrorActionPreference = "Stop"

$Launcher = Join-Path $PSScriptRoot "start_realtime_server.ps1"

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
    "--qwen3_tts_language", "English",
    "--llm_backend", "responses-api",
    "--responses_api_base_url", $LlmBaseUrl,
    "--responses_api_api_key", $LlmApiKey,
    "--model_name", $LlmModel,
    "--init_chat_prompt", "You are Robot 790, a concise local voice interface for an animatronic robot head. Speak in short, vivid replies. Prefer one or two sentences."
)

if ($ExtraArgs.Count -gt 0) {
    $qwenArgs += $ExtraArgs
}

Write-Host "Starting Robot 790 realtime voice with Qwen3-TTS speaker $Speaker"
Write-Host "TTS model: $TtsModel"
& $Launcher -HostAddress $HostAddress -Port $Port -NumPipelines $NumPipelines -StreamBatchSentences $StreamBatchSentences -ExtraArgs $qwenArgs
