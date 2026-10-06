param([string] $Override = "")

# Called after load_env.ps1, before any model unload or process stop.
$Precision = if ($Override) { $Override } else { $env:ROBOT_790_TTS_DTYPE }
if ([string]::IsNullOrWhiteSpace($Precision)) { $Precision = "bfloat16" }
$Precision = $Precision.Trim().ToLowerInvariant()
if ($Precision -notin @("bfloat16", "float16")) {
    throw "ROBOT_790_TTS_DTYPE must be bfloat16 or float16. Realtime has not been stopped."
}
$Precision
