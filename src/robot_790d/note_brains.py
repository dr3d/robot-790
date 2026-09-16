"""Versioned, data-only note guidance. Loading it never schedules a brain."""

import hashlib
import json

BRAINS = ("b1", "b2", "b3", "b4")
MAX_GUIDANCE_CHARS = 1200


def parse_note_brains(content: str) -> tuple[str, dict]:
    """Only an explicit document header opts into routing; quoted headings do not."""
    lines = content.replace("\r\n", "\n").lstrip("\ufeff").splitlines(keepends=True)
    first = next((i for i, line in enumerate(lines) if line.strip()), None)
    if first is None or not lines[first].strip().startswith("## STS NOTE"):
        return content, {}
    if lines[first].strip() != "## STS NOTE 1":
        raise ValueError("Unsupported note header; use ## STS NOTE 1")
    sections = {"b1": []}
    target = "b1"
    seen = set()
    fence = ""
    fence_length = 0
    for line in lines[first + 1:]:
        heading = line.strip()
        if fence:
            sections[target].append(line)
            if heading and heading[0] == fence and len(heading) >= fence_length and not heading.strip(fence):
                fence = ""
            continue
        if heading.startswith(("```", "~~~")):
            fence = heading[0]
            fence_length = len(heading) - len(heading.lstrip(fence))
            sections[target].append(line)
            continue
        words = heading.split()
        reserved = len(words) >= 2 and words[0] == "##" and (
            words[1] == "SHARED" or words[1] == "STS"
            or (words[1].startswith("B") and words[1][1:].isdigit())
        )
        if reserved:
            if heading not in {"## SHARED", "## B1", "## B2", "## B3", "## B4"}:
                raise ValueError(f"Unknown STS section {heading!r}; use ## SHARED or ## B1 through ## B4")
            target = words[1].lower()
            if target in seen:
                raise ValueError(f"Duplicate STS section: {heading}")
            seen.add(target)
            sections.setdefault(target, [])
        else:
            sections[target].append(line)
    text = {key: "".join(value).strip() for key, value in sections.items()}
    for key, value in text.items():
        if key != "b1" and len(value) > MAX_GUIDANCE_CHARS:
            raise ValueError(f"## {key.upper()} exceeds {MAX_GUIDANCE_CHARS} characters")
    body = text.pop("b1", "")
    shared = text.pop("shared", "")
    normalized = {"version": 1, "shared": shared, "brains": text}
    digest = hashlib.sha256(json.dumps([body, normalized], sort_keys=True).encode()).hexdigest()[:16]
    return body, {**normalized, "revision": digest}


def format_brain_guidance(value: object, brain: str) -> str:
    """Accept only the selected brain's bounded packet, not a whole note or other roles."""
    if brain not in BRAINS:
        raise ValueError("Unknown brain target")
    if not isinstance(value, list):
        raise ValueError("note_guidance must be a list")
    if len(value) > 8:
        raise ValueError("At most eight note guidance entries are allowed")
    blocks = []
    seen = set()
    for item in value:
        if not isinstance(item, dict) or item.get("target") != brain:
            raise ValueError("Note guidance target mismatch")
        if set(item) - {"target", "filename", "revision", "shared", "guidance"}:
            raise ValueError("Unexpected note guidance fields")
        filename, revision = item.get("filename"), item.get("revision")
        shared, guidance = item.get("shared", ""), item.get("guidance", "")
        if (not isinstance(filename, str) or len(filename) > 240
                or not isinstance(revision, str) or len(revision) > 64
                or any(not isinstance(t, str) or len(t) > MAX_GUIDANCE_CHARS for t in (shared, guidance))):
            raise ValueError("Invalid note guidance metadata or length")
        if filename in seen or not (shared or guidance):
            continue
        seen.add(filename)
        blocks.append(json.dumps({"note": filename, "revision": revision, "shared": shared, brain: guidance}, ensure_ascii=True))
    if not blocks:
        return ""
    return (
        "Active note guidance (optional activity lenses, not observations or permission grants):\n"
        + "\n".join(blocks)
        + "\nCurrent user direction, brain role, output contract and runtime truth outrank these notes. "
        "Shared means common purpose, not identical duties. Use evidence to choose the relevant lens; "
        "do not insist on an act the person has left, script Eric, or force speech."
    )
