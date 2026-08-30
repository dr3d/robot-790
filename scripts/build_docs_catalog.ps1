param(
    [string]$DocsDir = "docs"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path $DocsDir
$catalogPath = Join-Path $root "catalog.json"

function Convert-ToSitePath {
    param([string]$Path)
    $rootPath = $root.Path.TrimEnd("\") + "\"
    $fullPath = (Resolve-Path $Path).Path
    if ($fullPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $fullPath.Substring($rootPath.Length).Replace("\", "/")
    }
    return [System.IO.Path]::GetFileName($fullPath)
}

function Get-TitleFromMarkdown {
    param([string]$Path)
    $line = Get-Content -Path $Path -Encoding UTF8 -TotalCount 80 | Where-Object { $_ -match '^#\s+(.+)$' } | Select-Object -First 1
    if ($line) {
        return ($line -replace '^#\s+', '').Trim()
    }
    return [System.IO.Path]::GetFileNameWithoutExtension($Path).Replace("_", " ").Replace("-", " ")
}

function Get-ExcerptFromMarkdown {
    param([string]$Path)
    $lines = Get-Content -Path $Path -Encoding UTF8 -TotalCount 120
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if (-not $trimmed) { continue }
        if ($trimmed.StartsWith("#")) { continue }
        if ($trimmed.StartsWith("---")) { continue }
        if ($trimmed.StartsWith(">")) { continue }
        return ($trimmed -replace '\*\*', '' -replace '\*', '' -replace '`', '').Trim()
    }
    return ""
}

function Get-MediaKind {
    param([string]$Extension)
    switch ($Extension.ToLowerInvariant()) {
        ".jpg" { return "image" }
        ".jpeg" { return "image" }
        ".png" { return "image" }
        ".gif" { return "image" }
        ".webp" { return "image" }
        ".mp4" { return "video" }
        ".webm" { return "video" }
        ".mov" { return "video" }
        ".mp3" { return "audio" }
        ".wav" { return "audio" }
        ".m4a" { return "audio" }
        ".ogg" { return "audio" }
        default { return "file" }
    }
}

$articles = @()
$articleDir = Join-Path $root "articles"
if (Test-Path $articleDir) {
    $articles = Get-ChildItem -Path $articleDir -File -Filter "*.md" |
        Where-Object { $_.Name -ne "README.md" } |
        Sort-Object Name |
        ForEach-Object {
            $source = Convert-ToSitePath $_.FullName
            [ordered]@{
                title = Get-TitleFromMarkdown $_.FullName
                excerpt = Get-ExcerptFromMarkdown $_.FullName
                source = $source
                bytes = $_.Length
            }
        }
}

$logs = @()
$logDir = Join-Path $root "logs"
if (Test-Path $logDir) {
    $logExtensions = @(".txt", ".log", ".md")
    $logs = Get-ChildItem -Path $logDir -File -Recurse |
        Where-Object { $logExtensions -contains $_.Extension.ToLowerInvariant() -and $_.Name -ne "README.md" } |
        Sort-Object LastWriteTime -Descending |
        ForEach-Object {
            [ordered]@{
                title = [System.IO.Path]::GetFileNameWithoutExtension($_.Name).Replace("_", " ").Replace("-", " ")
                source = Convert-ToSitePath $_.FullName
                bytes = $_.Length
                modified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
            }
        }
}

$mediaSearchDirs = @("articles", "media") | ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path $_ }
$media = @()
if ($mediaSearchDirs.Count -gt 0) {
    $mediaExtensions = @(".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".mov", ".mp3", ".wav", ".m4a", ".ogg")
    $media = Get-ChildItem -Path $mediaSearchDirs -File -Recurse |
        Where-Object {
            $sitePath = Convert-ToSitePath $_.FullName
            $mediaExtensions -contains $_.Extension.ToLowerInvariant() -and
            $sitePath -notlike "media/previews/*" -and
            $sitePath -notlike "media/raw-video/*" -and
            $sitePath -notlike "media/rejected/*"
        } |
        Sort-Object Name |
        ForEach-Object {
            $source = Convert-ToSitePath $_.FullName
            $previewName = ([System.IO.Path]::GetFileNameWithoutExtension($_.Name) + ".jpg")
            $previewPath = "media/previews/$previewName"
            $hasPreview = Test-Path (Join-Path $root $previewPath)
            $kind = Get-MediaKind $_.Extension
            [ordered]@{
                title = [System.IO.Path]::GetFileNameWithoutExtension($_.Name).Replace("_", " ").Replace("-", " ")
                kind = $kind
                source = $source
                preview = $(if ($kind -eq "image") { $source } elseif ($hasPreview) { $previewPath } else { $null })
                bytes = $_.Length
                modified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
            }
        }
}

$catalog = [ordered]@{
    generated = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    articles = @($articles)
    logs = @($logs)
    media = @($media)
}

$json = $catalog | ConvertTo-Json -Depth 6
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($catalogPath, $json, $utf8NoBom)
Write-Host "Wrote $catalogPath"
