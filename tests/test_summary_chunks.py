import asyncio
import json
from pathlib import Path

import pytest

from robot_790d.summary_chunk_lab import local_completion, run_experiment
from robot_790d.summary_chunks import (
    MAX_INPUT_CHARS,
    chunk_input,
    memory_request,
    merge_batches,
    merge_input,
    parse_memories,
    split_transcript,
)


def transcript(count=30, width=100):
    return "\n".join(f"[{i}] You: {str(i).ljust(width, 'x')}" for i in range(count))


def payload(items, finish="stop"):
    return {"choices": [{"finish_reason": finish, "message": {"content": json.dumps({"memories": items})}}]}


def item(ids, text="Scott discussed a test."):
    return {"source_turn_ids": ids, "text": text}


def test_chunks_cover_every_turn_once_with_whole_turn_overlap():
    turns, chunks = split_transcript(transcript(), target_chars=400, overlap_turns=2)
    assert len(chunks) > 1
    assert [i for chunk in chunks for i in chunk.owned_ids] == list(range(30))
    assert chunks[1].context_ids[0] == chunks[1].owned_ids[0] - 2
    for chunk in chunks:
        data = chunk_input(chunk, turns)
        assert all(entry["text"] == turns[entry["id"]] for entry in data["source_turns"])
        assert all(entry["context_only"] == (entry["id"] not in chunk.owned_ids)
                   for entry in data["source_turns"])


def test_multiline_turn_is_not_split():
    turns, chunks = split_transcript("[now] You: first\ncontinued\n[now] Robot 790: second", target_chars=256)
    assert turns == ["[now] You: first\ncontinued", "[now] Robot 790: second"]
    assert chunks[0].owned_ids == (0, 1)


@pytest.mark.parametrize("options", [{"target_chars": True}, {"target_chars": 255}, {"target_chars": 12001},
                                     {"overlap_turns": -1}, {"overlap_turns": 5}, {"overlap_turns": False}])
def test_invalid_chunk_settings(options):
    with pytest.raises(ValueError):
        split_transcript(transcript(), **options)


def test_oversize_turn_and_overlap_fail_without_truncating():
    with pytest.raises(ValueError, match="oversized"):
        split_transcript(transcript(1, 13000))
    with pytest.raises(ValueError, match="overlap exceeds"):
        split_transcript(transcript(4, 10000))


def test_long_session_bounded_maps_and_merges_retain_all_evidence():
    turns, chunks = split_transcript(transcript(1500, 200))
    assert sum(map(len, turns)) > 300000  # Beyond the production whole-transcript limit.
    assert [i for c in chunks for i in c.owned_ids] == list(range(len(turns)))
    for chunk in chunks:
        memory_request("extract", chunk_input(chunk, turns), model="test", thinking=False)
    memories = [item([i]) for i in range(len(turns))]
    batches = merge_batches(memories, turns)
    assert len(batches) > 1
    assert [m for batch in batches for m in batch] == memories
    for batch in batches:
        assert len(json.dumps(merge_input(batch, turns), ensure_ascii=False)) <= MAX_INPUT_CHARS


def test_unbounded_single_memory_is_rejected():
    with pytest.raises(ValueError, match="source evidence exceeds"):
        merge_batches([item(list(range(30)))], transcript(30, 1000).splitlines())


@pytest.mark.parametrize("bad", [[item([999])], [item([True])], [item([0, 0])], [item([])],
                                  [item([0], "")], [item([0], "x" * 5001)], [item([0])] * 33])
def test_invalid_memories_rejected(bad):
    with pytest.raises(ValueError):
        parse_memories(payload(bad), {0, 1})


def test_incomplete_or_overlap_only_rejected():
    with pytest.raises(ValueError):
        parse_memories(payload([], "length"), {0})
    with pytest.raises(ValueError, match="only concerns overlap"):
        parse_memories(payload([item([0])]), {0, 1}, {1})
    assert parse_memories(payload([item([0, 1])]), {0, 1}, {1}) == [item([0, 1])]


def test_request_limits_and_thinking():
    with pytest.raises(ValueError, match="exceeds its bound"):
        memory_request("extract", "x" * MAX_INPUT_CHARS, model="test", thinking=False)
    request = memory_request("extract", {}, model="test", thinking=True)
    assert request["max_tokens"] == 16384
    assert request["chat_template_kwargs"] == {"enable_thinking": True}


def source_file(tmp_path: Path, count=12):
    source = tmp_path / "session.txt"
    source.write_text("Transcript\n----------\n" + transcript(count), encoding="utf-8")
    return source


async def fake_completion(request):
    data = json.loads(request["messages"][1]["content"])
    if "owned_turn_ids" in data:
        return payload([item([i]) for i in data["owned_turn_ids"]])
    return payload(data["candidates"])


def test_completed_trial_reuses_checkpoints_and_preserves_source(tmp_path):
    source = source_file(tmp_path)
    original = source.read_bytes()
    output = tmp_path / "trial"
    result = asyncio.run(run_experiment(source, output, model="test", complete=fake_completion))

    async def forbidden(request):
        pytest.fail("Completed checkpoints must not call the model again")

    assert asyncio.run(run_experiment(source, output, model="test", complete=forbidden)) == result
    assert result["status"] == "draft-unreviewed"
    assert source.read_bytes() == original
    assert not list(tmp_path.glob("*.summary.txt"))
    with pytest.raises(ValueError, match="identity changed"):
        asyncio.run(run_experiment(source, output, model="different", complete=forbidden))


def test_cancelled_trial_resumes_completed_chunks(tmp_path):
    source = source_file(tmp_path)
    output = tmp_path / "trial"
    calls = 0

    async def interrupt(request):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise asyncio.CancelledError()
        return await fake_completion(request)

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(run_experiment(source, output, model="test", target_chars=400, complete=interrupt))
    checkpoint = (output / "extract-000.json").read_bytes()
    assert not (output / "result.json").exists()
    result = asyncio.run(run_experiment(source, output, model="test", target_chars=400, complete=fake_completion))
    assert result["memory_count"] == 12
    assert (output / "extract-000.json").read_bytes() == checkpoint
    assert len(list(output.glob("*.failed-*.json"))) == 1


def test_source_change_blocks_final_draft(tmp_path):
    source = source_file(tmp_path)
    output = tmp_path / "trial"

    async def mutate(request):
        source.write_text("changed", encoding="utf-8")
        return await fake_completion(request)

    with pytest.raises(ValueError, match="Source changed"):
        asyncio.run(run_experiment(source, output, model="test", complete=mutate))
    assert not (output / "result.json").exists()


def test_existing_unidentified_directory_is_not_overwritten(tmp_path):
    source = source_file(tmp_path)
    output = tmp_path / "trial"
    output.mkdir()
    (output / "precious.txt").write_text("keep", encoding="utf-8")
    with pytest.raises(ValueError, match="nonempty"):
        asyncio.run(run_experiment(source, output, model="test", complete=fake_completion))
    assert (output / "precious.txt").read_text() == "keep"


def test_invalid_completion_is_saved_but_never_checkpointed_as_success(tmp_path):
    source = source_file(tmp_path)
    output = tmp_path / "trial"

    async def truncated(request):
        return payload([], "length")

    with pytest.raises(ValueError, match="did not finish"):
        asyncio.run(run_experiment(source, output, model="test", complete=truncated))
    assert not (output / "extract-000.json").exists()
    record = json.loads(next(output.glob("*.failed-*.json")).read_text())
    assert record["response"]["choices"][0]["finish_reason"] == "length"
    assert "error" in record


def test_live_sts_prevents_model_request(monkeypatch):
    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"in_use": 1}

    class Client:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, url):
            return Response()

        async def post(self, *args, **kwargs):
            pytest.fail("An active STS session must prevent lab inference")

    monkeypatch.setattr("robot_790d.summary_chunk_lab.httpx.AsyncClient", Client)
    with pytest.raises(RuntimeError, match="takes priority"):
        asyncio.run(local_completion({}))


def test_long_trial_produces_sections_instead_of_truncating_evidence(tmp_path):
    source = source_file(tmp_path, count=800)
    output = tmp_path / "trial"

    async def compress(request):
        data = json.loads(request["messages"][1]["content"])
        ids = data.get("owned_turn_ids")
        if ids is None:
            ids = sorted({i for memory in data["candidates"] for i in memory["source_turn_ids"]})
        return payload([item(ids)])

    result = asyncio.run(run_experiment(source, output, model="test", complete=compress))
    assert result["consolidation"] == "sectioned-no-global-dedup"
    retained = {i for section in result["sections"] for memory in section for i in memory["source_turn_ids"]}
    assert retained == set(range(800))


def test_reuse_extraction_is_source_and_request_bound(tmp_path):
    source = source_file(tmp_path)
    donor = tmp_path / "donor"
    asyncio.run(run_experiment(source, donor, model="test", complete=fake_completion))
    calls = []

    async def merge_only(request):
        data = json.loads(request["messages"][1]["content"])
        assert "candidates" in data
        calls.append(request)
        return await fake_completion(request)

    output = tmp_path / "compact"
    asyncio.run(run_experiment(source, output, model="test", compact=True,
                               extraction_from=donor, complete=merge_only))
    assert len(calls) == 1
    receipt = json.loads((output / "extract-000.json").read_text())
    assert receipt["reused_from"] == str((donor / "extract-000.json").resolve())
    with pytest.raises(ValueError, match="Checkpoint request changed"):
        asyncio.run(run_experiment(source, tmp_path / "wrong-model", model="other",
                                   extraction_from=donor, complete=merge_only))
    source.write_text("Transcript\n----------\n" + transcript(3), encoding="utf-8")
    with pytest.raises(ValueError, match="different source"):
        asyncio.run(run_experiment(source, tmp_path / "wrong-source", model="test",
                                   extraction_from=donor, complete=merge_only))


def test_live_connect_cancels_inflight_lab_request(monkeypatch):
    checks = 0
    cancelled = False
    real_wait = asyncio.wait

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"in_use": 0 if checks == 1 else 1}

    class Client:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, url):
            nonlocal checks
            checks += 1
            return Response()

        async def post(self, *args, **kwargs):
            nonlocal cancelled
            try:
                await asyncio.Event().wait()
            finally:
                cancelled = True

    async def short_wait(tasks, timeout):
        return await real_wait(tasks, timeout=0.001)

    monkeypatch.setattr("robot_790d.summary_chunk_lab.httpx.AsyncClient", Client)
    monkeypatch.setattr("robot_790d.summary_chunk_lab.asyncio.wait", short_wait)
    with pytest.raises(RuntimeError, match="takes priority"):
        asyncio.run(local_completion({}))
    assert cancelled
