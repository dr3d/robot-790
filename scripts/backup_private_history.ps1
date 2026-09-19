param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$Destination
)

$ErrorActionPreference = 'Stop'
function Get-SharedHash([string]$Path) {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete)
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $hasher.Dispose(); $stream.Dispose() }
}

function Copy-SharedFile([string]$Source, [string]$Target) {
    $inputStream = [IO.File]::Open($Source, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete)
    try {
        $outputStream = [IO.File]::Open($Target, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try { $inputStream.CopyTo($outputStream); $outputStream.Flush($true) }
        finally { $outputStream.Dispose() }
    }
    finally { $inputStream.Dispose() }
}

$root = (Resolve-Path -LiteralPath $ProjectRoot).Path.TrimEnd('\', '/')
if (-not $Destination) {
    $Destination = Join-Path $root ('backups/history-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
}
$target = [IO.Path]::GetFullPath($Destination).TrimEnd('\', '/')
$sources = @('notes', 'logs', 'config', '.env', 'qwen3_tts.env')
if ($env:ROBOT_790_NOTES_PATH) {
    throw 'External ROBOT_790_NOTES_PATH is set. Back up that location explicitly before proceeding.'
}
foreach ($name in $sources) {
    $source = Join-Path $root $name
    if ($target.Equals($source, [StringComparison]::OrdinalIgnoreCase) -or
        $target.StartsWith($source + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Backup destination cannot be inside a source.'
    }
}
if (Test-Path -LiteralPath $target) { throw 'Backup destination already exists; refusing to merge or overwrite.' }

# Reject links rather than following private data outside the declared inventory.
$files = @()
$missing = @()
foreach ($name in $sources) {
    $source = Join-Path $root $name
    if (-not (Test-Path -LiteralPath $source)) { $missing += $name; continue }
    $item = Get-Item -LiteralPath $source -Force
    $items = @($item)
    if ($item.PSIsContainer) { $items += @(Get-ChildItem -LiteralPath $source -Recurse -Force) }
    foreach ($entry in $items) {
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Linked source cannot be backed up implicitly: $($entry.FullName)"
        }
        if (-not $entry.PSIsContainer) { $files += $entry }
    }
}
if (-not $files.Count) { throw 'No private data found; no backup created.' }
[IO.Directory]::CreateDirectory($target) | Out-Null
$started = [DateTime]::UtcNow.ToString('o')
$records = @()
foreach ($file in $files) {
    $relative = $file.FullName.Substring($root.Length + 1)
    $copy = Join-Path $target $relative
    [IO.Directory]::CreateDirectory((Split-Path -Parent $copy)) | Out-Null
    $verified = $false
    for ($attempt = 0; $attempt -lt 3; $attempt++) {
        $before = Get-SharedHash $file.FullName
        Copy-SharedFile $file.FullName $copy
        $copied = Get-SharedHash $copy
        $after = Get-SharedHash $file.FullName
        if ($before -eq $copied -and $copied -eq $after) { $verified = $true; break }
    }
    if (-not $verified) { throw "Source kept changing; backup is incomplete: $relative" }
    $records += [pscustomobject][ordered]@{
        path = $relative.Replace('\', '/')
        bytes = (Get-Item -LiteralPath $copy).Length
        sha256 = $copied.ToLowerInvariant()
    }
}
# Verify the completed copies again, not only the bytes immediately after copying.
foreach ($record in $records) {
    if ((Get-FileHash -LiteralPath (Join-Path $target $record.path) -Algorithm SHA256).Hash -ne $record.sha256) {
        throw "Backup verification failed: $($record.path)"
    }
}
$manifest = [ordered]@{
    schema = 1
    source_root = $root
    started_utc = $started
    verified_utc = [DateTime]::UtcNow.ToString('o')
    consistency = 'Per-file hash-verified copy; not a point-in-time snapshot of running servers.'
    missing_optional_sources = $missing
    files = $records
}
$json = ConvertTo-Json -InputObject $manifest -Depth 6
[IO.File]::WriteAllText((Join-Path $target 'backup-manifest.json'), $json, [Text.UTF8Encoding]::new($false))
[pscustomobject]@{
    Destination = $target
    VerifiedFiles = $records.Count
    Bytes = ($records | Measure-Object -Property bytes -Sum).Sum
}
