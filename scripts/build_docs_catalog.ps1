param(
    [string]$DocsDir = "docs"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path $DocsDir
$catalogPath = Join-Path $root "catalog.json"
$mediaNotesPath = Join-Path $root "media/run-notes.json"
$mediaNotes = $null
if (Test-Path $mediaNotesPath) {
    $mediaNotes = Get-Content -Path $mediaNotesPath -Encoding UTF8 -Raw | ConvertFrom-Json
}

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

function Get-DateLabelFromStamp {
    param([string]$Date, [string]$Time)
    if ($Date.Length -ne 8 -or $Time.Length -ne 6) {
        return ""
    }
    return "$($Date.Substring(0,4))-$($Date.Substring(4,2))-$($Date.Substring(6,2)) $($Time.Substring(0,2)):$($Time.Substring(2,2)):$($Time.Substring(4,2))"
}

function Get-FriendlyMediaTitle {
    param([System.IO.FileInfo]$File)
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($File.Name)

    if ($stem -match '^VID(\d{8})(\d{6})$') {
        return "Robot 790 Video $(Get-DateLabelFromStamp $Matches[1] $Matches[2])"
    }
    if ($stem -match '^IMG(\d{8})(\d{6})$') {
        return "Robot 790 Image $(Get-DateLabelFromStamp $Matches[1] $Matches[2])"
    }
    if ($stem -match '^Gemini[_ -]Generated[_ -]Image') {
        return "Generated Image $($File.LastWriteTime.ToString("yyyy-MM-dd HH:mm"))"
    }
    if ($stem -match '^NapEdge-(\d{4})-(\d{2})-(\d{2})-Audio-Rumination$') {
        return "NapEdge Audio Rumination $($Matches[1])-$($Matches[2])-$($Matches[3])"
    }
    if ($stem -match '^(.*)-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})$') {
        $label = $Matches[1] -replace '[_-]+', ' '
        $label = $label -replace '\s+', ' '
        return "$($label.Trim()) $($Matches[2])-$($Matches[3])-$($Matches[4]) $($Matches[5]):$($Matches[6]):$($Matches[7])"
    }
    if ($stem -match '^(.*)-(\d{4})-(\d{2})-(\d{2})$') {
        $label = $Matches[1] -replace '[_-]+', ' '
        $label = $label -replace '\s+', ' '
        return "$($label.Trim()) $($Matches[2])-$($Matches[3])-$($Matches[4])"
    }

    $title = $stem -replace '[_-]+', ' '
    $title = $title -replace '\s+', ' '
    return $title.Trim()
}

function Get-MediaDate {
    param([System.IO.FileInfo]$File)
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($File.Name)
    if ($stem -match '^(?:VID|IMG)(\d{8})(\d{6})$') {
        return [datetime]::ParseExact("$($Matches[1])$($Matches[2])", "yyyyMMddHHmmss", $null)
    }
    if ($stem -match '(\d{4})-(\d{2})-(\d{2})(?:-(\d{2})(\d{2})(\d{2}))?') {
        $time = if ($Matches[4]) { "$($Matches[4])$($Matches[5])$($Matches[6])" } else { "000000" }
        return [datetime]::ParseExact("$($Matches[1])$($Matches[2])$($Matches[3])$time", "yyyyMMddHHmmss", $null)
    }
    return $File.LastWriteTime
}

function Get-MediaRole {
    param([System.IO.FileInfo]$File, [string]$Source, [string]$Kind)
    $haystack = "$Source $($File.Name)"
    if ($haystack -match '(?i)(embodiment|s3.face|mini.face|mask|waveshare|robot.790|eric.s3)') {
        return "embodiment"
    }
    if ($haystack -match '(?i)(generated.image|gemini|image.generation)') {
        return "generated-image"
    }
    if ($haystack -match '(?i)(napedge|rumination|conversation|run)') {
        return "run-artifact"
    }
    if ($Kind -eq "video") {
        return "video"
    }
    if ($Kind -eq "audio") {
        return "audio"
    }
    if ($Kind -eq "image") {
        return "image"
    }
    return "file"
}

function Get-BannerRank {
    param([string]$Role, [string]$Kind)
    if ($Kind -eq "image" -and $Role -eq "embodiment") { return 100 }
    if ($Kind -eq "image" -and $Role -eq "run-artifact") { return 80 }
    if ($Kind -eq "image" -and $Role -eq "generated-image") { return 60 }
    if ($Kind -eq "image") { return 70 }
    if ($Kind -eq "video" -and $Role -eq "run-artifact") { return 55 }
    if ($Kind -eq "video") { return 45 }
    if ($Role -eq "generated-image") { return 35 }
    return 10
}

function Get-MediaDescription {
    param([string]$Source, [System.IO.FileInfo]$File)
    if ($null -eq $mediaNotes) {
        return ""
    }
    $candidates = @($Source, $File.Name)
    foreach ($candidate in $candidates) {
        $entry = $mediaNotes.PSObject.Properties[$candidate]
        if (-not $entry) {
            continue
        }
        if ($entry.Value -is [string]) {
            return $entry.Value.Trim()
        }
        $description = $entry.Value.PSObject.Properties["description"]
        if ($description -and $description.Value) {
            return ([string]$description.Value).Trim()
        }
    }
    return ""
}

$articles = @()
$articleDir = Join-Path $root "articles"
if (Test-Path $articleDir) {
    $articles = Get-ChildItem -Path $articleDir -File -Filter "*.md" |
        Where-Object { $_.Name -ne "README.md" } |
        Sort-Object LastWriteTime, Name -Descending |
        ForEach-Object {
            $source = Convert-ToSitePath $_.FullName
            [ordered]@{
                title = Get-TitleFromMarkdown $_.FullName
                excerpt = Get-ExcerptFromMarkdown $_.FullName
                source = $source
                bytes = $_.Length
                modified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
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
        Sort-Object @{ Expression = { Get-MediaDate $_ }; Descending = $true }, @{ Expression = { $_.Name }; Descending = $true } |
        ForEach-Object {
            $source = Convert-ToSitePath $_.FullName
            $previewName = ([System.IO.Path]::GetFileNameWithoutExtension($_.Name) + ".jpg")
            $previewPath = "media/previews/$previewName"
            $hasPreview = Test-Path (Join-Path $root $previewPath)
            $kind = Get-MediaKind $_.Extension
            $role = Get-MediaRole $_ $source $kind
            $mediaDate = Get-MediaDate $_
            $description = Get-MediaDescription $source $_
            $item = [ordered]@{
                title = Get-FriendlyMediaTitle $_
                kind = $kind
                role = $role
                source = $source
                preview = $(if ($kind -eq "image") { $source } elseif ($hasPreview) { $previewPath } else { $null })
                banner_rank = Get-BannerRank $role $kind
                bytes = $_.Length
                date = $mediaDate.ToString("yyyy-MM-dd HH:mm")
                modified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
            }
            if ($description) {
                $item.description = $description
            }
            $item
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
