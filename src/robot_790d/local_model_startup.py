"""Keep the realtime voice process independent of model-hosting availability."""

from __future__ import annotations

import os
from functools import wraps
from pathlib import Path
from typing import Any


DOWNLOAD_OPT_IN = "ROBOT_790_ALLOW_MODEL_DOWNLOADS"


def _prepare_nltk(nltk: Any, *, allow_downloads: bool) -> None:
    resources = ("tokenizers/punkt_tab", "taggers/averaged_perceptron_tagger_eng")
    if not allow_downloads:
        for resource in resources:
            try:
                nltk.data.find(resource)
            except (LookupError, OSError) as exc:
                raise RuntimeError(
                    f"Missing local NLTK resource {resource}. Connect once and run "
                    f"with {DOWNLOAD_OPT_IN}=1 to install voice resources."
                ) from exc
    if getattr(nltk.data.find, "_robot790_tagger_lookup", False):
        return
    original = nltk.data.find

    @wraps(original)
    def find(resource_name: str, paths: Any = None) -> Any:
        # The upstream startup check incorrectly looks for a tagger under tokenizers.
        if resource_name == "tokenizers/averaged_perceptron_tagger_eng":
            resource_name = "taggers/averaged_perceptron_tagger_eng"
        return original(resource_name, paths)

    find._robot790_tagger_lookup = True
    nltk.data.find = find


def _prepare_silero(hub: Any) -> None:
    if getattr(hub.load, "_robot790_local_silero", False):
        return
    original = hub.load

    @wraps(original)
    def load(repo_or_dir: str, model: str, *args: Any, **kwargs: Any) -> Any:
        if kwargs.get("source", "github") == "github" and repo_or_dir in {
            "snakers4/silero-vad", "snakers4/silero-vad:master", "snakers4/silero-vad:main"
        }:
            refs = [repo_or_dir.split(":", 1)[1]] if ":" in repo_or_dir else ["master", "main"]
            directories = [Path(hub.get_dir()) / f"snakers4_silero-vad_{ref}" for ref in refs]
            cached = next((folder for folder in directories if (folder / "hubconf.py").is_file()), None)
            if cached is None:
                raise RuntimeError(
                    f"Missing local Silero VAD cache in {hub.get_dir()}. Connect once and "
                    f"run with {DOWNLOAD_OPT_IN}=1 to install voice resources."
                )
            repo_or_dir = str(cached)
            kwargs = {**kwargs, "source": "local"}
        return original(repo_or_dir, model, *args, **kwargs)

    load._robot790_local_silero = True
    hub.load = load


def configure_local_model_startup() -> None:
    """Call before speech/Transformers imports; settings affect only this process."""
    allow_downloads = os.environ.get(DOWNLOAD_OPT_IN, "").strip() == "1"
    if not allow_downloads:
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"

    import nltk
    import torch

    _prepare_nltk(nltk, allow_downloads=allow_downloads)
    if not allow_downloads:
        _prepare_silero(torch.hub)
    print(f"Robot 790 voice resources: {'downloads permitted' if allow_downloads else 'local cache only'}", flush=True)
