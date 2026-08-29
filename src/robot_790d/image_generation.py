from __future__ import annotations

import base64
import hashlib
import html
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

DEFAULT_IMAGE_PROVIDER = "openai"
DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1-mini"
DEFAULT_IMAGE_SIZE = "1024x1024"
DEFAULT_IMAGE_QUALITY = "low"
DEFAULT_OUTPUT_FORMAT = "png"
MAX_PROMPT_CHARS = 32000
GENERATED_IMAGE_URL_PREFIX = "/generated-images/"


def generate_image(
    prompt: str,
    *,
    title: str = "",
    provider: str | None = None,
    size: str | None = None,
    model: str | None = None,
    quality: str | None = None,
    repo_root: Path | None = None,
) -> dict[str, Any]:
    """Generate one image and save it in Robot 790's local generated-image folder."""
    normalized_prompt = _normalize_prompt(prompt)
    if not normalized_prompt:
        return {"status": "error", "error": "prompt must be a non-empty string"}

    selected_provider = _provider_name(provider)
    if selected_provider == "mock":
        return _generate_mock_image(normalized_prompt, title=title, size=size, repo_root=repo_root)
    if selected_provider == "openai":
        return _generate_openai_image(
            normalized_prompt,
            title=title,
            size=size,
            model=model,
            quality=quality,
            repo_root=repo_root,
        )
    if selected_provider in {"comfy", "comfyui"}:
        return {
            "status": "error",
            "error": "ComfyUI image generation is not wired yet; set ROBOT_790_IMAGE_PROVIDER=openai or mock.",
            "provider": selected_provider,
        }
    return {
        "status": "error",
        "error": f"Unsupported image provider: {selected_provider}",
        "provider": selected_provider,
    }


def image_output_dir(repo_root: Path | None = None) -> Path:
    explicit = os.getenv("ROBOT_790_IMAGE_OUTPUT_DIR", "").strip()
    if explicit:
        return Path(explicit).expanduser()

    instance_path = os.getenv("ROBOT_790_INSTANCE_PATH", "").strip()
    if instance_path:
        return Path(instance_path).expanduser() / "generated-images"

    root = repo_root or Path(__file__).resolve().parents[2]
    return root / "logs" / "generated-images"


def generated_image_path(filename: str, repo_root: Path | None = None) -> Path:
    safe_name = _safe_filename(filename)
    if not safe_name:
        raise ValueError("Missing generated image filename.")
    return image_output_dir(repo_root) / safe_name


def generated_image_url(filename: str) -> str:
    return f"{GENERATED_IMAGE_URL_PREFIX}{_safe_filename(filename)}"


def _generate_openai_image(
    prompt: str,
    *,
    title: str = "",
    size: str | None = None,
    model: str | None = None,
    quality: str | None = None,
    repo_root: Path | None = None,
) -> dict[str, Any]:
    api_key = os.getenv("ROBOT_790_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {
            "status": "error",
            "error": "OpenAI image generation needs OPENAI_API_KEY or ROBOT_790_OPENAI_API_KEY.",
            "provider": "openai",
        }

    try:
        import httpx
    except ImportError as exc:
        return {
            "status": "error",
            "error": f"httpx is required for OpenAI image generation: {exc}",
            "provider": "openai",
        }

    model = _normalize_openai_image_model(model)
    image_size = _normalize_size(size or os.getenv("ROBOT_790_IMAGE_SIZE") or DEFAULT_IMAGE_SIZE)
    quality = _normalize_openai_image_quality(quality)
    base_url = os.getenv("ROBOT_790_OPENAI_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")
    timeout_s = _float_env("ROBOT_790_IMAGE_TIMEOUT_S", 180.0)

    payload: dict[str, object] = {"model": model, "prompt": prompt, "n": 1, "size": image_size}
    if model.startswith("gpt-image"):
        payload["quality"] = quality
        payload["output_format"] = DEFAULT_OUTPUT_FORMAT
        moderation = os.getenv("ROBOT_790_OPENAI_IMAGE_MODERATION", "auto").strip()
        if moderation in {"auto", "low"}:
            payload["moderation"] = moderation
    else:
        payload["response_format"] = "b64_json"

    try:
        response = httpx.post(
            f"{base_url}/images/generations",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=timeout_s,
        )
        response_payload = response.json()
    except httpx.HTTPError as exc:
        return {"status": "error", "error": f"OpenAI image request failed: {exc}", "provider": "openai"}
    except ValueError:
        response_payload = {}

    if response.status_code >= 400:
        return {
            "status": "error",
            "error": _api_error_message(response_payload, response.status_code),
            "provider": "openai",
            "model": model,
        }

    image_bytes, revised_prompt = _image_bytes_from_response(response_payload, httpx=httpx)
    if not image_bytes:
        return {"status": "error", "error": "OpenAI returned no image bytes.", "provider": "openai", "model": model}

    filename = _write_image_bytes(
        image_bytes,
        prompt=prompt,
        title=title,
        provider="openai",
        ext=DEFAULT_OUTPUT_FORMAT,
        repo_root=repo_root,
    )
    _write_metadata(
        filename,
        {
            "provider": "openai",
            "model": model,
            "prompt": prompt,
            "revised_prompt": revised_prompt,
            "size": image_size,
            "quality": quality,
        },
        repo_root=repo_root,
    )
    return {
        "status": "ok",
        "tool": "generate_image",
        "provider": "openai",
        "model": model,
        "filename": filename,
        "url": generated_image_url(filename),
        "path": str(generated_image_path(filename, repo_root)),
        "prompt": prompt,
        "revised_prompt": revised_prompt,
        "size": image_size,
        "quality": quality,
    }


def _generate_mock_image(
    prompt: str,
    *,
    title: str = "",
    size: str | None = None,
    repo_root: Path | None = None,
) -> dict[str, Any]:
    image_size = _normalize_size(size or DEFAULT_IMAGE_SIZE)
    width, height = _dimensions_from_size(image_size)
    lines = _wrapped_prompt_lines(prompt, max_chars=44, max_lines=9)
    text_lines = "\n".join(
        f'<text x="48" y="{148 + index * 38}" fill="#e8eef8" font-size="24">{html.escape(line)}</text>'
        for index, line in enumerate(lines)
    )
    border_width = width - 48
    border_height = height - 48
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <rect width="100%" height="100%" fill="#101114"/>
  <rect x="24" y="24" width="{border_width}" height="{border_height}" rx="20"
        fill="#191b20" stroke="#60d394" stroke-width="3"/>
  <text x="48" y="76" fill="#60d394" font-family="Segoe UI, sans-serif"
        font-size="28" font-weight="700">Robot 790 image prompt</text>
  <g font-family="Segoe UI, sans-serif">{text_lines}</g>
</svg>
"""
    filename = _write_image_bytes(
        svg.encode("utf-8"),
        prompt=prompt,
        title=title,
        provider="mock",
        ext="svg",
        repo_root=repo_root,
    )
    _write_metadata(
        filename,
        {"provider": "mock", "model": "prompt-card", "prompt": prompt, "size": image_size},
        repo_root=repo_root,
    )
    return {
        "status": "ok",
        "tool": "generate_image",
        "provider": "mock",
        "model": "prompt-card",
        "filename": filename,
        "url": generated_image_url(filename),
        "path": str(generated_image_path(filename, repo_root)),
        "prompt": prompt,
        "size": image_size,
    }


def _image_bytes_from_response(payload: dict[str, Any], *, httpx: Any) -> tuple[bytes, str]:
    data = payload.get("data")
    if not isinstance(data, list) or not data:
        return b"", ""
    first = data[0]
    if not isinstance(first, dict):
        return b"", ""
    revised_prompt = str(first.get("revised_prompt") or "").strip()
    b64_json = str(first.get("b64_json") or "").strip()
    if b64_json:
        try:
            return base64.b64decode(b64_json), revised_prompt
        except ValueError:
            return b"", revised_prompt
    image_url = str(first.get("url") or "").strip()
    if image_url:
        try:
            response = httpx.get(image_url, timeout=60.0, follow_redirects=True)
            response.raise_for_status()
            return bytes(response.content), revised_prompt
        except httpx.HTTPError:
            return b"", revised_prompt
    return b"", revised_prompt


def _write_image_bytes(
    content: bytes,
    *,
    prompt: str,
    title: str,
    provider: str,
    ext: str,
    repo_root: Path | None,
) -> str:
    output_dir = image_output_dir(repo_root)
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = _generated_filename(prompt=prompt, title=title, provider=provider, ext=ext)
    path = output_dir / filename
    path.write_bytes(content)
    return filename


def _write_metadata(filename: str, metadata: dict[str, Any], *, repo_root: Path | None) -> None:
    path = generated_image_path(filename, repo_root).with_suffix(".json")
    payload = {
        "created": datetime.now().isoformat(timespec="seconds"),
        "filename": filename,
        **metadata,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _generated_filename(*, prompt: str, title: str, provider: str, ext: str) -> str:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    slug = _slug(title or prompt) or "vision"
    digest = hashlib.sha256(f"{provider}\n{prompt}\n{stamp}".encode("utf-8")).hexdigest()[:8]
    return f"{stamp}-{provider}-{slug[:48]}-{digest}.{ext.lower()}"


def _provider_name(provider: str | None) -> str:
    value = (provider or os.getenv("ROBOT_790_IMAGE_PROVIDER") or DEFAULT_IMAGE_PROVIDER).strip().lower()
    return value or DEFAULT_IMAGE_PROVIDER


def _normalize_prompt(prompt: str) -> str:
    return re.sub(r"\s+", " ", str(prompt or "")).strip()[:MAX_PROMPT_CHARS]


def _normalize_size(size: str) -> str:
    value = str(size or DEFAULT_IMAGE_SIZE).strip().lower()
    if value == "auto":
        return value
    if not re.fullmatch(r"\d{3,4}x\d{3,4}", value):
        return DEFAULT_IMAGE_SIZE
    return value


def _normalize_openai_image_model(model: str | None) -> str:
    value = str(model or "").strip()
    if not value:
        env_model = os.getenv("ROBOT_790_OPENAI_IMAGE_MODEL", DEFAULT_OPENAI_IMAGE_MODEL).strip()
        return env_model or DEFAULT_OPENAI_IMAGE_MODEL
    return re.sub(r"[^A-Za-z0-9._:-]", "", value)[:80] or DEFAULT_OPENAI_IMAGE_MODEL


def _normalize_openai_image_quality(quality: str | None) -> str:
    value = str(quality or "").strip().lower()
    if value not in {"auto", "low", "medium", "high"}:
        value = os.getenv("ROBOT_790_OPENAI_IMAGE_QUALITY", DEFAULT_IMAGE_QUALITY).strip().lower()
    if value not in {"auto", "low", "medium", "high"}:
        return DEFAULT_IMAGE_QUALITY
    return value


def _dimensions_from_size(size: str) -> tuple[int, int]:
    if size == "auto":
        return 1024, 1024
    match = re.fullmatch(r"(\d{3,4})x(\d{3,4})", size)
    if not match:
        return 1024, 1024
    return int(match.group(1)), int(match.group(2))


def _safe_filename(filename: str) -> str:
    value = str(filename or "").strip()
    if "/" in value or "\\" in value:
        return ""
    raw = value
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,160}", raw):
        return ""
    if not raw.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".svg")):
        return ""
    return raw


def _slug(text: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


def _wrapped_prompt_lines(prompt: str, *, max_chars: int, max_lines: int) -> list[str]:
    words = prompt.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word[:max_chars]
        if len(lines) >= max_lines:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(lines) == max_lines and words:
        lines[-1] = f"{lines[-1][: max_chars - 3]}..."
    return lines or ["No prompt text."]


def _api_error_message(payload: dict[str, Any], status_code: int) -> str:
    error = payload.get("error") if isinstance(payload, dict) else None
    if isinstance(error, dict):
        message = str(error.get("message") or "").strip()
        if message:
            return f"OpenAI image request failed ({status_code}): {message}"
    return f"OpenAI image request failed with HTTP {status_code}."


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, ""))
    except ValueError:
        return default
