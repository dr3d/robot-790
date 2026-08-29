from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any

import httpx

DEFAULT_TIMEOUT_S = 6.0
DEVICE_ENV_PREFIX = "ROBOT_790_SMART_HOME_DEVICE_"
DEVICES_ENV = "ROBOT_790_SMART_HOME_DEVICES"
HA_URL_ENV = "ROBOT_790_HOME_ASSISTANT_URL"
HA_TOKEN_ENV = "ROBOT_790_HOME_ASSISTANT_TOKEN"
HA_TIMEOUT_ENV = "ROBOT_790_HOME_ASSISTANT_TIMEOUT_S"

ALLOWED_DOMAINS = {"light", "switch", "fan"}
ALLOWED_ACTIONS = {"list", "status", "turn_on", "turn_off", "toggle"}
ACTION_ALIASES = {
    "on": "turn_on",
    "off": "turn_off",
    "turnon": "turn_on",
    "turnoff": "turn_off",
    "check": "status",
}


@dataclass(frozen=True)
class SmartHomeDevice:
    name: str
    entity_id: str
    label: str = ""

    @property
    def domain(self) -> str:
        return self.entity_id.split(".", 1)[0].lower()

    def public_payload(self) -> dict[str, str]:
        return {
            "name": self.name,
            "entity_id": self.entity_id,
            "domain": self.domain,
            "label": self.label or self.name.replace("_", " "),
        }


def control_smart_home_device(
    device: str = "",
    action: str = "status",
    *,
    client: httpx.Client | None = None,
) -> dict[str, Any]:
    """Control one allowlisted Home Assistant device.

    This is intentionally narrow: only configured aliases can be touched, and
    only reversible light/switch/fan actions are exposed.
    """

    normalized_action = _normalize_action(action)
    if normalized_action not in ALLOWED_ACTIONS:
        return {
            "status": "error",
            "tool": "set_smart_home_device",
            "error": f"Unsupported smart-home action: {action}",
            "allowed_actions": sorted(ALLOWED_ACTIONS),
        }

    try:
        devices = configured_devices()
    except ValueError as exc:
        return {"status": "error", "tool": "set_smart_home_device", "error": str(exc)}
    if normalized_action == "list":
        return {
            "status": "ok",
            "tool": "set_smart_home_device",
            "action": "list",
            "devices": [item.public_payload() for item in devices.values()],
        }

    key = _device_key(device)
    selected = devices.get(key)
    if selected is None:
        return {
            "status": "error",
            "tool": "set_smart_home_device",
            "error": f"Unknown smart-home device: {device}",
            "known_devices": sorted(devices),
        }
    if selected.domain not in ALLOWED_DOMAINS:
        return {
            "status": "error",
            "tool": "set_smart_home_device",
            "error": f"Device domain '{selected.domain}' is not allowed for Robot 790 smart-home control.",
            "device": selected.public_payload(),
            "allowed_domains": sorted(ALLOWED_DOMAINS),
        }

    url = _home_assistant_url()
    token = os.getenv(HA_TOKEN_ENV, "").strip()
    if not url or not token:
        return {
            "status": "error",
            "tool": "set_smart_home_device",
            "error": f"Configure {HA_URL_ENV} and {HA_TOKEN_ENV} before enabling smart-home control.",
            "device": selected.public_payload(),
        }

    owns_client = client is None
    http_client = client or httpx.Client(timeout=_timeout_s(), follow_redirects=True)
    try:
        if normalized_action == "status":
            state = _ha_get_state(http_client, url, token, selected.entity_id)
            return _ok_payload(selected, normalized_action, state=state)

        service = _ha_call_service(http_client, url, token, selected.domain, normalized_action, selected.entity_id)
        state = _try_ha_get_state(http_client, url, token, selected.entity_id)
        return _ok_payload(selected, normalized_action, state=state, service_result=service)
    except (httpx.HTTPError, ValueError) as exc:
        return {
            "status": "error",
            "tool": "set_smart_home_device",
            "error": str(exc),
            "device": selected.public_payload(),
            "action": normalized_action,
        }
    finally:
        if owns_client:
            http_client.close()


def configured_devices() -> dict[str, SmartHomeDevice]:
    devices: dict[str, SmartHomeDevice] = {}
    devices.update(_parse_devices_env(os.getenv(DEVICES_ENV, "")))
    for name, value in os.environ.items():
        if not name.startswith(DEVICE_ENV_PREFIX):
            continue
        key = _device_key(name.removeprefix(DEVICE_ENV_PREFIX))
        device = _device_from_value(key, value)
        if device is not None:
            devices[device.name] = device
    return dict(sorted(devices.items()))


def _parse_devices_env(raw: str) -> dict[str, SmartHomeDevice]:
    value = raw.strip()
    if not value:
        return {}
    if value.startswith("{"):
        return _parse_devices_json(value)

    devices: dict[str, SmartHomeDevice] = {}
    for part in re.split(r"[;\n]+", value):
        entry = part.strip()
        if not entry:
            continue
        if "=" in entry:
            name, entity = entry.split("=", 1)
        elif ":" in entry:
            name, entity = entry.split(":", 1)
        else:
            continue
        key = _device_key(name)
        device = _device_from_value(key, entity)
        if device is not None:
            devices[device.name] = device
    return devices


def _parse_devices_json(raw: str) -> dict[str, SmartHomeDevice]:
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError(f"{DEVICES_ENV} JSON must be an object mapping names to entity IDs.")
    devices: dict[str, SmartHomeDevice] = {}
    for name, value in parsed.items():
        key = _device_key(str(name))
        device = _device_from_value(key, value)
        if device is not None:
            devices[device.name] = device
    return devices


def _device_from_value(name: str, value: object) -> SmartHomeDevice | None:
    if not name:
        return None
    label = ""
    entity_id = ""
    if isinstance(value, dict):
        entity_id = str(value.get("entity_id") or "").strip()
        label = str(value.get("label") or "").strip()
    else:
        raw = str(value or "").strip()
        if "|" in raw:
            entity_id, label = [part.strip() for part in raw.split("|", 1)]
        else:
            entity_id = raw
    entity_id = entity_id.lower()
    if not _valid_entity_id(entity_id):
        return None
    return SmartHomeDevice(name=name, entity_id=entity_id, label=label)


def _home_assistant_url() -> str:
    return os.getenv(HA_URL_ENV, "").strip().rstrip("/")


def _timeout_s() -> float:
    try:
        value = float(os.getenv(HA_TIMEOUT_ENV, str(DEFAULT_TIMEOUT_S)))
    except ValueError:
        value = DEFAULT_TIMEOUT_S
    return max(1.0, min(30.0, value))


def _normalize_action(action: str) -> str:
    key = re.sub(r"[^a-z0-9]+", "", str(action or "").strip().lower())
    return ACTION_ALIASES.get(key, str(action or "").strip().lower())


def _device_key(value: str) -> str:
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower())).strip("_")


def _valid_entity_id(value: str) -> bool:
    return bool(re.fullmatch(r"[a-z0-9_]+\.[a-z0-9_]+", value))


def _ha_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _ha_get_state(client: httpx.Client, base_url: str, token: str, entity_id: str) -> dict[str, Any]:
    response = client.get(f"{base_url}/api/states/{entity_id}", headers=_ha_headers(token))
    if response.status_code >= 400:
        raise ValueError(f"Home Assistant state lookup failed with HTTP {response.status_code}.")
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError("Home Assistant state lookup returned a non-object response.")
    return _compact_state(payload)


def _try_ha_get_state(client: httpx.Client, base_url: str, token: str, entity_id: str) -> dict[str, Any] | None:
    try:
        return _ha_get_state(client, base_url, token, entity_id)
    except (httpx.HTTPError, ValueError):
        return None


def _ha_call_service(
    client: httpx.Client,
    base_url: str,
    token: str,
    domain: str,
    service: str,
    entity_id: str,
) -> object:
    response = client.post(
        f"{base_url}/api/services/{domain}/{service}",
        headers=_ha_headers(token),
        json={"entity_id": entity_id},
    )
    if response.status_code >= 400:
        raise ValueError(f"Home Assistant service call failed with HTTP {response.status_code}.")
    if not response.content:
        return None
    try:
        return response.json()
    except ValueError:
        return response.text


def _compact_state(payload: dict[str, Any]) -> dict[str, Any]:
    attributes = payload.get("attributes")
    friendly_name = attributes.get("friendly_name") if isinstance(attributes, dict) else None
    return {
        "entity_id": payload.get("entity_id"),
        "state": payload.get("state"),
        "friendly_name": friendly_name,
        "last_changed": payload.get("last_changed"),
    }


def _ok_payload(
    device: SmartHomeDevice,
    action: str,
    *,
    state: dict[str, Any] | None = None,
    service_result: object | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "status": "ok",
        "tool": "set_smart_home_device",
        "action": action,
        "device": device.public_payload(),
    }
    if state is not None:
        payload["state"] = state
    if service_result is not None:
        payload["service_result"] = service_result
    return payload
