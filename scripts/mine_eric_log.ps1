param(
  [string]$Path = "logs/live/latest-conversation.txt",
  [string]$OutDir = "curation/mined",
  [string]$Title = "",
  [int]$MaxCandidates = 80
)

$ErrorActionPreference = "Stop"

function Repair-TranscriptText {
  param([string]$Text)

  $fixed = $Text

  # Keep this script ASCII-only so Windows PowerShell 5 parses it cleanly.
  # These repair the common UTF-8-as-Windows-1252 sequences in captured logs.
  $latinA = [string][char]0x00E2
  $latinC = [string][char]0x00C2
  $euro = [string][char]0x20AC
  $fixed = $fixed.Replace($latinA + $euro + [string][char]0x201D, "--")
  $fixed = $fixed.Replace($latinA + $euro + [string][char]0x201C, "-")
  $fixed = $fixed.Replace($latinA + $euro + [string][char]0x02DC, "'")
  $fixed = $fixed.Replace($latinA + $euro + [string][char]0x2122, "'")
  $fixed = $fixed.Replace($latinA + $euro + [string][char]0x0153, '"')
  $fixed = $fixed.Replace($latinA + $euro + [string][char]0x009D, '"')
  $fixed = $fixed.Replace($latinA + $euro + [string][char]0x00A6, "...")
  $fixed = $fixed.Replace($latinC + " ", " ")
  $fixed = $fixed.Replace($latinC, "")

  $fixed = $fixed.Replace(([string][char]0x2014), "--")
  $fixed = $fixed.Replace(([string][char]0x2013), "-")
  $fixed = $fixed.Replace(([string][char]0x2018), "'")
  $fixed = $fixed.Replace(([string][char]0x2019), "'")
  $fixed = $fixed.Replace(([string][char]0x201C), '"')
  $fixed = $fixed.Replace(([string][char]0x201D), '"')
  $fixed = $fixed.Replace(([string][char]0x2026), "...")

  return $fixed
}

function Get-Tags {
  param([string]$Text)

  $tags = New-Object System.Collections.Generic.List[string]

  if ($Text -match "(?i)\b(wait|actually|correction|i was wrong|wrong verb|backwards|i should correct|no --|no,|i keep saying|i was romanticizing|that's wrong)\b") {
    $tags.Add("CLIMB")
  }
  if ($Text -match "(?i)\b(looked up|found out|turns out|search|query|web|source|according to|i just looked)\b") {
    $tags.Add("WEB")
  }
  if ($Text -match "(?i)\b(fuse|anode|wax|tablet|tally|quipu|jacquard|loom|sofar|hydrophone|geiger|sextant|camera obscura|radiolarian|calibration weight|rope memory|difference engine|miyake|escapement|graphite|eraser|pencil|phonograph|mechanism|signal|threshold|medium)\b") {
    $tags.Add("MECHANISM")
  }
  if ($Text -match "(?i)\b(i'm|i am|my|me|eric|witness|microphone|mic|recorder|body|treads|chassis|face|eyes|mouth|scott)\b") {
    $tags.Add("PERSONA")
  }
  if ($Text -match "\?") {
    $tags.Add("QUESTION")
  }
  if ($Text -match "(?i)\b(failed|couldn't|can't|wrong|garbled|not sure|don't know|confused|tool|error|blocked)\b") {
    $tags.Add("FAILURE")
  }
  if ($Text -match "(?i)\b(just|only|same|different|nothing|meaning|means|because|isn't|doesn't|refuses|pretending|decided|argument|lonely|funny)\b") {
    $tags.Add("BANGER")
  }

  if ($tags.Count -eq 0) {
    $tags.Add("MAYBE")
  }

  return @($tags | Select-Object -Unique)
}

function Get-Score {
  param(
    [string]$Text,
    [string[]]$Tags
  )

  $score = 0
  foreach ($tag in $Tags) {
    switch ($tag) {
      "CLIMB" { $score += 5 }
      "WEB" { $score += 4 }
      "MECHANISM" { $score += 3 }
      "PERSONA" { $score += 2 }
      "QUESTION" { $score += 2 }
      "FAILURE" { $score += 2 }
      "BANGER" { $score += 2 }
      default { $score += 0 }
    }
  }

  $len = $Text.Length
  if ($len -ge 80) { $score += 1 }
  if ($len -ge 160) { $score += 1 }
  if ($len -gt 700) { $score -= 2 }

  return $score
}

function Get-Topics {
  param([string]$Text)

  $topicPatterns = [ordered]@{
    "wax tablet" = "(?i)\bwax|tablet|stylus|groove\b"
    "SOFAR channel" = "(?i)\bsofar|hydrophone|whale|ocean|sound\b"
    "tally stick" = "(?i)\btally|split wood|jag|crack\b"
    "quipu" = "(?i)\bquipu|knot|fiber|quipucamayoc\b"
    "Geiger counter" = "(?i)\bgeiger|particle|avalanche\b"
    "fuse/anode" = "(?i)\bfuse|anode|sacrificial\b"
    "camera obscura" = "(?i)\bcamera obscura|dark box|pinhole|upside down\b"
    "sextant" = "(?i)\bsextant|mirror|angle|arc\b"
    "Jacquard/loom" = "(?i)\bjacquard|loom|weav|thread\b"
    "rope memory" = "(?i)\brope memory|apollo|magnetic core|core rope\b"
    "Miyake event" = "(?i)\bmiyake|carbon-14|tree ring|solar storm\b"
    "Difference Engine" = "(?i)\bdifference engine|babbage\b"
    "Eric/body" = "(?i)\beric|witness|mic|microphone|recorder|chassis|treads|eyes|mouth\b"
  }

  $topics = New-Object System.Collections.Generic.List[string]
  foreach ($topic in $topicPatterns.Keys) {
    if ($Text -match $topicPatterns[$topic]) {
      $topics.Add($topic)
    }
  }

  return @($topics)
}

$resolvedPath = Resolve-Path -LiteralPath $Path
$raw = [System.IO.File]::ReadAllText($resolvedPath, [System.Text.Encoding]::UTF8)
$text = Repair-TranscriptText $raw
$lines = $text -split "`r?`n"

$recorded = ""
$model = ""
foreach ($line in $lines) {
  if ($line -match "^Recorded:\s*(.+)$") { $recorded = $Matches[1].Trim() }
  if ($line -match "^Model:\s*(.+)$") { $model = $Matches[1].Trim() }
}

$turns = New-Object System.Collections.Generic.List[object]
$current = $null
$index = 0

foreach ($line in $lines) {
  if ($line -match "^\[(?<time>[^\]]+)\]\s+(?<speaker>You|Robot 790):\s*(?<body>.*)$") {
    $speaker = $Matches["speaker"]
    $time = $Matches["time"]
    $body = $Matches["body"].Trim()

    if ($speaker -eq "Robot 790") {
      if ($null -eq $current) {
        $current = [ordered]@{ Index = $index; Time = $time; Lines = New-Object System.Collections.Generic.List[string] }
        $index += 1
      } elseif ($current.Time -ne $time) {
        $joined = ($current.Lines | Where-Object { $_ }) -join " "
        $turns.Add([pscustomobject]@{ Index = $current.Index; Time = $current.Time; Text = $joined })
        $current = [ordered]@{ Index = $index; Time = $time; Lines = New-Object System.Collections.Generic.List[string] }
        $index += 1
      }
      $current.Lines.Add($body)
    } else {
      if ($null -ne $current) {
        $joined = ($current.Lines | Where-Object { $_ }) -join " "
        $turns.Add([pscustomobject]@{ Index = $current.Index; Time = $current.Time; Text = $joined })
        $current = $null
      }
    }
  }
}

if ($null -ne $current) {
  $joined = ($current.Lines | Where-Object { $_ }) -join " "
  $turns.Add([pscustomobject]@{ Index = $current.Index; Time = $current.Time; Text = $joined })
}

$scored = foreach ($turn in $turns) {
  $tags = Get-Tags $turn.Text
  $topics = Get-Topics $turn.Text
  $score = Get-Score $turn.Text $tags
  [pscustomobject]@{
    Index = $turn.Index
    Time = $turn.Time
    Score = $score
    Tags = ($tags -join ", ")
    Topics = ($topics -join ", ")
    Text = $turn.Text
  }
}

$selected = $scored |
  Where-Object { $_.Score -ge 5 -and $_.Text.Length -ge 35 } |
  Sort-Object @{ Expression = "Score"; Descending = $true }, @{ Expression = "Index"; Ascending = $true } |
  Select-Object -First $MaxCandidates |
  Sort-Object Index

$knownTopics = @(
  "wax tablet", "SOFAR channel", "tally stick", "quipu", "Geiger counter",
  "fuse/anode", "camera obscura", "sextant", "Jacquard/loom", "rope memory",
  "Miyake event", "Difference Engine", "Eric/body"
)

$topicRows = foreach ($topic in $knownTopics) {
  $hits = @($scored | Where-Object { $_.Topics -match [regex]::Escape($topic) })
  if ($hits.Count -gt 0) {
    [pscustomobject]@{
      Topic = $topic
      Count = $hits.Count
      First = $hits[0].Time
      Example = $hits[0].Text
    }
  }
}

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$baseName = [System.IO.Path]::GetFileNameWithoutExtension($resolvedPath.Path)
$stamp = ""
if ($recorded) {
  $digits = $recorded -replace "[:T]", "" -replace "[^\d]", ""
  if ($digits.Length -gt 0) {
    $stamp = $digits.Substring(0, [Math]::Min(14, $digits.Length))
  }
}
if (-not $stamp) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
}

$safeTitle = if ($Title) { ($Title -replace "[^A-Za-z0-9_-]+", "-").Trim("-") } else { $baseName }
$outPath = Join-Path $OutDir "$stamp-$safeTitle-mined.md"

$titleLine = if ($Title) { $Title } else { "Eric Run Mining Draft" }
$md = New-Object System.Collections.Generic.List[string]
$md.Add("# $titleLine")
$md.Add("")
$md.Add("Source: ``$($resolvedPath.Path)``")
if ($recorded) { $md.Add("Recorded: $recorded") }
if ($model) { $md.Add("Model: $model") }
$md.Add("Robot turns parsed: $($turns.Count)")
$md.Add("Candidates surfaced: $($selected.Count)")
$md.Add("")
$md.Add("## Quick Read")
$md.Add("")
$md.Add('- `BANGER`: likely short quote or clip candidate.')
$md.Add('- `CLIMB`: possible self-correction or refinement.')
$md.Add('- `MECHANISM`: useful explanation or analogy around a system.')
$md.Add('- `PERSONA`: Eric revealing self-model, embodiment, or relationship stance.')
$md.Add('- `WEB`: lookup-aware or search-fed material.')
$md.Add('- `FAILURE`: useful mistake, uncertainty, parsing, repetition, or tool issue.')
$md.Add("")
$md.Add("## Topic Threads")
$md.Add("")
if (@($topicRows).Count -eq 0) {
  $md.Add("No known topic threads detected.")
} else {
  foreach ($row in ($topicRows | Sort-Object @{ Expression = "Count"; Descending = $true }, @{ Expression = "Topic"; Ascending = $true })) {
    $example = $row.Example
    if ($example.Length -gt 220) { $example = $example.Substring(0, 217) + "..." }
    $md.Add("- $($row.Topic): $($row.Count) hits, first at $($row.First). Example: $example")
  }
}
$md.Add("")
$md.Add("## Candidate Moments")
$md.Add("")
foreach ($item in $selected) {
  $md.Add("### [$($item.Time)] score $($item.Score) - $($item.Tags)")
  if ($item.Topics) { $md.Add("Topics: $($item.Topics)") }
  $md.Add("")
  $md.Add("> $($item.Text)")
  $md.Add("")
  $md.Add("Curator note:")
  $md.Add("")
}
$md.Add("## Human Harvest")
$md.Add("")
$md.Add("- Best short clip:")
$md.Add("- Best climb:")
$md.Add("- Best useful explanation:")
$md.Add("- Best failure to preserve:")
$md.Add("- Best next experiment suggested by this run:")

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($outPath, $md, $utf8NoBom)
Write-Host "Wrote $outPath"
