$ErrorActionPreference = "Stop"

$Launcher = Join-Path $PSScriptRoot "start_realtime_eric_qwen3.ps1"

& $Launcher `
    -LlmModel "qwen/qwen3.8-27b" `
    -ReasoningEffort "low" `
    -NumPipelines 1 `
    -StreamBatchSentences 1 `
    -AudioMaxTokens 64 `
    -Speaker "Eric" `
    -TtsInstruct "Speak as Eric with dry wit, natural pacing, restrained warmth, and crisp articulation."
