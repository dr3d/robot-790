param(
  [string]$Url = "http://127.0.0.1:8791/",
  [int]$Width = 220,
  [int]$Height = 360,
  [int]$X = 40,
  [int]$Y = 80
)

$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

$browser = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $browser) {
  throw "Could not find Chrome or Edge."
}

$args = @(
  "--app=$Url",
  "--window-size=$Width,$Height",
  "--window-position=$X,$Y"
)

Start-Process -FilePath $browser -ArgumentList $args
