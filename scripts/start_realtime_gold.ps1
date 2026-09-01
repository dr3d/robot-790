$ErrorActionPreference = "Stop"

$Launcher = Join-Path $PSScriptRoot "start_realtime_eric_qwen3.ps1"
$Model = "qwen3.8-27b-nvfp4-mtp"
$ContextLength = 131072
$Parallel = 2

function Stop-StaleQwen27Backend {
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

try {
    & lms unload --all | Out-Null
    Stop-StaleQwen27Backend
    & lms load $Model --parallel $Parallel --context-length $ContextLength --gpu max --identifier $Model -y | Out-Null
    Stop-StaleQwen27Backend
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
