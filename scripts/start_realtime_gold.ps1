$ErrorActionPreference = "Stop"

$Launcher = Join-Path $PSScriptRoot "start_realtime_eric_qwen3.ps1"
$Model = "qwen3.8-27b-nvfp4-mtp"
$ContextLength = 131072
$Parallel = 4

try {
    & lms unload --all | Out-Null
    & lms load $Model --parallel $Parallel --context-length $ContextLength --gpu max --identifier $Model -y | Out-Null
} catch {
    throw "Could not preload LM Studio with only $($Model): $($_.Exception.Message)"
}

& $Launcher `
    -LlmModel $Model `
    -ReasoningEffort "none" `
    -NumPipelines 1 `
    -StreamBatchSentences 1 `
    -AudioMaxTokens 64 `
    -TtsDtype "bfloat16" `
    -Speaker "Eric" `
    -TtsInstruct "Speak as Eric with dry wit, natural pacing, restrained warmth, and crisp articulation."
