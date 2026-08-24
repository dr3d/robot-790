import json
from pathlib import Path

from robot_790d.memory import (
    MAX_FACT_CHARS,
    clear_facts,
    forget_fact,
    format_memory_for_prompt,
    list_facts,
    memory_path_for_instance,
    normalize_fact_name,
    remember_fact,
)


def test_named_memory_adds_overwrites_caps_and_formats(tmp_path: Path) -> None:
    first = remember_fact(tmp_path, " User Name ", "  The user's name is Dave.  ")
    second = remember_fact(tmp_path, "user-name", "The user's name is Dr. 3D.")

    assert first is not None
    assert second is not None
    assert second.name == "user_name"
    assert [fact.fact for fact in list_facts(tmp_path)] == ["The user's name is Dr. 3D."]

    long_text = "x" * (MAX_FACT_CHARS + 20)
    stored_long = remember_fact(tmp_path, "long_fact", long_text)

    assert stored_long is not None
    assert len(stored_long.fact) == MAX_FACT_CHARS
    assert stored_long.fact.endswith("...")

    prompt = format_memory_for_prompt(tmp_path)
    assert prompt.startswith("Persistent named facts")
    assert "- user_name: The user's name is Dr. 3D." in prompt
    assert "- long_fact:" in prompt


def test_named_memory_reads_json_shape_and_forgets(tmp_path: Path) -> None:
    path = memory_path_for_instance(tmp_path)
    path.write_text(
        json.dumps(
            {
                "version": 1,
                "facts": [
                    {"name": "User Name", "fact": "The user's name is Dave.", "updatedAt": 1000},
                    {"name": "bad"},
                ],
            }
        ),
        encoding="utf-8",
    )

    removed = forget_fact(tmp_path, "user-name")

    assert removed is not None
    assert removed.name == "user_name"
    assert removed.fact == "The user's name is Dave."
    assert list_facts(tmp_path) == []


def test_named_memory_rejects_empty_values_and_can_clear(tmp_path: Path) -> None:
    assert normalize_fact_name(" Current Project ") == "current_project"
    assert remember_fact(tmp_path, "", "Something") is None
    assert remember_fact(tmp_path, "something", "") is None

    remember_fact(tmp_path, "current_project", "Robot 790")
    clear_facts(tmp_path)

    assert list_facts(tmp_path) == []
