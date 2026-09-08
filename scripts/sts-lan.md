# Apartment STS Access

The LAN gateway adds HTTPS without replacing the existing localhost services.
It uses Caddy's local certificate authority and proxies to fixed loopback ports:

| Service | Apartment URL | Existing backend |
| --- | --- | --- |
| STS | `https://192.168.0.150:8790/` | `http://127.0.0.1:8790/` |
| Browser face | `https://192.168.0.150:8791/` | `http://127.0.0.1:8791/` |
| Realtime | `wss://192.168.0.150:8765/v1/realtime` | `ws://127.0.0.1:8765/v1/realtime` |

`https://power:8790/` also works on clients that resolve POWER. This does not
install an mDNS responder or create a `POWER.local` name. Use the IP when name
resolution is unavailable. Reserve that IP in the router before relying on it.

## Explicit Setup

After approving the LAN exposure and certificate trust, run in PowerShell from
the project root. Firewall configuration requires administrative permission:

```powershell
.\scripts\start_sts_lan.ps1 -Install -ConfigureFirewall -TrustCertificate
```

The flags are explicit because this downloads a pinned, SHA-256-checked Caddy
release, adds a Windows firewall rule, and trusts the generated CA in the current
Windows user's certificate store. Ordinary starts need no installation flags:

```powershell
.\scripts\start_sts_lan.ps1
```

Start the normal STS page, browser face, and realtime backend separately as usual.
They must bind to `127.0.0.1`, which is now the launcher default. The gateway binds
only to the selected LAN IPv4 address. A wildcard backend listener would conflict;
the gateway launcher refuses to continue rather than stopping any existing server.
No Windows service, login task, router forwarding, or public tunnel is installed.

## Client Trust

Each remote device must trust the public CA certificate before microphone/camera
access works normally. The certificate is at
`.local/sts-lan/public/lan-root.crt`; only this public file should leave POWER.
Never share the `data` directory or any `.key` file.

Import the public certificate into the client's trusted root store. On Windows,
the certificate import wizard can target Current User / Trusted Root Certification
Authorities. On iOS/iPadOS, install the certificate profile and enable full trust
for that root in Certificate Trust Settings. Device policies can prevent custom
CA installation. Restart the browser after import and verify HTTPS has no warning.
Do not rely on bypassing a certificate warning for microphone/camera use.

The same public certificate is served at `/lan-root.crt` through the gateway.
Use a trusted transfer from POWER for initial installation; the launcher's file
SHA-256 can confirm that the transferred file matches. The CA is deliberately
persistent across gateway restarts, so clients do not need a new trust step each run.

HTTPS STS and face pages automatically choose HTTPS/WSS for the local services.
Choose Browser face simulator on a fresh client. Physical ESP32 HTTP controllers
and the Reachy adapter are not proxied by this gateway; accessing them directly
from an HTTPS page may be blocked as mixed content.

Preferences belong to each browser origin: localhost, POWER, and the IP do not
share their saved settings. Choose one LAN URL consistently. STS is the session
owner in its browser tab, not a synchronized multi-user remote desktop. Do not
connect a second controlling tab while another device is conducting the run.

## Access Boundary

- Only TCP 8765, 8790, and 8791 on the selected LAN address are opened.
- The firewall rule is limited to the Private network profile, selected interface,
  local subnet, and this project's Caddy executable. Public/guest profiles are not
  enabled. Existing firewall rules are otherwise unchanged.
- Caddy also checks the actual peer subnet, allowed hostnames, and browser origins.
  Foreign-origin requests are rejected before reaching STS. No forwarding headers
  are trusted as proof of a client's address.
- There is no login. Every device on the allowed subnet can use the exposed APIs,
  including notes, paid tools, and runtime controls. This assumes a trusted private
  household LAN, not shared building Wi-Fi or an untrusted guest network.
- Trusting the local CA grants certificate-authority trust on that client, not just
  permission to this one page. The signing keys stay in the ignored, access-limited
  `.local/sts-lan/data` directory on POWER.

TLS and subnet restrictions are not a substitute for authentication if the trust
assumptions change. The gateway does not claim that existing loopback APIs have
been comprehensively hardened.

## Stop Or Remove Access

```powershell
.\scripts\stop_sts_lan.ps1
.\scripts\stop_sts_lan.ps1 -RemoveFirewallRule
```

These stop only this project's gateway. They do not halt Eric, delete recordings,
modify continuity session notes, or remove the persistent certificate files. Remove the Robot
790 Apartment LAN root from a client's trusted roots separately when retiring it.
HALT continues to stop the realtime run and save its existing artifacts; it does
not stop the page/face/gateway or replace the selected continuity session.
The shared stop helper excludes Caddy listeners, even when their LAN port numbers
match the loopback backend ports. `tests/sts_stop.test.ps1` checks all, realtime-only,
and page-only stops with fake processes, without operating the real services.

Gateway startup logs are `.local/sts-lan/gateway-out.log` and `gateway-err.log`.
After setup, verify from a second device on the apartment network, including
microphone permission, camera preview, and a deliberate session connection.

For repeatable read-only connection and origin/host checks from POWER:

```powershell
.\.venv\Scripts\python.exe scripts\check_sts_lan.py
```

The gateway, Windows trusted root, exact firewall scope, both LAN names, and
allowed/blocked HTTP requests were verified locally during setup. The Python
suite passed 158 tests; browser-source checks passed 28 tests. No live Eric
session was started for this verification, and no browser automation connection
was available. Actual microphone/camera use on a second device remains a client
verification step, not an already observed result.

The HTTPS mechanism follows [Caddy's local HTTPS model](https://caddyserver.com/docs/automatic-https#local-https).
