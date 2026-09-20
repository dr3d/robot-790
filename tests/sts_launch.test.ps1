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

# Run the real preload/forwarding statements with inert substitutes for every
# external action. A nonzero native exit is not a terminating PowerShell error.
$preload = @($gold.EndBlock.Statements | Where-Object {
    $_ -is [System.Management.Automation.Language.TryStatementAst]
})
if ($preload.Count -ne 1) { throw 'Expected one model-preload try/catch block.' }
$start = [scriptblock]::Create($preload[0].Extent.Text + "`n" + ($forwarding.Extent.Text -join "`n"))
$Launcher = [scriptblock]::Create($target.ParamBlock.Extent.Text + "`n `$script:preloadCalls.Add('launch')")
$ContextLength = 131072
$Parallel = 2
$CaptureLlmWire = $false
$previousExitCode = $global:LASTEXITCODE

function lms {
    $operation = $args[0]
    $script:preloadCalls.Add($operation)
    if ($script:preloadCase.MissingCli) { throw 'Fixture: lms command not found.' }
    $global:LASTEXITCODE = if ($operation -eq 'unload') { $script:preloadCase.Unload } else { $script:preloadCase.Load }
}
function Stop-StaleQwen27Backend { $script:preloadCalls.Add('cleanup') }

try {
    foreach ($case in @(
        @{ Name = 'unload failure'; Unload = 7; Load = 0; Calls = 'unload'; Error = 'unload.*7' },
        @{ Name = 'load failure'; Unload = 0; Load = 9; Calls = 'unload,cleanup,load'; Error = 'load.*9' },
        @{ Name = 'missing CLI'; MissingCli = $true; Calls = 'unload'; Error = 'command not found' },
        @{ Name = 'successful preload'; Unload = 0; Load = 0; Calls = 'unload,cleanup,load,cleanup,launch'; Error = '' }
    )) {
        $script:preloadCase = $case
        $script:preloadCalls = [System.Collections.Generic.List[string]]::new()
        $global:LASTEXITCODE = 31
        $failure = ''
        try { & $start } catch { $failure = $_.Exception.Message }
        if (($script:preloadCalls -join ',') -ne $case.Calls) {
            throw "Unexpected startup actions for $($case.Name): $($script:preloadCalls -join ',')"
        }
        if ($case.Error) {
            if ($failure -notmatch $case.Error -or $failure -notmatch 'Could not preload LM Studio') {
                throw "Missing explicit preload failure for $($case.Name): $failure"
            }
        } elseif ($failure) {
            throw "Successful preload unexpectedly failed: $failure"
        }
        Write-Output "PASS: gold startup handles $($case.Name) without live model or server operations."
    }
} finally {
    $global:LASTEXITCODE = $previousExitCode
    Remove-Item Function:\lms
    Remove-Item Function:\Stop-StaleQwen27Backend
}
