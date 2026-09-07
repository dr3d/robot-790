from pathlib import Path

from robot_790d.note_files import read_note_file, write_note_file
from robot_790d.passivation import extract_passivated_session_notes, parse_passivated_sessions


PASSIVATED_ONE = """Eric Passivated State Transcript
================================
Created: 9/7/2026, 11:26:25 AM
Continuity file: core/passivated_eric_state.txt

Session Demarcation
-------------------
Model: llm=test-model
Session time at passivation: SESSION 0:02:03
Conversation lines: 2
First transcript turn on disk: 9/7/2026, 3:38:00 AM (2026-09-07T07:38:00.917Z)
Last transcript turn on disk: 9/7/2026, 3:39:00 AM (2026-09-07T07:39:00.000Z)
Context mode at save: normal
Previous-run loaded notes: core/erics_memories.txt
Search receipts: none

Runtime At Save
---------------
Mic at passivation: on
Runtime routines at passivation: none
Previous-run sensing input: none
Last user words: goodnight

Transcript Since Clean Connect
------------------------------
[3:38:00 AM] You: Hello.
[3:38:03 AM] Robot 790: I am here.

B2 Notes For Eric
------------------
- none

Recent Brain2 Tail
------------------
[none]
"""


def test_parse_passivated_sessions_extracts_metadata() -> None:
    sessions = parse_passivated_sessions(PASSIVATED_ONE)

    assert len(sessions) == 1
    assert sessions[0].conversation_lines == "2"
    assert sessions[0].first_turn.startswith("9/7/2026, 3:38:00 AM")
    assert "[3:38:03 AM] Robot 790: I am here." in sessions[0].transcript


def test_parse_passivated_sessions_splits_multiple_records() -> None:
    content = f"{PASSIVATED_ONE}\n\n{PASSIVATED_ONE.replace('3:38:00 AM', '4:38:00 AM')}"

    sessions = parse_passivated_sessions(content)

    assert [session.index for session in sessions] == [1, 2]
    assert sessions[1].first_turn.startswith("9/7/2026, 4:38:00 AM")


def test_extract_passivated_session_notes_writes_per_session_note(tmp_path: Path) -> None:
    write_note_file(tmp_path, "core/passivated_eric_state.txt", PASSIVATED_ONE)

    result = extract_passivated_session_notes(tmp_path)

    assert result["status"] == "ok"
    assert result["session_count"] == 1
    assert result["written_count"] == 1
    written = result["notes"][0]["filename"]
    assert written == "sessions/passivated-session-20260907-073800.txt"
    note = read_note_file(tmp_path, written)
    assert "Robot 790 Extracted Session Note" in note.content
    assert "It preserves the session transcript and receipts; it is not an AI summary." in note.content
    assert "[3:38:00 AM] You: Hello." in note.content


def test_extract_passivated_session_notes_uses_unique_filename(tmp_path: Path) -> None:
    write_note_file(tmp_path, "core/passivated_eric_state.txt", PASSIVATED_ONE)
    extract_passivated_session_notes(tmp_path)

    result = extract_passivated_session_notes(tmp_path)

    assert result["notes"][0]["filename"] == "sessions/passivated-session-20260907-073800-02.txt"
