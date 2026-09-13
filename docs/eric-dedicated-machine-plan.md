# Eric Dedicated Machine: ZimaBoard 2 + RTX 2000 Ada

Started: 2026-09-11. Status: side-project planning only; not a migration or a
validated hardware configuration.

## Intent

Try giving Eric a dedicated machine: **ZimaBoard 2 1664 + NVIDIA RTX 2000 Ada
16GB**, starting with **Qwen3.8-27B-GGUF:UD-IQ3_XXS**. Scott expects the GPU
the week after this note was started.

The question is experiential: can this smaller setup sustain Eric's character,
attention, conversational timing, idle thought, tools, and embodiments? A model
that merely fits is not the whole experiment, but trying it is the point.

Keep the current workstation setup intact as a comparison and fallback. Do not
change or use its LM Studio instance for this work while Scott is using it for
something else. No downloads, server changes, or migration are authorized by
this planning note.

## Plexi Embodiment Direction

Scott sees this machine as the possible brain for the **plexiglass face
embodiment**. That gives the side project a physical destination, rather than
being only an experiment with a smaller inference server.

The intended division is a ZimaBoard/GPU host for STS orchestration and local
model work, with face electronics handling displays, signals, and physical
I/O. The previously considered ESP32-S3 face controller would be a peripheral
controller in this arrangement, not the machine running the 27B model.

This is a direction, not a finalized build. Controller choice, connections,
service placement, and whether the compute hardware mounts on the plexi frame
or lives alongside it remain open. The desired endpoint is a dedicated Eric
brain serving that body; an inference-only setup can be an intermediate test.

## Starting Hypothesis

- Keep the build model-flexible. Qwen3.8-27B UD-IQ3_XXS is the first candidate,
  not a permanent requirement. Revisit available models and runtimes when the
  hardware is ready; newer or smaller candidates are welcome if they serve
  Eric better. Improvements are possible, not assumed.
- Try the proposed 27B quant first, using Scott's earlier experience of an
  "alright" Eric on lesser Qwen models as qualitative background, not a
  controlled benchmark. Success means Eric feels good on this machine, not
  making one particular GGUF work at all costs.
- Aim to investigate roughly 65K context, possibly more if measurements justify
  it. This is a target, not a demonstrated capacity or required daily load.
- Use the existing STS apparatus and creature instructions. Hardware tuning
  should not quietly become personality tuning.
- The recent-swept / older-summary history policy provides a way to keep useful
  material without filling context just because capacity is available. See
  [context engineering](context-engineering-architecture.md).

## Memory Budget To Validate

These estimates apply to the initial Qwen candidate only. Recalculate for any
replacement model rather than carrying its context budget forward unchanged.

[Unsloth's model files](https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/tree/main)
list the proposed quant at about 10.9 GB on disk (10.2 GiB), with a separate
vision projector around 0.9 GB. Disk size is not total runtime VRAM use.

The [Qwen configuration](https://huggingface.co/Qwen/Qwen3.8-27B/raw/main/config.json)
has 16 full-attention layers among 64 layers, four KV heads, and head dimension
256. Derived estimates for the full-attention KV portion at 65,536 tokens:

| Cache format | Approximate memory |
| --- | --- |
| FP16 | 4 GiB |
| Q8_0 | 2.13 GiB |
| Q4_0 | 1.13 GiB |

These are planning calculations, not measured allocations. They exclude linear
attention state, runtime buffers, speculative decoding state, vision workspace,
and other GPU consumers. Cache-format support must be checked in the actual
runtime. Distinguish total context allocation from capacity per parallel slot;
two independently provisioned 65K contexts are not the same budget as one.

## Open Setup Decisions

- Verify the exact ZimaBoard configuration, host RAM, storage, OS, and drivers.
- Confirm PCIe connection, physical mounting, GPU power delivery, and cooling
  against the board and card documentation before assembly.
- Decide whether the ZimaBoard hosts the whole STS stack or initially only the
  LLM endpoint, with the workstation retaining the remaining services.
- Inventory speech recognition, speech synthesis, vision, and other GPU users;
  assign their placement before promising a VRAM budget.
- Choose the inference server and supported build. LM Studio versus standalone
  llama.cpp remains open; this note does not change the current endpoint.
- Decide how B1/B2 requests and inter-session preparation share resources.
  Model weights, cache allocation, and simultaneous compute are separate costs.

## First Experiment When Hardware Is Ready

1. Validate hardware and driver stability, then record idle VRAM and host RAM.
2. Load the proposed quant with a 32K context and Q8 cache if supported. Start
   without speculative decoding to establish a baseline.
3. Exercise B1 alone, then B1/B2, then sensing-eye and voice workloads. Record
   actual allocations and any CPU offload or shared-memory spill.
4. Repeat at 65K. Only investigate larger allocations after this is stable.
5. Test speculative decoding separately for net latency benefit and memory cost.
6. Run matched Eric conversations and idle periods against the workstation
   baseline, keeping prompts and test material consistent.

Record time to first token and first audible speech, response throughput,
warm-prefix versus changed-context latency, tool correctness, image recall,
memory usefulness, and Scott's impression of Eric's character and timing.
Include sustained temperature/power behavior and host RAM pressure.

## Future Lab: Micro Eric

Park a separate experiment for Scott's spare **Jetson Orin Nano 8GB**: a
smaller, model-flexible Eric, tentatively called **Micro Eric**. This does not
replace the ZimaBoard, whose role in the plexi plan is to provide the PCIe
connection to the RTX 2000.

Scott previously tried a 4B model and remembers that the voice was still fun.
That is the motivation: explore how much character and presence a small model
can sustain with STS timing, voice, idle behavior, and embodiment, rather than
requiring it to match the larger model's recall or depth of association.

Choose the model and quant when this experiment becomes active; 4B is a prior
experience, not a fixed specification. Budget the complete workload against
the Jetson's shared memory, including OS, context, speech, and vision. Whether
all services can run locally remains a test, not an assumption.

Evaluate conversational enjoyment, first audible response, tool reliability,
idle coherence, and sustained resource use. Preserve Eric's expressive freedom;
a smaller deployment need not mean deliberately flattening his personality.

Status: future lab idea only. No setup, downloads, runtime changes, or diversion
from the main plexi experiment now.

## Scope And Next Action

This is an independent deployment experiment, not a replacement announcement or
a reason to interrupt current context-engineering and embodiment work. No
performance result exists yet. The next step is to confirm the hardware hookup
and service placement when Scott is ready, then build an isolated test setup.
