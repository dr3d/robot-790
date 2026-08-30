param(
  [string]$Source = "logs/audio/20260830-021634-sts-audio-source.webm",
  [string]$Manifest = "curation/clip-manifests/nap-edge-quips-2026-08-30.csv",
  [string]$ConversationLog = "logs/live/20260830-021635-conversation.txt",
  [string]$OutPath = "curation/audio/nap-edge-quips-2026-08-30.mp3",
  [string]$RecordingEnd = "2026-08-30T02:16:34",
  [double]$FadeSeconds = 1.0,
  [double]$GapSeconds = 0.65,
  [ValidateSet("silence", "manifest", "transcript")]
  [string]$DurationMode = "silence",
  [double]$AutoTailSeconds = 0.35,
  [double]$MinAutoDurationSeconds = 6.0,
  [double]$MaxAutoDurationSeconds = 45.0,
  [double]$SilenceSeconds = 1.15,
  [string]$SilenceThreshold = "-45dB"
)

$ErrorActionPreference = "Stop"
$InvariantCulture = [System.Globalization.CultureInfo]::InvariantCulture

function Get-MediaDurationSeconds {
  param([string]$Path)

  $durationText = & ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $Path
  if ($LASTEXITCODE -ne 0) {
    throw "ffprobe failed for $Path"
  }

  $duration = 0.0
  if ([double]::TryParse(($durationText | Select-Object -First 1), [ref]$duration)) {
    return $duration
  }

  $lastPacket = & ffprobe -v error -select_streams a:0 -show_entries packet=pts_time -of csv=p=0 $Path | Select-Object -Last 1
  if (-not [double]::TryParse($lastPacket, [ref]$duration)) {
    throw "Could not read media duration for $Path"
  }

  return $duration
}

function Get-AudioSampleRate {
  param([string]$Path)

  $sampleRateText = & ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of default=noprint_wrappers=1:nokey=1 $Path
  if ($LASTEXITCODE -ne 0) {
    throw "ffprobe failed while reading sample rate for $Path"
  }

  $sampleRate = 0
  if (-not [int]::TryParse(($sampleRateText | Select-Object -First 1), [ref]$sampleRate) -or $sampleRate -le 0) {
    throw "Could not read audio sample rate for $Path"
  }

  return $sampleRate
}

function Resolve-ClockTime {
  param(
    [string]$ClockTime,
    [datetime]$EndTime
  )

  $timeOnly = [datetime]::Parse($ClockTime)
  $candidate = Get-Date -Year $EndTime.Year -Month $EndTime.Month -Day $EndTime.Day -Hour $timeOnly.Hour -Minute $timeOnly.Minute -Second $timeOnly.Second

  if ($candidate -gt $EndTime) {
    $candidate = $candidate.AddDays(-1)
  }

  return $candidate
}

function Get-TranscriptTimes {
  param(
    [string]$Path,
    [datetime]$EndTime
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return @()
  }

  $times = New-Object System.Collections.Generic.List[datetime]
  foreach ($line in [System.IO.File]::ReadLines((Resolve-Path -LiteralPath $Path).Path)) {
    if ($line -match "^\[(?<time>[^\]]+)\]\s+(?<speaker>You|Robot 790):") {
      $times.Add((Resolve-ClockTime $Matches["time"] $EndTime))
    }
  }

  return @($times | Sort-Object -Unique)
}

function Get-AutoDuration {
  param(
    [datetime]$ClipTime,
    [datetime[]]$TranscriptTimes,
    [double]$TailSeconds,
    [double]$MinSeconds,
    [double]$MaxSeconds
  )

  $next = $TranscriptTimes | Where-Object { $_ -gt $ClipTime } | Select-Object -First 1
  if ($null -eq $next) {
    return [Math]::Min($MaxSeconds, [Math]::Max($MinSeconds, 10.0))
  }

  $duration = ($next - $ClipTime).TotalSeconds + $TailSeconds
  if ($duration -lt $MinSeconds) { $duration = $MinSeconds }
  if ($duration -gt $MaxSeconds) { $duration = $MaxSeconds }
  return $duration
}

function Get-SilenceDuration {
  param(
    [string]$Path,
    [double]$StartSeconds,
    [double]$LeadSeconds,
    [double]$TailSeconds,
    [double]$MinSeconds,
    [double]$MaxSeconds,
    [double]$RequiredSilenceSeconds,
    [string]$Threshold
  )

  $probeDuration = $MaxSeconds + $LeadSeconds
  $startText = $StartSeconds.ToString("0.###", $InvariantCulture)
  $probeDurationText = $probeDuration.ToString("0.###", $InvariantCulture)
  $requiredSilenceText = $RequiredSilenceSeconds.ToString("0.###", $InvariantCulture)
  $filter = "silencedetect=n=$($Threshold):d=$requiredSilenceText"
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & ffmpeg -hide_banner -nostats -loglevel info -ss $startText -t $probeDurationText -i $Path -vn -af $filter -f null - 2>&1
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg silence probe failed at $startText seconds"
  }

  $minEnd = $LeadSeconds + $MinSeconds
  $silenceStarts = New-Object System.Collections.Generic.List[double]
  foreach ($line in $output) {
    $text = $line.ToString()
    if ($text -match "silence_start:\s*([0-9]+(?:\.[0-9]+)?)") {
      $silenceStart = 0.0
      if ([double]::TryParse($Matches[1], [System.Globalization.NumberStyles]::Float, $InvariantCulture, [ref]$silenceStart)) {
        $silenceStarts.Add($silenceStart)
      }
    }
  }

  $chosen = $silenceStarts | Where-Object { $_ -ge $minEnd } | Select-Object -First 1
  if ($null -eq $chosen) {
    return $MaxSeconds
  }

  $duration = [double]$chosen + $TailSeconds - $LeadSeconds
  if ($duration -lt $MinSeconds) { $duration = $MinSeconds }
  if ($duration -gt $MaxSeconds) { $duration = $MaxSeconds }
  return $duration
}

$sourcePath = Resolve-Path -LiteralPath $Source
$manifestPath = Resolve-Path -LiteralPath $Manifest
$endTime = [datetime]::Parse($RecordingEnd)
$sourceDuration = Get-MediaDurationSeconds $sourcePath.Path
$sourceStart = $endTime.AddSeconds(-1 * $sourceDuration)
$transcriptTimes = Get-TranscriptTimes $ConversationLog $endTime

$outFullPath = Join-Path (Resolve-Path -LiteralPath ".").Path $OutPath
$outDir = Split-Path -Parent $outFullPath
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$cutSheetPath = [System.IO.Path]::ChangeExtension($outFullPath, ".cuts.csv")

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("robot790-album-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

try {
  $clips = Import-Csv -LiteralPath $manifestPath.Path
  if (-not $clips -or $clips.Count -eq 0) {
    throw "No clips found in $($manifestPath.Path)"
  }

  $filledSource = Join-Path $tempRoot "gap-filled-source.flac"
  & ffmpeg -hide_banner -loglevel error -y -i $sourcePath.Path -vn -af "aresample=async=1000:first_pts=0" -ac 2 -ar 44100 -c:a flac $filledSource
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create gap-filled working audio from $($sourcePath.Path)"
  }

  $gapPath = Join-Path $tempRoot "gap.wav"
  if ($GapSeconds -gt 0) {
    & ffmpeg -hide_banner -loglevel error -y -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100" -t $GapSeconds $gapPath
    if ($LASTEXITCODE -ne 0) { throw "Failed to create gap audio" }
  }

  $segments = New-Object System.Collections.Generic.List[string]
  $cutRows = New-Object System.Collections.Generic.List[object]
  $index = 0

  foreach ($clip in $clips) {
    $clipTime = Resolve-ClockTime $clip.Time $endTime
    $lead = [double]$clip.LeadSeconds
    $spokenDuration = 0.0
    $start = ($clipTime - $sourceStart).TotalSeconds - $lead
    if ($start -lt 0) { $start = 0 }

    if ($DurationMode -eq "manifest") {
      if (-not [double]::TryParse($clip.DurationSeconds, [ref]$spokenDuration) -or $spokenDuration -le 0) {
        $spokenDuration = Get-AutoDuration $clipTime $transcriptTimes $AutoTailSeconds $MinAutoDurationSeconds $MaxAutoDurationSeconds
      }
    } elseif ($DurationMode -eq "transcript") {
      $spokenDuration = Get-AutoDuration $clipTime $transcriptTimes $AutoTailSeconds $MinAutoDurationSeconds $MaxAutoDurationSeconds
    } else {
      $spokenDuration = Get-SilenceDuration $filledSource $start $lead $AutoTailSeconds $MinAutoDurationSeconds $MaxAutoDurationSeconds $SilenceSeconds $SilenceThreshold
    }

    $duration = $spokenDuration + $lead
    $fade = [Math]::Min($FadeSeconds, [Math]::Max(0.05, $duration / 3))
    $fadeOutStart = [Math]::Max(0, $duration - $fade)
    $clipPath = Join-Path $tempRoot ("clip-{0:000}.wav" -f $index)

    $startText = $start.ToString("0.###", $InvariantCulture)
    $durationText = $duration.ToString("0.###", $InvariantCulture)
    $fadeText = $fade.ToString("0.###", $InvariantCulture)
    $fadeOutStartText = $fadeOutStart.ToString("0.###", $InvariantCulture)
    $filter = "asetpts=PTS-STARTPTS,afade=t=in:st=0:d=$fadeText,afade=t=out:st=$($fadeOutStartText):d=$fadeText"
    & ffmpeg -hide_banner -loglevel error -y -ss $startText -t $durationText -i $filledSource -vn -ac 2 -ar 44100 -af $filter $clipPath
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to cut clip $($clip.Title) at $($clip.Time)"
    }

    $segments.Add($clipPath)
    if ($GapSeconds -gt 0 -and $index -lt ($clips.Count - 1)) {
      $segments.Add($gapPath)
    }

    $cutRows.Add([pscustomobject]@{
      Title = $clip.Title
      ClockTime = $clip.Time
      SourceStartSeconds = [Math]::Round($start, 3)
      TotalDurationSeconds = [Math]::Round($duration, 3)
      SpokenDurationSeconds = [Math]::Round($spokenDuration, 3)
      LeadSeconds = [Math]::Round($lead, 3)
      DurationMode = $DurationMode
      Tags = $clip.Tags
    })

    $index += 1
  }

  $ffmpegArgs = New-Object System.Collections.Generic.List[string]
  $ffmpegArgs.Add("-hide_banner")
  $ffmpegArgs.Add("-loglevel")
  $ffmpegArgs.Add("error")
  $ffmpegArgs.Add("-y")
  foreach ($segment in $segments) {
    $ffmpegArgs.Add("-i")
    $ffmpegArgs.Add($segment)
  }

  $filterInputs = ""
  for ($i = 0; $i -lt $segments.Count; $i++) {
    $filterInputs += "[$($i):a]"
  }
  $filter = "$($filterInputs)concat=n=$($segments.Count):v=0:a=1[out]"
  $ffmpegArgs.Add("-filter_complex")
  $ffmpegArgs.Add($filter)
  $ffmpegArgs.Add("-map")
  $ffmpegArgs.Add("[out]")
  $ffmpegArgs.Add("-c:a")
  $ffmpegArgs.Add("libmp3lame")
  $ffmpegArgs.Add("-b:a")
  $ffmpegArgs.Add("160k")
  $ffmpegArgs.Add($outFullPath)

  & ffmpeg @ffmpegArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to write $outFullPath"
  }

  Write-Host "Wrote $outFullPath"
  $cutRows | Export-Csv -LiteralPath $cutSheetPath -NoTypeInformation -Encoding UTF8
  Write-Host "Wrote $cutSheetPath"
  Write-Host "Source started $($sourceStart.ToString("s")) and ended $($endTime.ToString("s"))"
  Write-Host "Clips: $($clips.Count)"
} finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
