param(
  [Parameter(Mandatory = $true)]
  [string] $Text,

  [ValidateSet("user_text", "say_text")]
  [string] $Kind = "user_text",

  [string] $PageUrl = "http://127.0.0.1:8790",

  [string] $Source = "codex"
)

$ErrorActionPreference = "Stop"

$uri = ($PageUrl.TrimEnd("/") + "/api/operator/enqueue")
$payload = @{
  text = $Text
  kind = $Kind
  source = $Source
} | ConvertTo-Json -Depth 4

$result = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $payload

Write-Host "Queued operator command $($result.command.seq) [$($result.command.kind)] from $($result.command.source)."
