"""Thinking settings derived from the model actually loaded in LM Studio."""
from __future__ import annotations

import hashlib
import json
import time
from urllib.parse import urlsplit

import httpx

_CACHE: dict[tuple[str, str], tuple[float, dict]] = {}
_ENABLED = ("on", "minimal", "low", "medium", "high", "xhigh")
MODES = frozenset(("none", "off", *_ENABLED))


def model_profile(base_url: str, model: str, headers: dict | None = None) -> dict:
    key = (base_url.rstrip("/"), model)
    cached = _CACHE.get(key)
    if cached and time.monotonic() - cached[0] < 3:
        return dict(cached[1])
    parsed = urlsplit(base_url)
    unavailable = {"model": model, "status": "unverified", "can_off": False, "can_on": False,
                   "manual": "The loaded model's Thinking controls have not been verified."}
    if parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        return unavailable
    try:
        response = httpx.get(f"{parsed.scheme}://{parsed.netloc}/api/v1/models", headers=headers, timeout=3)
        response.raise_for_status()
        profile = profile_from_catalog(response.json(), model)
    except (httpx.HTTPError, ValueError, TypeError):
        profile = unavailable
    _CACHE[key] = (time.monotonic(), profile)
    return dict(profile)


def profile_from_catalog(catalog: dict, model: str) -> dict:
    result = {"model": model, "status": "unloaded", "can_off": False, "can_on": False,
              "manual": "This model is not loaded. Thinking controls are unavailable."}
    for candidate in catalog.get("models", []) if isinstance(catalog, dict) else []:
        if not isinstance(candidate, dict):
            continue
        instances = [item for item in (candidate.get("loaded_instances") or []) if isinstance(item, dict)]
        identifiers = {candidate.get("key"), candidate.get("id"), candidate.get("identifier")}
        identifiers.update(instance.get("id") for instance in instances)
        if model not in identifiers or not instances:
            continue
        capabilities = candidate.get("capabilities") or {}
        reasoning = capabilities.get("reasoning") if isinstance(capabilities, dict) else {}
        if not isinstance(reasoning, dict):
            reasoning = {}
        options = reasoning.get("allowed_options") or []
        if not isinstance(options, list):
            options = []
        enabled = [value for value in options if value in _ENABLED]
        selected = reasoning.get("default")
        if selected not in enabled:
            selected = enabled[0] if enabled else None
        result.update(status="verified", label=candidate.get("display_name") or model,
                      model_key=candidate.get("key"), options=options,
                      can_off=any(value in options for value in ("off", "none")), can_on=bool(enabled),
                      on_option=selected, wire_on="low" if selected == "on" else selected)
        identity = [model, candidate.get("key"), options, selected]
        result["identity"] = hashlib.sha256(json.dumps(identity).encode()).hexdigest()[:16]
        if not options:
            manual = "This loaded model advertises no Thinking switch."
        elif result["can_off"] and result["can_on"]:
            manual = ("Off disables thinking. On enables thinking; this model has no depth levels."
                      if set(options) <= {"off", "none", "on"} else
                      f"Off disables thinking. Choose a supported level directly; On uses this model's {selected} reasoning setting. "
                      f"Advertised settings: {', '.join(options)}.")
        elif result["can_on"]:
            manual = f"This model cannot switch thinking off. Advertised settings: {', '.join(options)}. On uses {selected}."
        else:
            manual = "This model cannot switch thinking on."
        result["manual"] = manual + " Changes apply to the next request, not a request already running."
        return result
    return result


def control_modes(profile: dict) -> list[str]:
    """Public choices for UI/tools, without inventing levels the model lacks."""
    if not isinstance(profile, dict) or profile.get("status") != "verified":
        return []
    modes = ["off"] if profile.get("can_off") else []
    if profile.get("can_on"):
        modes.extend(value for value in profile.get("options", []) if value in _ENABLED and value not in modes)
    return modes


def request_options(profile: dict, mode: str) -> dict:
    if mode not in MODES:
        raise ValueError("Choose a Thinking setting advertised by the loaded model.")
    off = mode in {"none", "off"}
    if profile.get("status") != "verified" or not profile.get("can_off" if off else "can_on"):
        raise ValueError(profile.get("manual") or "Thinking is unavailable for this model.")
    if off:
        return {"reasoning_effort": "none"}
    selected = profile["on_option"] if mode == "on" else mode
    if selected not in profile["options"]:
        raise ValueError(f"The loaded model does not support thinking setting {selected}.")
    # LM Studio's OpenAI-compatible endpoint uses low for the native binary On.
    return {"reasoning_effort": "low" if selected == "on" else selected}


def changes_from_result(value: object) -> dict:
    if value is None:
        return {}
    if not isinstance(value, dict) or any(key not in {"eric", "brain2"} for key in value):
        raise ValueError("Invalid Thinking changes from Brain 2.")
    if any(not isinstance(mode, str) or mode not in {"keep", "off", *_ENABLED} for mode in value.values()):
        raise ValueError("Invalid Thinking choice from Brain 2.")
    return {key: mode for key, mode in value.items() if mode != "keep"}
