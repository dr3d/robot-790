from types import SimpleNamespace

import pytest

from robot_790d.local_model_startup import (
    DOWNLOAD_OPT_IN, _prepare_nltk, _prepare_silero, configure_local_model_startup,
)


def fake_nltk(missing=()):
    calls = []

    def find(name, paths=None):
        calls.append((name, paths))
        if name in missing:
            raise LookupError(name)
        return name

    return SimpleNamespace(data=SimpleNamespace(find=find)), calls


def test_nltk_corrects_only_upstream_tagger_lookup_and_is_idempotent():
    nltk, calls = fake_nltk()
    _prepare_nltk(nltk, allow_downloads=False)
    wrapped = nltk.data.find
    _prepare_nltk(nltk, allow_downloads=False)
    assert nltk.data.find is wrapped
    assert nltk.data.find("tokenizers/averaged_perceptron_tagger_eng", ["cache"]) == "taggers/averaged_perceptron_tagger_eng"
    assert calls[-1] == ("taggers/averaged_perceptron_tagger_eng", ["cache"])
    assert nltk.data.find("tokenizers/other") == "tokenizers/other"


@pytest.mark.parametrize("resource", ["tokenizers/punkt_tab", "taggers/averaged_perceptron_tagger_eng"])
def test_missing_nltk_fails_clearly_without_download(resource):
    nltk, _ = fake_nltk([resource])
    with pytest.raises(RuntimeError, match=f"{DOWNLOAD_OPT_IN}=1"):
        _prepare_nltk(nltk, allow_downloads=False)


def test_download_opt_in_leaves_missing_resources_to_upstream_bootstrap():
    nltk, calls = fake_nltk(["taggers/averaged_perceptron_tagger_eng"])
    _prepare_nltk(nltk, allow_downloads=True)
    assert calls == []
    with pytest.raises(LookupError):
        nltk.data.find("tokenizers/averaged_perceptron_tagger_eng")


def fake_hub(tmp_path):
    calls = []
    hub = SimpleNamespace(get_dir=lambda: str(tmp_path),
                          load=lambda *args, **kwargs: calls.append((args, kwargs)))
    return hub, calls


@pytest.mark.parametrize("ref", ["master", "main"])
def test_silero_uses_existing_local_repository_without_github(tmp_path, ref):
    folder = tmp_path / f"snakers4_silero-vad_{ref}"
    folder.mkdir()
    (folder / "hubconf.py").touch()
    hub, calls = fake_hub(tmp_path)
    _prepare_silero(hub)
    wrapped = hub.load
    _prepare_silero(hub)
    assert hub.load is wrapped
    hub.load("snakers4/silero-vad", "silero_vad", trust_repo=True, skip_validation=True)
    assert calls == [((str(folder), "silero_vad"),
                      {"source": "local", "trust_repo": True, "skip_validation": True})]


def test_missing_silero_fails_without_network_fallback(tmp_path):
    hub, calls = fake_hub(tmp_path)
    _prepare_silero(hub)
    with pytest.raises(RuntimeError, match=f"{DOWNLOAD_OPT_IN}=1"):
        hub.load("snakers4/silero-vad", "silero_vad")
    assert calls == []


def test_other_torch_loads_and_explicit_local_paths_unchanged(tmp_path):
    hub, calls = fake_hub(tmp_path)
    _prepare_silero(hub)
    hub.load("different/repository", "other", 42)
    hub.load("snakers4/silero-vad", "silero_vad", source="local")
    assert calls == [(("different/repository", "other", 42), {}),
                     (("snakers4/silero-vad", "silero_vad"), {"source": "local"})]


@pytest.mark.parametrize("allow", [False, True])
def test_process_only_configuration_and_explicit_download_opt_in(monkeypatch, tmp_path, allow):
    import sys
    nltk, _ = fake_nltk()
    hub, _ = fake_hub(tmp_path)
    monkeypatch.setitem(sys.modules, "nltk", nltk)
    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(hub=hub))
    monkeypatch.setenv(DOWNLOAD_OPT_IN, "1" if allow else "")
    monkeypatch.delenv("HF_HUB_OFFLINE", raising=False)
    monkeypatch.delenv("TRANSFORMERS_OFFLINE", raising=False)
    monkeypatch.setenv("OPENAI_BASE_URL", "http://127.0.0.1:1234/v1")
    configure_local_model_startup()
    import os
    assert os.environ.get("HF_HUB_OFFLINE") == (None if allow else "1")
    assert os.environ.get("TRANSFORMERS_OFFLINE") == (None if allow else "1")
    assert os.environ["OPENAI_BASE_URL"] == "http://127.0.0.1:1234/v1"
    assert bool(getattr(hub.load, "_robot790_local_silero", False)) is not allow
