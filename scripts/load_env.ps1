param(
    [string] $Path = "",
    [switch] $Quiet
)

$ErrorActionPreference = "Stop"

if (-not $Path) {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
    $Path = Join-Path $RepoRoot ".env"
}

if (-not (Test-Path -LiteralPath $Path)) {
    if (-not $Quiet) {
        Write-Host "No .env file found at $Path"
    }
    return
}

$Loaded = 0
foreach ($Line in Get-Content -LiteralPath $Path) {
    $Trimmed = $Line.Trim()
    if (-not $Trimmed -or $Trimmed.StartsWith("#")) {
        continue
    }
    if ($Trimmed -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
        continue
    }

    $Name = $Matches[1]
    $Value = $Matches[2].Trim()
    if (($Value.StartsWith('"') -and $Value.EndsWith('"')) -or ($Value.StartsWith("'") -and $Value.EndsWith("'"))) {
        $Value = $Value.Substring(1, $Value.Length - 2)
    }

    Set-Item -Path "Env:$Name" -Value $Value
    $Loaded += 1
}

if (-not $Quiet) {
    Write-Host "Loaded $Loaded environment setting(s) from $Path"
}
