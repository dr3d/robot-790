param(
    [string]$DocsDir = "docs"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path $DocsDir
$repositoryRoot = Split-Path -Parent $root.Path
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
        if ($trimmed -match '^!\[[^\]]*\]\([^)]+\)$') { continue }
        return ($trimmed -replace '\*\*', '' -replace '\*', '' -replace '`', '').Trim()
    }
    return ""
}

function New-ArtifactMoment {
    param([datetime]$Value, [string]$Source, [string]$Precision = "timestamp")
    return [pscustomobject]@{
        value = [datetime]::SpecifyKind($Value, [System.DateTimeKind]::Local)
        source = $Source
        precision = $Precision
    }
}

function Convert-ToArtifactMoment {
    param([string]$Value, [string]$Format, [string]$Source, [string]$Precision = "timestamp")
    try {
        $parsed = [datetime]::ParseExact(
            $Value,
            $Format,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [System.Globalization.DateTimeStyles]::None
        )
        return New-ArtifactMoment $parsed $Source $Precision
    } catch {
        return $null
    }
}

function Get-StampedArtifactMoment {
    param([string]$Text)

    if ($Text -match '(?<!\d)(\d{8})[-_T]?(\d{6})(?!\d)') {
        return Convert-ToArtifactMoment "$($Matches[1])$($Matches[2])" "yyyyMMddHHmmss" "filename" "timestamp"
    }
    if ($Text -match '(?<!\d)(\d{4})[-_](\d{2})[-_](\d{2})(?:[-_T ]?(\d{2}):?(\d{2}):?(\d{2}))?(?!\d)') {
        if ($Matches[4]) {
            return Convert-ToArtifactMoment "$($Matches[1])$($Matches[2])$($Matches[3])$($Matches[4])$($Matches[5])$($Matches[6])" "yyyyMMddHHmmss" "filename" "timestamp"
        }
        return Convert-ToArtifactMoment "$($Matches[1])$($Matches[2])$($Matches[3])" "yyyyMMdd" "filename" "date"
    }
    if ($Text -match '(?<!\d)(\d{8})(?!\d)') {
        return Convert-ToArtifactMoment $Matches[1] "yyyyMMdd" "filename" "date"
    }
    return $null
}

function Get-GitAddedArtifactMoment {
    param([System.IO.FileInfo]$File)

    $repoPrefix = $repositoryRoot.TrimEnd('\') + '\'
    $fullPath = $File.FullName
    if (-not $fullPath.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }
    $repoPath = $fullPath.Substring($repoPrefix.Length).Replace('\', '/')
    try {
        $stamps = @(& git -C $repositoryRoot log --follow --diff-filter=A --format=%aI -- $repoPath 2>$null)
        if ($LASTEXITCODE -ne 0) {
            return $null
        }
        $stamp = $stamps | Where-Object { $_ } | Select-Object -Last 1
        if (-not $stamp) {
            return $null
        }
        $parsed = [datetime]::Parse(
            $stamp,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [System.Globalization.DateTimeStyles]::RoundtripKind
        )
        return New-ArtifactMoment $parsed "git-added"
    } catch {
        return $null
    }
}

function Get-CanonicalArtifactMoment {
    param([System.IO.FileInfo]$File)

    $stamped = Get-StampedArtifactMoment $File.Name
    if ($stamped -and $stamped.precision -eq "timestamp") {
        return $stamped
    }
    $gitAdded = Get-GitAddedArtifactMoment $File
    if ($gitAdded) {
        return $gitAdded
    }
    if ($stamped) {
        return $stamped
    }
    return New-ArtifactMoment $File.LastWriteTime "filesystem"
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
    return (Get-CanonicalArtifactMoment $File).value
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

function Get-MediaTitle {
    param([string]$Source, [System.IO.FileInfo]$File)
    if ($null -ne $mediaNotes) {
        $candidates = @($Source, $File.Name)
        foreach ($candidate in $candidates) {
            $entry = $mediaNotes.PSObject.Properties[$candidate]
            if (-not $entry -or $entry.Value -is [string]) {
                continue
            }
            $title = $entry.Value.PSObject.Properties["title"]
            if ($title -and $title.Value) {
                return ([string]$title.Value).Trim()
            }
        }
    }
    return Get-FriendlyMediaTitle $File
}

function Get-MediaArtifactMoment {
    param([string]$Source, [System.IO.FileInfo]$File)

    if ($null -ne $mediaNotes) {
        $candidates = @($Source, $File.Name)
        foreach ($candidate in $candidates) {
            $entry = $mediaNotes.PSObject.Properties[$candidate]
            if (-not $entry -or $entry.Value -is [string]) {
                continue
            }
            $published = $entry.Value.PSObject.Properties["published"]
            if (-not $published -or -not $published.Value) {
                continue
            }
            try {
                $parsed = [datetime]::Parse(
                    [string]$published.Value,
                    [System.Globalization.CultureInfo]::InvariantCulture,
                    [System.Globalization.DateTimeStyles]::RoundtripKind
                )
                return New-ArtifactMoment $parsed "metadata"
            } catch {
                throw "Invalid published timestamp for $Source in media/run-notes.json."
            }
        }
    }
    return Get-CanonicalArtifactMoment $File
}

function Get-PublicLogStem {
    param([System.IO.FileInfo]$File)
    $base = [System.IO.Path]::GetFileNameWithoutExtension($File.Name)
    return $base -replace "[-_](conversation|events|brain2_mulling|session|recording_stop_report)$", ""
}

$articles = @()
$articleDir = Join-Path $root "articles"
if (Test-Path $articleDir) {
    $articles = @(
        Get-ChildItem -Path $articleDir -File -Filter "*.md" |
        Where-Object { $_.Name -ne "README.md" } |
        ForEach-Object {
            $moment = Get-CanonicalArtifactMoment $_
            $source = Convert-ToSitePath $_.FullName
            [ordered]@{
                title = Get-TitleFromMarkdown $_.FullName
                excerpt = Get-ExcerptFromMarkdown $_.FullName
                source = $source
                bytes = $_.Length
                published = $moment.value.ToString("yyyy-MM-dd HH:mm")
                published_sort = $moment.value.ToString("yyyyMMddHHmmss")
                published_source = $moment.source
                modified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
            }
        } |
        Sort-Object @{ Expression = { $_.published_sort }; Descending = $true },
                    @{ Expression = { $_.source }; Descending = $false }
    )
}

$logs = @()
$logDir = Join-Path $root "logs"
if (Test-Path $logDir) {
    $logExtensions = @(".txt", ".log", ".md")
    $logs = @(
        Get-ChildItem -Path $logDir -File -Recurse |
        Where-Object { $logExtensions -contains $_.Extension.ToLowerInvariant() -and $_.Name -ne "README.md" } |
        Group-Object { Get-PublicLogStem $_ } |
        ForEach-Object {
            $_.Group |
                ForEach-Object {
                    [pscustomobject]@{
                        file = $_
                        moment = Get-CanonicalArtifactMoment $_
                    }
                } |
                Sort-Object @{ Expression = { $_.moment.value }; Descending = $true },
                            @{ Expression = { $_.file.Length }; Descending = $true },
                            @{ Expression = { $_.file.Name }; Descending = $true } |
                Select-Object -First 1
        } |
        ForEach-Object {
            $file = $_.file
            $moment = $_.moment
            [ordered]@{
                title = [System.IO.Path]::GetFileNameWithoutExtension($file.Name).Replace("_", " ").Replace("-", " ")
                source = Convert-ToSitePath $file.FullName
                bytes = $file.Length
                published = $moment.value.ToString("yyyy-MM-dd HH:mm")
                published_sort = $moment.value.ToString("yyyyMMddHHmmss")
                published_source = $moment.source
                modified = $file.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
            }
        } |
        Sort-Object @{ Expression = { $_.published_sort }; Descending = $true },
                    @{ Expression = { $_.source }; Descending = $false }
    )
}

$mediaSearchDirs = @("articles", "media") | ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path $_ }
$media = @()
if ($mediaSearchDirs.Count -gt 0) {
    $mediaExtensions = @(".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".mov", ".mp3", ".wav", ".m4a", ".ogg")
    $media = @(
        Get-ChildItem -Path $mediaSearchDirs -File -Recurse |
        Where-Object {
            $sitePath = Convert-ToSitePath $_.FullName
            $mediaExtensions -contains $_.Extension.ToLowerInvariant() -and
            $sitePath -notlike "media/previews/*" -and
            $sitePath -notlike "media/raw-video/*" -and
            $sitePath -notlike "media/rejected/*"
        } |
        ForEach-Object {
            $source = Convert-ToSitePath $_.FullName
            $moment = Get-MediaArtifactMoment $source $_
            $previewName = ([System.IO.Path]::GetFileNameWithoutExtension($_.Name) + ".jpg")
            $previewPath = "media/previews/$previewName"
            $hasPreview = Test-Path (Join-Path $root $previewPath)
            $kind = Get-MediaKind $_.Extension
            $role = Get-MediaRole $_ $source $kind
            $mediaDate = $moment.value
            $description = Get-MediaDescription $source $_
            $item = [ordered]@{
                title = Get-MediaTitle $source $_
                kind = $kind
                role = $role
                source = $source
                preview = $(if ($kind -eq "image") { $source } elseif ($hasPreview) { $previewPath } else { $null })
                banner_rank = Get-BannerRank $role $kind
                bytes = $_.Length
                date = $mediaDate.ToString("yyyy-MM-dd HH:mm")
                published = $moment.value.ToString("yyyy-MM-dd HH:mm")
                published_sort = $moment.value.ToString("yyyyMMddHHmmss")
                published_source = $moment.source
                modified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
            }
            if ($description) {
                $item.description = $description
            }
            if ($null -ne $mediaNotes) {
                $entry = $mediaNotes.PSObject.Properties[$source]
                if ($entry -and $entry.Value -isnot [string]) {
                    $article = $entry.Value.PSObject.Properties["article"]
                    if ($article -and $article.Value) {
                        if ($articles.source -notcontains [string]$article.Value) {
                            throw "Related article for $source is not on the public article shelf: $($article.Value)"
                        }
                        $item.article = [string]$article.Value
                    }
                }
            }
            $item
        } |
        Sort-Object @{ Expression = { $_.published_sort }; Descending = $true },
                    @{ Expression = { $_.source }; Descending = $false }
    )
}

function Update-PublicArticleIndex {
    param([object[]]$Articles)

    $indexPath = Join-Path $root "index.md"
    if (-not (Test-Path $indexPath)) {
        return
    }
    $startMarker = "<!-- generated-articles:start -->"
    $endMarker = "<!-- generated-articles:end -->"
    $content = Get-Content -Path $indexPath -Encoding UTF8 -Raw
    $start = $content.IndexOf($startMarker, [System.StringComparison]::Ordinal)
    $end = $content.IndexOf($endMarker, [System.StringComparison]::Ordinal)
    if ($start -lt 0 -or $end -lt $start) {
        return
    }
    $end += $endMarker.Length
    $entries = $Articles | ForEach-Object {
        "- [$($_.title)]($($_.source)) - $($_.published)"
    }
    $replacementLines = @(
        $startMarker,
        "Articles are listed newest first by their published artifact time.",
        ""
    ) + @($entries) + @(
        "",
        $endMarker
    )
    $replacement = $replacementLines -join "`n"
    $updated = $content.Substring(0, $start) + $replacement + $content.Substring($end)
    if ($updated -ne $content) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($indexPath, $updated, $utf8NoBom)
    }
}

Update-PublicArticleIndex $articles

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
