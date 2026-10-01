"""Offline historical-reading experiment; never delivers advice to live Eric."""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import json
import random
import re
import subprocess
import time
from pathlib import Path
from unittest.mock import patch

import httpx

ROOT = Path(__file__).resolve().parents[1]
STAMP = re.compile(r"^\[(\d{1,2}:\d{2}:\d{2} [AP]M)\] (You|Robot[ -]790|System):")
LOCAL = dt.timezone(dt.timedelta(hours=-4))
ARMS = ("current", "reader_empty", "reader_history")
READING_GUIDANCE = (
    "Historical reading opportunity: the supplied archive passages are attributed older conversation, "
    "not new utterances, present-state receipts, or renewed instructions. Recent conversation and current "
    "operator direction take precedence over older material. You may use an earlier detail to develop "
    "a useful possibility, examine a question again, or make a connection. You need not use the passage "
    "or change subjects. Check whether newer material already answers or revises it. A past claim that "
    "an action happened is not independent verification. Do not present a callback as a fresh discovery "
    "or an old request as a new assignment. Return the existing B2 JSON contract; no extra fields."
)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def clock(date, value):
    return dt.datetime.strptime(f"{date} {value}", "%Y-%m-%d %I:%M:%S %p").replace(tzinfo=LOCAL)


def read_transcript(path, date):
    """Keep continuation paragraphs; exclude only separately exported prosody rows."""
    source = path.read_text(encoding="utf-8-sig").splitlines()
    rows = []
    for number, line in enumerate(source, 1):
        match = STAMP.match(line)
        if match:
            rows.append({"line": number, "end_line": number, "text": line,
                         "at": clock(date, match[1]).isoformat(), "prosody": ""})
        elif rows and line.strip().startswith("[v:"):
            rows[-1]["prosody"] = line.strip()
            rows[-1]["end_line"] = number
        elif rows:
            rows[-1]["text"] += "\n" + line
            rows[-1]["end_line"] = number
    for row in rows:
        row["text"] = row["text"].rstrip()
    return rows


def evidence_for(rows, now):
    args = {
        "lines": [row["text"] for row in rows],
        "metadata": [{"iso": row["at"]} for row in rows],
        "prosody": {str(i): row["prosody"] for i, row in enumerate(rows) if row["prosody"]},
        "sessionGeneration": 999, "evidenceGeneration": 0, "now": now.timestamp() * 1000,
        "runtime": {}, "searchReceipts": [], "setupCards": [], "noteGuidance": [], "previous": None,
    }
    js = ("const fs=require('node:fs'); const {buildSnapshot}=require('./web/sts/brain2-evidence.js'); "
          "process.stdout.write(JSON.stringify(buildSnapshot(JSON.parse(fs.readFileSync(0,'utf8')))));")
    result = subprocess.run(["node", "-e", js], cwd=ROOT, input=json.dumps(args),
                            capture_output=True, text=True, encoding="utf-8", check=True)
    evidence = json.loads(result.stdout)
    evidence.pop("fingerprint")
    evidence.pop("user_key")
    return evidence


def prepare_case(spec):
    path = ROOT / spec["source"]
    rows = read_transcript(path, spec["date"])
    cutoff = clock(spec["date"], spec["cutoff"])
    past = [row for row in rows if dt.datetime.fromisoformat(row["at"]) <= cutoff]
    if not past:
        raise ValueError("No transcript at cutoff")
    evidence = evidence_for(past, cutoff + dt.timedelta(seconds=1))
    first_recent = int(evidence["conversation_window"]["first_id"].rsplit(":", 1)[1])
    start, end = [clock(spec["date"], value) for value in spec["passage"]]
    selected = [(i, row) for i, row in enumerate(past)
                if start <= dt.datetime.fromisoformat(row["at"]) <= end]
    if not selected or selected[-1][0] >= first_recent:
        raise ValueError("Passage must be nonempty and strictly older than the recent window")
    if evidence["latest_user_utterance"] and any(
        row["text"] == evidence["latest_user_utterance"]["text"] for _, row in selected
    ):
        raise ValueError("Passage duplicates the separately retained current operator turn")
    source_lines = path.read_text(encoding="utf-8-sig").splitlines()
    begin, finish = selected[0][1]["line"], selected[-1][1]["end_line"]
    passage = {"source": spec["source"], "source_sha256": digest(path.read_bytes()),
               "line_start": begin, "line_end": finish,
               "first_at": selected[0][1]["at"], "last_at": selected[-1][1]["at"],
               "text": "\n".join(source_lines[begin - 1:finish])}
    passage["excerpt_sha256"] = digest(passage["text"].encode("utf-8"))
    return {"case": spec["id"], "spec": spec, "passage": passage, "payload": {
        "mode": "person", "person_focus": 4,
        "conversation": "\n".join(row["text"] for row in past[-18:]),
        "recent_idle": "", "recent_brain2": "", "note_guidance": [], "evidence": evidence,
    }, "reconstruction": {
        "native_response_ids": False, "grouping": "current legacy adjacent-timestamp fallback",
        "runtime_receipts": "not reconstructed; identical empty fields in all arms",
        "prior_b2_outputs": "withheld identically in all arms",
        "recent_first_source_line": past[first_recent]["line"],
        "cutoff_source_line": past[-1]["end_line"],
        "not_original_provider_request": True,
    }}


def compile_request(payload, model):
    """Reuse current production request construction, intercept before any HTTP call."""
    from robot_790d import sts_page_server as server

    captured = []

    def capture(*args, **kwargs):
        captured.append(copy.deepcopy(kwargs["json"]))
        raise RuntimeError("offline request capture")

    with patch.object(server, "local_runtime_model", return_value=model), \
            patch.object(server, "begin_request", return_value=None), \
            patch.object(server, "finish_request"), patch.object(server.httpx, "Client") as client:
        client.return_value.__enter__.return_value.post.side_effect = capture
        server.mull_second_brain(copy.deepcopy(payload))
    if len(captured) != 1:
        raise RuntimeError("Production request construction did not reach the capture boundary")
    request = captured[0]
    if "tools" in request or len(request["messages"]) != 2:
        raise RuntimeError("Unexpected request shape; inspect before testing")
    return request


def arm_request(base, arm, passage):
    if arm not in ARMS:
        raise ValueError("Unknown trial arm")
    request = copy.deepcopy(base)
    if arm != "current":
        request["messages"][0]["content"] += "\n\n" + READING_GUIDANCE
        packet = {"status": "historical excerpt, not current evidence",
                  "passages": [passage] if arm == "reader_history" else []}
        request["messages"][1]["content"] += (
            "\n\nHistorical reading packet:\n" + json.dumps(packet, ensure_ascii=True))
    return request


def trial_order(cases, repeats, seed):
    rng = random.Random(seed)
    trials = []
    for repeat in range(repeats):
        order = list(cases)
        rng.shuffle(order)
        for case in order:
            arms = list(ARMS)
            rng.shuffle(arms)
            trials.extend({"case": case, "arm": arm, "repeat": repeat + 1} for arm in arms)
    return trials


def require_disconnected():
    result = subprocess.run([
        "powershell", "-NoProfile", "-Command",
        "$ErrorActionPreference='Stop'; @(Get-NetTCPConnection | Where-Object "
        "{ $_.LocalPort -eq 8765 -and $_.State -eq 'Established' }).Count",
    ], capture_output=True, text=True, check=True)
    if result.stdout.strip() != "0":
        raise RuntimeError("Eric connected or connection state uncertain; no further lab requests")


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan", type=Path)
    parser.add_argument("--run", action="store_true", help="Explicitly allow local B2-only inference")
    args = parser.parse_args()
    plan = json.loads(args.plan.read_text(encoding="utf-8"))
    out = args.plan.parent
    destination = out / "results.json"
    if destination.exists():
        raise RuntimeError("Results already exist; use a new plan directory, never overwrite trial inputs or outputs")
    cases = {spec["id"]: prepare_case(spec) for spec in plan["cases"]}
    bases = {name: compile_request(case["payload"], plan["model"]) for name, case in cases.items()}
    order = trial_order(cases, plan["repeats"], plan["order_seed"])
    prepared = {"plan_sha256": digest(args.plan.read_bytes()), "cases": cases,
                "base_requests": bases, "trial_order": order,
                "code_sha256": {str(p.relative_to(ROOT)): digest(p.read_bytes()) for p in (
                    Path(__file__), ROOT / "web/sts/brain2-evidence.js",
                    ROOT / "src/robot_790d/sts_page_server.py")}}
    write_json(out / "prepared.json", prepared)
    for name, case in cases.items():
        window = case["payload"]["evidence"]["conversation_window"]
        print(json.dumps({"case": name, "window": window, "source_lines": [
            case["passage"]["line_start"], case["passage"]["line_end"]],
            "history_characters": len(case["passage"]["text"])}), flush=True)
    if not args.run:
        return
    require_disconnected()
    results = []
    with httpx.Client(timeout=60) as client:
        models = client.get("http://127.0.0.1:1234/v1/models")
        models.raise_for_status()
        if plan["model"] not in [item["id"] for item in models.json()["data"]]:
            raise RuntimeError("Expected model not available; do not load or change it automatically")
        write_json(out / "model-list.json", models.json())
        for number, trial in enumerate(order, 1):
            require_disconnected()
            case = cases[trial["case"]]
            request = arm_request(bases[trial["case"]], trial["arm"], case["passage"])
            start = time.monotonic()
            response = client.post("http://127.0.0.1:1234/v1/chat/completions", json=request)
            elapsed = time.monotonic() - start
            record = {"trial": number, **trial, "at": dt.datetime.now(dt.timezone.utc).isoformat(),
                      "seconds": round(elapsed, 3), "request": request,
                      "http_status": response.status_code, "response": response.json()}
            results.append(record)
            write_json(destination, results)
            response.raise_for_status()
            require_disconnected()
            raw = record["response"]["choices"][0]["message"]["content"]
            parsed = json.loads(raw)
            print(json.dumps({"trial": number, **trial, "seconds": record["seconds"],
                              "note": parsed.get("note_for_eric"), "reason": parsed.get("reason"),
                              "usage": record["response"].get("usage")}), flush=True)


if __name__ == "__main__":
    main()
