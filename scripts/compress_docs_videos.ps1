param(
    [string]$InputDir = "docs/media/raw-video",
    [string]$OutputDir = "docs/media/videos",
    [string]$PreviewDir = "docs/media/previews",
    [string]$RejectedDir = "docs/media/rejected",
    [int]$MaxPublishMB = 25,
    [int]$MaxHeight = 720,
    [int]$Crf = 30,
    [string]$Preset = "medium"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force $OutputDir, $PreviewDir, $RejectedDir | Out-Null
$maxPublishBytes = [int64]$MaxPublishMB * 1024 * 1024

$videos = Get-ChildItem -Path $InputDir -File |
    Where-Object { @(".mp4", ".mov", ".webm") -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object Name

foreach ($video in $videos) {
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($video.Name)
    $output = Join-Path $OutputDir "$baseName.mp4"
    $preview = Join-Path $PreviewDir "$baseName.jpg"

    Write-Host "Compressing $($video.Name) -> $output"
    ffmpeg -hide_banner -y `
        -i $video.FullName `
        -map_metadata -1 `
        -vf "scale=-2:'min($MaxHeight,ih)'" `
        -c:v libx264 `
        -preset $Preset `
        -crf $Crf `
        -pix_fmt yuv420p `
        -c:a aac `
        -b:a 96k `
        -movflags +faststart `
        $output

    Write-Host "Preview $preview"
    ffmpeg -hide_banner -loglevel error -y `
        -ss 00:00:01 `
        -i $output `
        -frames:v 1 `
        -update 1 `
        -q:v 4 `
        $preview

    $outputItem = Get-Item $output
    if ($outputItem.Length -gt $maxPublishBytes) {
        $rejectedOutput = Join-Path $RejectedDir $outputItem.Name
        Write-Host "Rejecting $($outputItem.Name): $([Math]::Round($outputItem.Length / 1MB, 1)) MB exceeds $MaxPublishMB MB"
        Move-Item -Force $outputItem.FullName $rejectedOutput
        if (Test-Path $preview) {
            Remove-Item $preview
        }
    }
}

Write-Host "Done."
