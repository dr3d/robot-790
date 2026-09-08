# Robot 790 Operator Cheat Sheet

This is the short operational page: addresses, PowerShell commands, and what
stays running. Architecture and setup details live elsewhere.

## Turn On Apartment Access

Run this on POWER from any PowerShell window when the ordinary local services
are already running:

```powershell
Set-Location D:\_PROJECTS\robot-790
.\scripts\start_sts_lan.ps1
```

It starts the apartment-only HTTPS gateway. It does **not** start Eric's
realtime worker, the STS page, or Browser Face by itself.

## Addresses

| Where | STS controls | Browser Face | Realtime endpoint |
| --- | --- | --- | --- |
| On POWER | `http://127.0.0.1:8790/` | `http://127.0.0.1:8791/` | `ws://127.0.0.1:8765/v1/realtime` |
| On a trusted apartment device | `https://power:8790/` | `https://power:8791/` | `wss://power:8765/v1/realtime` |
| IP fallback on apartment LAN | `https://192.168.0.150:8790/` | `https://192.168.0.150:8791/` | `wss://192.168.0.150:8765/v1/realtime` |

Use the browser URLs. The realtime URL is for the page, not a page to open
manually. If `power` does not resolve on a client device, use the IP address.
Keep STS and Face on the same hostname form when possible so browser settings
and permissions stay in the same origin.

## Bring Everything Up After A Reboot

Open three PowerShell windows on POWER. Run one foreground service in each and
leave each window open while it is needed.

**Window 1: realtime brain and voice**

```powershell
Set-Location D:\_PROJECTS\robot-790
.\scripts\start_realtime_gold.ps1
```

**Window 2: STS control page**

```powershell
Set-Location D:\_PROJECTS\robot-790
.\scripts\start_sts_page.ps1
```

**Window 3: Browser Face**

```powershell
Set-Location D:\_PROJECTS\robot-790
.\scripts\start_face_sim.ps1
```

Then, in any PowerShell window, turn on apartment access if you want it:

```powershell
Set-Location D:\_PROJECTS\robot-790
.\scripts\start_sts_lan.ps1
```

Open local STS on POWER at `http://127.0.0.1:8790/`. From another device, open
`https://power:8790/` or the IP fallback above.

The gateway can remain up while Eric is disconnected, halted, or restarted.
After a Windows reboot it must be started again; its firewall rule and
certificate remain in place.

## Open A Compact Local Face Window

From POWER, this opens the local Browser Face in a small app-style Chrome or
Edge window:

```powershell
Set-Location D:\_PROJECTS\robot-790
.\scripts\open_browser_face.ps1
```

For a different size or position:

```powershell
.\scripts\open_browser_face.ps1 -Width 420 -Height 640 -X 40 -Y 80
```

## Stop Or Recover

| Need | Command | What it does |
| --- | --- | --- |
| Stop realtime and STS page | `.\scripts\stop_sts.ps1` | Stops the realtime worker and page server. It leaves Browser Face and the LAN gateway alone. |
| Stop only realtime | `.\scripts\stop_sts.ps1 -RealtimeOnly` | Leaves the STS page available. |
| Stop only STS page | `.\scripts\stop_sts.ps1 -PageOnly` | Leaves realtime running. |
| Restart the normal fast brain | `.\scripts\restart_realtime_gold.ps1 -Preset qwen27-mtp-vlow` | Stops/reloads realtime and LM Studio with the current gold preset. |
| Stop realtime and unload model | `.\scripts\unload_realtime.ps1` | Frees the LM Studio model too. |
| Stop apartment access | `.\scripts\stop_sts_lan.ps1` | Stops only Caddy's LAN HTTPS gateway. |

To stop a foreground Browser Face server you started manually, return to its
PowerShell window and press `Ctrl+C`. To remove the gateway's restricted
firewall rule as well, use the rare cleanup command:

```powershell
.\scripts\stop_sts_lan.ps1 -RemoveFirewallRule
```

`HALT`, `Save + Halt`, and `Disconnect` in STS manage the live run and its
continuity artifacts. They do not stop the page server, Browser Face, or the
apartment gateway.

## Check What Is Alive

```powershell
Set-Location D:\_PROJECTS\robot-790
8765,8790,8791,1234 | ForEach-Object {
    [pscustomobject]@{
        Port = $_
        Listening = Test-NetConnection 127.0.0.1 -Port $_ -InformationLevel Quiet
    }
}
.\.venv\Scripts\python.exe .\scripts\check_sts_lan.py
```

The first command gives a `True`/`False` status for realtime, STS, Browser
Face, and LM Studio without requiring an elevated PowerShell window. The second
runs certificate-verified gateway checks for both `power` and `192.168.0.150`;
it does not connect an Eric session.

If the gateway failed to start, inspect its two local logs:

```powershell
Get-Content .\.local\sts-lan\gateway-out.log -Tail 80
Get-Content .\.local\sts-lan\gateway-err.log -Tail 80
```

## First Remote Device

Before Chrome can normally grant its microphone or camera to an apartment
address, trust this public certificate once on that device:

```text
D:\_PROJECTS\robot-790\.local\sts-lan\public\lan-root.crt
```

Only transfer that `.crt` file. Never copy `.local\sts-lan\data` or a `.key`
file off POWER. After trusting the certificate, restart the browser and open an
HTTPS address above. The certificate stays valid across normal gateway restarts.

## One-Time Gateway Setup Only

Do not use this for ordinary starts. It is only for a new machine or a deliberate
gateway rebuild, and the firewall part needs an elevated PowerShell window:

```powershell
.\scripts\start_sts_lan.ps1 -Install -ConfigureFirewall -TrustCertificate
```

For the full network-security explanation and device-specific trust notes, see
[Apartment STS Access](sts-lan.md).
