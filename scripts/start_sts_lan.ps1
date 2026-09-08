param(
    [string] $LanAddress = "192.168.0.150",
    [string] $LanName = "POWER",
    [switch] $Install,
    [switch] $ConfigureFirewall,
    [switch] $TrustCertificate
)

$ErrorActionPreference = "Stop"
if ($ConfigureFirewall) {
    $principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Firewall setup requires PowerShell run as Administrator. No gateway setup was attempted."
    }
}
$RepoRoot = Split-Path -Parent $PSScriptRoot
$StateRoot = Join-Path $RepoRoot ".local\sts-lan"
$Binary = Join-Path $StateRoot "bin\caddy.exe"
$Config = Join-Path $RepoRoot "config\sts-lan.Caddyfile"
$DataRoot = Join-Path $StateRoot "data"
$PublicRoot = Join-Path $StateRoot "public"
$Ports = @(8765, 8790, 8791)
$RuleName = "Robot790-Apartment-HTTPS"
$Version = "2.11.4"
$ArchiveSha256 = "1708333f79e274c7697285afe6d592ab39314e0b131e9ec6bea08ad27df62ebf"

$address = [System.Net.IPAddress]::Parse($LanAddress)
if ($address.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
    throw "Choose the apartment interface's IPv4 address."
}
if ($LanName -notmatch '^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}$') {
    throw "LanName must be a simple computer name such as POWER."
}
$LanName = $LanName.ToLowerInvariant()
$interface = Get-NetIPAddress -IPAddress $LanAddress -AddressFamily IPv4 -ErrorAction Stop
$profile = Get-NetConnectionProfile -InterfaceIndex $interface.InterfaceIndex
if ($profile.NetworkCategory -ne "Private") {
    throw "The selected interface must already be a trusted Private network. No network category was changed."
}
$bytes = $address.GetAddressBytes()
if (-not ($bytes[0] -eq 10 -or ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
          ($bytes[0] -eq 192 -and $bytes[1] -eq 168))) {
    throw "LAN access requires a private IPv4 address, not a public interface."
}
$prefix = [int]$interface.PrefixLength
$networkBytes = for ($index = 0; $index -lt 4; $index++) {
    $bits = [Math]::Max(0, [Math]::Min(8, $prefix - 8 * $index))
    [byte]($bytes[$index] -band (256 - [Math]::Pow(2, 8 - $bits)))
}
$subnet = "$($networkBytes -join '.')/$prefix"

New-Item -ItemType Directory -Force -Path $StateRoot, $DataRoot, $PublicRoot | Out-Null
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $StateRoot /inheritance:r /grant:r "${identity}:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not restrict access to the local certificate keys." }

if (-not (Test-Path -LiteralPath $Binary)) {
    if (-not $Install) { throw "Caddy is not installed here. Run once with -Install." }
    $archive = Join-Path $StateRoot "caddy-$Version.zip"
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 120 -Uri "https://github.com/caddyserver/caddy/releases/download/v$Version/caddy_${Version}_windows_amd64.zip" -OutFile $archive
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $ArchiveSha256) {
        throw "Caddy download failed its pinned SHA-256 check. Nothing was executed."
    }
    Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $StateRoot "bin") -Force
}

$env:ROBOT_790_LAN_ADDRESS = $LanAddress
$env:ROBOT_790_LAN_NAME = $LanName
$env:ROBOT_790_LAN_SUBNET = $subnet
$env:ROBOT_790_LAN_DATA = $DataRoot.Replace('\', '/')
$env:ROBOT_790_LAN_PUBLIC = $PublicRoot.Replace('\', '/')
$env:XDG_CONFIG_HOME = $StateRoot
$env:XDG_DATA_HOME = $StateRoot

$listeners = @(Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in $Ports })
if ($listeners | Where-Object { $_.LocalAddress -in '0.0.0.0', '::' }) {
    throw "An STS service uses a wildcard listener. Restart it on 127.0.0.1 before starting LAN HTTPS."
}
$existing = @($listeners | Where-Object { $_.LocalAddress -eq $LanAddress })
if ($existing.Count) {
    $owners = @($existing.OwningProcess | Select-Object -Unique)
    if ($owners.Count -ne 1 -or (Get-Process -Id $owners[0]).Path -ne $Binary -or $existing.Count -ne 3) {
        throw "A different or partial listener already owns the LAN ports. Nothing was stopped."
    }
}
& $Binary validate --config $Config --adapter caddyfile
if ($LASTEXITCODE -ne 0) { throw "Caddy configuration validation failed." }

if ($ConfigureFirewall) {
    $oldRule = Get-NetFirewallRule -Name $RuleName -ErrorAction SilentlyContinue
    if ($oldRule) { $oldRule | Remove-NetFirewallRule -ErrorAction Stop }
    New-NetFirewallRule -Name $RuleName -DisplayName "Robot 790 - apartment HTTPS only" `
        -Direction Inbound -Action Allow -Enabled True -Profile Private -Protocol TCP `
        -LocalAddress $LanAddress -LocalPort $Ports -RemoteAddress $subnet `
        -InterfaceAlias $interface.InterfaceAlias -Program $Binary -EdgeTraversalPolicy Block -ErrorAction Stop | Out-Null
    if (-not (Get-NetFirewallRule -Name $RuleName -ErrorAction Stop)) { throw "Firewall rule was not created." }
}

if ($existing.Count) {
    Write-Host "Apartment HTTPS is already running (PID $($owners[0])). Restart it to apply configuration changes."
} else {
    $process = Start-Process -FilePath $Binary `
        -ArgumentList @('run', '--config', "`"$Config`"", '--adapter', 'caddyfile') `
        -WorkingDirectory $RepoRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $StateRoot 'gateway-out.log') `
        -RedirectStandardError (Join-Path $StateRoot 'gateway-err.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        $process.Refresh()
        if ($process.HasExited) { throw "LAN gateway exited. Check .local/sts-lan/gateway-err.log." }
        $listening = @([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() |
            Where-Object { $_.Address.ToString() -eq $LanAddress -and $_.Port -in $Ports })
        if ($listening.Count -eq 3) { $ready = $true; break }
    }
    if (-not $ready) {
        Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
        throw "LAN gateway did not open all three ports and was stopped. Check .local/sts-lan/gateway-err.log."
    }
    Write-Host "Started apartment HTTPS gateway (PID $($process.Id))."
}

$rootCertificate = Join-Path $DataRoot "pki\authorities\local\root.crt"
$publicCertificate = Join-Path $PublicRoot "lan-root.crt"
Copy-Item -LiteralPath $rootCertificate -Destination $publicCertificate -Force
if ($TrustCertificate) {
    Import-Certificate -FilePath $publicCertificate -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
}
Write-Host "STS:  https://${LanAddress}:8790/ or https://${LanName}:8790/"
Write-Host "Face: https://${LanAddress}:8791/"
Write-Host "Allowed network: $subnet (Private / $($interface.InterfaceAlias))"
Write-Host "Trust this public certificate once on each client device: $publicCertificate"
Write-Host "Certificate file SHA-256: $((Get-FileHash -LiteralPath $publicCertificate -Algorithm SHA256).Hash)"
Write-Host "Localhost URLs and HALT are unchanged. No router forwarding was configured."
