"""Load a local LM Studio model with bounded brain-switch prompt caching.

The installed SDK's high-level load config predates these engine fields. Keep
the small raw KV-config adapter here, using LM Studio's loadModel/getLoadConfig
protocol and the SDK's existing transport. Fail closed if settings are ignored.
"""

from __future__ import annotations

import argparse
import json

import lmstudio
from lmstudio._sdk_models import LlmChannelLoadModelCreationParameter, LlmLoadModelConfig
from lmstudio.json_api import LoadModelEndpoint


def build_endpoint(model: str, identifier: str, context: int, parallel: int,
                   mtp: str, checkpoints: int, cache_mib: int):
    if not model or not identifier or mtp not in {"on", "off", "default"}:
        raise ValueError("Invalid model identifier or MTP setting")
    if not (4096 <= context <= 262144 and 1 <= parallel <= 8
            and 1 <= checkpoints <= 32 and 1024 <= cache_mib <= 65536):
        raise ValueError("Invalid context, parallel, checkpoint, or cache limit")
    endpoint = LoadModelEndpoint(
        model, identifier, None, LlmChannelLoadModelCreationParameter,
        LlmLoadModelConfig, {"contextLength": context, "gpu": {"ratio": "max"}}, None,
    )
    overrides = {
        "llm.load.numParallelSessions": parallel,
        "llm.load.llama.contextCheckpoints": checkpoints,
        "llm.load.llama.argumentsOverride": {
            "enabled": True, "disabledParameters": [], "excludeAllConfig": False,
            "overrideParameters": [{"key": "--cache-ram", "value": str(cache_mib)}],
        },
    }
    if mtp != "default":
        overrides["llm.load.speculativeDecoding.draftMtp"] = mtp == "on"
    fields = endpoint.creation_params["loadConfigStack"]["layers"][0]["config"]["fields"]
    fields.extend({"key": key, "value": value} for key, value in overrides.items())
    expected = {field["key"]: field["value"] for field in fields}
    return endpoint, expected


def verify_config(raw: dict, expected: dict) -> None:
    actual = {field["key"]: field["value"] for field in raw["fields"]}
    wrong = [key for key, value in expected.items() if actual.get(key) != value]
    if wrong:
        raise RuntimeError("LM Studio did not confirm requested load settings: " + ", ".join(wrong))


def load_model(model: str, identifier: str, context: int, parallel: int,
               mtp: str, checkpoints: int, cache_mib: int) -> dict:
    endpoint, expected = build_endpoint(model, identifier, context, parallel, mtp, checkpoints, cache_mib)
    with lmstudio.Client("127.0.0.1:1234") as client:
        with client.llm._create_channel(endpoint) as channel:
            result = channel.wait_for_result()
        if result.identifier != identifier:
            raise RuntimeError("LM Studio loaded an unexpected model identifier")
        params = client.llm._API_TYPES.REQUEST_LOAD_CONFIG._from_api_dict({
            "specifier": {"type": "query", "query": {"identifier": identifier}},
        })
        raw = client.llm.remote_call("getLoadConfig", params)
        verify_config(raw, expected)
    return {"model": identifier, "context_length": context, "parallel": parallel,
            "context_checkpoints": checkpoints, "cache_ram_mib": cache_mib, "mtp": mtp}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True)
    parser.add_argument("--identifier", required=True)
    parser.add_argument("--context", type=int, required=True)
    parser.add_argument("--parallel", type=int, required=True)
    parser.add_argument("--mtp", choices=("on", "off", "default"), required=True)
    parser.add_argument("--checkpoints", type=int, required=True)
    parser.add_argument("--cache-mib", type=int, required=True)
    args = parser.parse_args()
    print(json.dumps(load_model(args.model, args.identifier, args.context, args.parallel,
                                args.mtp, args.checkpoints, args.cache_mib)))


if __name__ == "__main__":
    main()
