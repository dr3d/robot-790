param(
    [switch] $CaptureLlmWire
)

$ErrorActionPreference = "Stop"

$Launcher = Join-Path $PSScriptRoot "start_realtime_eric_qwen3.ps1"
$Model = "qwen3.8-27b-nvfp4-mtp"
$ContextLength = 131072
$Parallel = 2

. (Join-Path $PSScriptRoot "load_env.ps1") -Quiet
$TtsDtype = & (Join-Path $PSScriptRoot "tts_precision.ps1")

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
    if ($LASTEXITCODE -ne 0) { throw "LM Studio unload failed (exit code $LASTEXITCODE)." }
    Stop-StaleQwen27Backend
    & lms load $Model --parallel $Parallel --context-length $ContextLength --gpu max --identifier $Model -y | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "LM Studio model load failed (exit code $LASTEXITCODE)." }
    Stop-StaleQwen27Backend
} catch {
    throw "Could not preload LM Studio with only $($Model): $($_.Exception.Message)"
}

$launcherArgs = @{
    LlmModel = $Model
    ReasoningEffort = "none"
    NumPipelines = 1
    StreamBatchSentences = 1
    AudioMaxTokens = 64
    TtsDtype = $TtsDtype
    Speaker = "Eric"
    TtsInstruct = "Speak in English as Eric with dry wit, natural pacing, restrained warmth, and crisp articulation."
}
if ($CaptureLlmWire) {
    $launcherArgs.CaptureLlmWire = $true
}

& $Launcher @launcherArgs
