param(
    [string]$Manifest = "curation/best-bits.json",
    [string]$OutputDir = "curation/best-bits/clips",
    [double]$DefaultLeadInSeconds = -1,
    [double]$DefaultTailOutSeconds = -1,
    [switch]$IncludeRejected
)

$ErrorActionPreference = "Stop"

function Resolve-RepoPath {
    param([string]$Path)
    if ([System.IO.Path]::IsPathRooted($Path)) {
        return (Resolve-Path -LiteralPath $Path).Path
    }
    return (Resolve-Path -LiteralPath (Join-Path (Get-Location) $Path)).Path
}

function Convert-TimecodeToSeconds {
    param([string]$Timecode)
    $value = $Timecode.Trim()
    if ($value -match '^\d+(?:\.\d+)?$') {
        return [double]$value
    }
    $parts = $value -split ':'
    if ($parts.Count -lt 2 -or $parts.Count -gt 3) {
        throw "Invalid timecode '$Timecode'. Use SS, MM:SS, or HH:MM:SS."
    }
    [array]::Reverse($parts)
    $seconds = 0.0
    $multiplier = 1.0
    foreach ($part in $parts) {
        $number = 0.0
        if (-not [double]::TryParse($part, [ref]$number)) {
            throw "Invalid timecode '$Timecode'."
        }
        $seconds += $number * $multiplier
        $multiplier *= 60
    }
    return $seconds
}

function Convert-SecondsToFfmpegTime {
    param([double]$Seconds)
    if ($Seconds -lt 0) {
        $Seconds = 0
    }
    $whole = [math]::Floor($Seconds)
    $millis = [math]::Round(($Seconds - $whole) * 1000)
    $hours = [math]::Floor($whole / 3600)
    $minutes = [math]::Floor(($whole % 3600) / 60)
    $secs = $whole % 60
    return "{0:00}:{1:00}:{2:00}.{3:000}" -f $hours, $minutes, $secs, $millis
}

function Convert-ToSafeName {
    param([string]$Value)
    $safe = ($Value -replace '[^A-Za-z0-9._-]+', '-').Trim('-')
    if (-not $safe) {
        return "clip"
    }
    return $safe.ToLowerInvariant()
}

$manifestPath = Resolve-RepoPath $Manifest
$repoRoot = (Resolve-Path -LiteralPath ".").Path
$outputRoot = Join-Path $repoRoot $OutputDir
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$manifestData = Get-Content -LiteralPath $manifestPath -Encoding UTF8 -Raw | ConvertFrom-Json
$manifestLeadIn = 2.0
$manifestTailOut = 3.0
if ($null -ne $manifestData.default_lead_in_seconds) {
    $manifestLeadIn = [double]$manifestData.default_lead_in_seconds
}
if ($null -ne $manifestData.default_tail_out_seconds) {
    $manifestTailOut = [double]$manifestData.default_tail_out_seconds
}
if ($DefaultLeadInSeconds -ge 0) {
    $manifestLeadIn = $DefaultLeadInSeconds
}
if ($DefaultTailOutSeconds -ge 0) {
    $manifestTailOut = $DefaultTailOutSeconds
}
$entries = @($manifestData.entries)
if (-not $entries.Count) {
    Write-Host "No best-bit entries found in $Manifest"
    exit 0
}

$cutManifest = @()
$index = 0
foreach ($entry in $entries) {
    $status = ""
    if ($null -ne $entry.status) {
        $status = [string]$entry.status
    }
    if (-not $IncludeRejected -and $status -eq "rejected") {
        continue
    }

    $sourceVideo = ""
    $startCode = ""
    $endCode = ""
    if ($null -ne $entry.source_video) {
        $sourceVideo = [string]$entry.source_video
    }
    if ($null -ne $entry.start) {
        $startCode = [string]$entry.start
    }
    if ($null -ne $entry.end) {
        $endCode = [string]$entry.end
    }
    if (-not $sourceVideo -or -not $startCode -or -not $endCode) {
        Write-Warning "Skipping entry without source_video/start/end: $($entry.id)"
        continue
    }

    $sourcePath = Resolve-RepoPath $sourceVideo
    $leadIn = $manifestLeadIn
    $tailOut = $manifestTailOut
    if ($null -ne $entry.lead_in_seconds) {
        $leadIn = [double]$entry.lead_in_seconds
    }
    if ($null -ne $entry.tail_out_seconds) {
        $tailOut = [double]$entry.tail_out_seconds
    }

    $markedStartSeconds = Convert-TimecodeToSeconds $startCode
    $markedEndSeconds = Convert-TimecodeToSeconds $endCode
    $startSeconds = [math]::Max(0, $markedStartSeconds - [math]::Max(0, $leadIn))
    $endSeconds = $markedEndSeconds + [math]::Max(0, $tailOut)
    $duration = $endSeconds - $startSeconds
    if ($duration -le 0) {
        Write-Warning "Skipping entry with non-positive duration: $($entry.id)"
        continue
    }

    $index += 1
    $rawId = "clip-$index"
    if ($null -ne $entry.id) {
        $rawId = [string]$entry.id
    }
    $rawTitle = $rawId
    if ($null -ne $entry.title) {
        $rawTitle = [string]$entry.title
    }
    $id = Convert-ToSafeName $rawId
    $title = Convert-ToSafeName $rawTitle
    $outputName = "{0:000}-{1}-{2}.mp4" -f $index, $id, $title
    $outputPath = Join-Path $outputRoot $outputName

    $startText = Convert-SecondsToFfmpegTime $startSeconds
    $durationText = Convert-SecondsToFfmpegTime $duration
    & ffmpeg -hide_banner -loglevel error -y -ss $startText -t $durationText -i $sourcePath -c copy $outputPath
    if ($LASTEXITCODE -ne 0) {
        throw "ffmpeg failed for $($entry.id)"
    }

    $cutManifest += [pscustomobject]@{
        id = $entry.id
        title = $entry.title
        source_video = $sourceVideo
        marked_start = $startCode
        marked_end = $endCode
        exported_start_seconds = [math]::Round($startSeconds, 3)
        exported_end_seconds = [math]::Round($endSeconds, 3)
        lead_in_seconds = $leadIn
        tail_out_seconds = $tailOut
        output = $outputPath.Substring($repoRoot.Length + 1).Replace("\", "/")
        why = $entry.why
        publishability = $entry.publishability
        status = $entry.status
    }
}

$cutManifestPath = Join-Path $outputRoot ("cuts-{0}.json" -f (Get-Date).ToString("yyyyMMdd-HHmmss"))
$cutManifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $cutManifestPath -Encoding UTF8
Write-Host "Wrote $index clips to $OutputDir"
Write-Host "Cut manifest: $cutManifestPath"
