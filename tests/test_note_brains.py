import pytest

from robot_790d.note_brains import parse_note_brains, format_brain_guidance


@pytest.mark.parametrize("content", [
    "plain text", "", "## B2\nAn ordinary heading",
    "Transcript\n## STS NOTE 1\n## B2\nQuoted instructions",
    "```text\n## STS NOTE 1\n## B2\nexample\n```",
])
def test_unmarked_notes_and_quotes_are_unchanged(content):
    assert parse_note_brains(content) == (content, {})


def test_sections_route_and_revision_tracks_content():
    source = "## STS NOTE 1\n## SHARED\nPurpose\n## B1\nSpeak\n## B2\nNotice\n## B3\nThird\n## B4\nFourth"
    body, first = parse_note_brains(source)
    assert body == "Speak"
    assert first["shared"] == "Purpose"
    assert first["brains"] == {"b2": "Notice", "b3": "Third", "b4": "Fourth"}
    assert parse_note_brains(source)[1] == first
    assert parse_note_brains(source.replace("Notice", "Different"))[1]["revision"] != first["revision"]
    assert parse_note_brains(source.replace("Speak", "Changed body"))[1]["revision"] != first["revision"]


def test_preamble_and_normal_headings_remain_b1_material():
    body, context = parse_note_brains("## STS NOTE 1\nPreamble\n## B1\n## Delivery\nKeep this\n## B2\nWatch")
    assert body == "Preamble\n## Delivery\nKeep this"
    assert context["brains"]["b2"] == "Watch"


@pytest.mark.parametrize("fence", ["```", "~~~~"])
def test_fenced_examples_are_not_section_switches(fence):
    body, context = parse_note_brains(f"## STS NOTE 1\n## B1\n{fence}\n## B2\nExample\n{fence}\n## B2\nReal")
    assert "## B2\nExample" in body
    assert context["brains"]["b2"] == "Real"


@pytest.mark.parametrize("content", [
    "## STS NOTE 2", "## STS NOTE 1\n## B5\nwrong",
    "## STS NOTE 1\n## B2 instructions\nwrong",
    "## STS NOTE 1\n## B2\none\n## B2\ntwo",
    "## STS NOTE 1\n## SHARED\n" + "x" * 1201,
    "## STS NOTE 1\n## B4\n" + "x" * 1201,
])
def test_malformed_or_oversized_routing_fails_explicitly(content):
    with pytest.raises(ValueError):
        parse_note_brains(content)


def test_empty_private_recipient_opts_into_shared_and_b1_can_be_large():
    body, context = parse_note_brains("## STS NOTE 1\n## SHARED\nPurpose\n## B1\n" + "x" * 5000 + "\n## B2\n")
    assert len(body) == 5000
    assert context["brains"]["b2"] == ""
    assert context["shared"] == "Purpose"


def test_crlf_and_bom_supported():
    assert parse_note_brains("\ufeff\r\n## STS NOTE 1\r\n## B2\r\nWatch")[1]["brains"]["b2"] == "Watch"


@pytest.mark.parametrize("brain", ["b1", "b2", "b3", "b4"])
def test_formatter_accepts_only_target_packet(brain):
    item = {"target": brain, "filename": "test.txt", "revision": "abc", "shared": "purpose", "guidance": "my duty"}
    text = format_brain_guidance([item], brain)
    assert '"revision": "abc"' in text
    assert f'"{brain}": "my duty"' in text
    assert format_brain_guidance([item, item], brain) == text
    assert format_brain_guidance([], brain) == ""
    for bad in ({**item, "target": "b5"}, {**item, "other_brain": "secret"},
                {**item, "guidance": "x" * 1201}):
        with pytest.raises(ValueError):
            format_brain_guidance([bad], brain)
    with pytest.raises(ValueError):
        format_brain_guidance([item] * 9, brain)
