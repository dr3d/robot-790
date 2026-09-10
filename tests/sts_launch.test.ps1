$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$tokens = $null
$parseErrors = $null
$gold = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $root 'scripts\start_realtime_gold.ps1'), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw $parseErrors[0] }
$target = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $root 'scripts\start_realtime_eric_qwen3.ps1'), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw $parseErrors[0] }

# Exercise the actual forwarding statements with the actual target parameter
# declaration, but never run model preload, process cleanup, or a server.
$forwarding = @($gold.EndBlock.Statements | Where-Object {
    $_.Extent.Text -match '^\$launcherArgs\s*=' -or
    $_.Extent.Text -match '^if\s*\(\$CaptureLlmWire\)' -or
    $_.Extent.Text -match '^&\s*\$Launcher\s+@launcherArgs'
})
if ($forwarding.Count -ne 3) { throw 'Expected the three launcher forwarding statements.' }
$forward = [scriptblock]::Create(($forwarding.Extent.Text -join "`n"))
$Launcher = [scriptblock]::Create($target.ParamBlock.Extent.Text + "`n [pscustomobject]`$PSBoundParameters")
$Model = 'fixture-model'
foreach ($enabled in @($false, $true)) {
    $CaptureLlmWire = $enabled
    $result = & $forward
    if ($result.LlmModel -ne $Model -or $result.ReasoningEffort -ne 'none' -or
        $result.NumPipelines -ne 1 -or $result.StreamBatchSentences -ne 1 -or
        $result.AudioMaxTokens -ne 64 -or $result.TtsDtype -ne 'bfloat16' -or
        $result.Speaker -ne 'Eric' -or $result.TtsInstruct -notmatch '^Speak in English as Eric') {
        throw 'Gold launcher changed or misbound the intended runtime settings.'
    }
    if ([bool]$result.CaptureLlmWire -ne $enabled) { throw 'Capture switch was not forwarded correctly.' }
    Write-Output "PASS: gold launcher forwards named settings (capture=$enabled)."
}
