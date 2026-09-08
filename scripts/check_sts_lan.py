"""Read-only HTTPS checks; does not connect an Eric session or operate devices."""

from __future__ import annotations

import argparse
import ssl
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPSHandler, ProxyHandler, Request, build_opener


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--address", default="192.168.0.150")
    parser.add_argument("--name", default="power")
    parser.add_argument(
        "--ca",
        type=Path,
        default=Path(__file__).resolve().parents[1] / ".local/sts-lan/public/lan-root.crt",
    )
    args = parser.parse_args()
    context = ssl.create_default_context(cafile=str(args.ca))
    opener = build_opener(ProxyHandler({}), HTTPSHandler(context=context))
    address = args.address
    cases: list[tuple[str, dict[str, str], int]] = [
        (f"https://{address}:8790/", {}, 200),
        (f"https://{args.name}:8790/", {}, 200),
        (f"https://{address}:8791/status", {}, 200),
        (f"https://{address}:8790/lan-root.crt", {}, 200),
        (f"https://{address}:8765/not-realtime", {}, 404),
        (f"https://{address}:8790/", {"Host": "untrusted.invalid"}, 403),
        (f"https://{address}:8790/", {"Sec-Fetch-Site": "cross-site"}, 403),
    ]
    for port, path in ((8790, "/api/runtime-config"), (8791, "/status")):
        for hostname in (address, args.name):
            for origin_port in (8790, 8791):
                cases.append((
                    f"https://{address}:{port}{path}", {"Origin": f"https://{hostname}:{origin_port}"}, 200
                ))
    for port, path in ((8790, "/api/runtime-config"), (8791, "/status"), (8765, "/v1/realtime")):
        for origin in ("https://untrusted.invalid", "null", f"http://{address}:8790"):
            cases.append((f"https://{address}:{port}{path}", {"Origin": origin}, 403))

    for url, headers, expected in cases:
        try:
            with opener.open(Request(url, headers=headers), timeout=8) as response:
                status = response.status
        except HTTPError as error:
            status = error.code
            error.close()
        if status != expected:
            raise AssertionError(f"{url} {headers}: expected {expected}, got {status}")
        print(f"PASS {status}: {url} {headers}")
    print(f"{len(cases)} certificate-verified HTTPS and request-boundary checks passed.")
    print("A second-device microphone/camera and realtime session test is still required.")


if __name__ == "__main__":
    main()
