# Eric On Reachy

Eric on Reachy should not mean replacing Robot 790 with the stock Reachy Mini
conversation app. It should mean keeping Eric's existing brain, voice practice,
notes, curation, and tool contract, then adding Reachy Mini as another
embodiment.

The clean architecture:

```text
Robot 790 STS loop
  -> existing Eric prompt, voice, notes, idle loop, tools
  -> set_embodiment("reachy_mini")
  -> local Reachy adapter
  -> Reachy Mini SDK / robot app
  -> motion, gaze, expressions, sensors
```

## Principle

Eric is the personage. Reachy is a body.

Do not let a second conversation stack create a second Eric unless the run is
explicitly testing that. The first useful version should keep the language model,
TTS, STT, note files, and run logs on the Robot 790 workstation, then send only
bounded body commands to Reachy.

## Adapter Contract

The Reachy adapter should expose the same small HTTP surface that the ESP32 face
and browser face already use where possible:

- `GET /state`: current robot state, reachable sensors, battery/power if
  available, active expression, active motion, and any faults.
- `POST /emotion`: map Eric moods such as `curious`, `happy`, `focused`,
  `confused`, `sleepy`, and `mischief` to Reachy expression/motion presets.
- `POST /gaze`: map normalized `x` and `y` gaze to the safest available head,
  eye, or body orientation primitive.
- `POST /mouth`: accept mouth shape/talking energy even if the first adapter
  only maps it to a speaking/listening animation.
- `POST /beat`: map named beats such as `slow_smile`, `inspect`,
  `double_take`, `thoughtful`, `wary`, and `drowsy` to Reachy gestures.
- `POST /sleep`: enter a calm parked pose.
- `POST /release`: return control to autonomous idle pose.

The adapter can translate these calls into whatever the Reachy Mini SDK exposes.
The important part is that Eric keeps speaking in semantic body verbs; the
adapter owns the hardware details.

## Bring-Up Order

1. Install and verify the official Reachy Mini SDK outside Eric.
2. Run one deterministic smoke test with no LLM: connect, read state, look left,
   look right, nod or equivalent, park safely.
3. Build a small local HTTP adapter, probably on the workstation first, that
   converts Robot 790 face/body calls into Reachy SDK calls.
4. Add `reachy_mini` to `config/runtime.json` only after the adapter answers
   `/state` reliably.
5. Test manual UI switching with `set_embodiment`, still no autonomous idle.
6. Enable normal conversation face/body lifecycle cues.
7. Only then allow Eric to request Reachy gestures through tools.
8. Add sensor reads to Brain 3/body-verifier later, with three-state output:
   yes, no, or cannot tell from current sensors.

## Safety And Identity Notes

- Keep actuator limits deterministic. Generated text never outranks the adapter.
- Start with low-energy gestures and a parked pose.
- Treat Reachy sensors as live receipts only when they come from the current
  turn or current state read.
- Keep the stock Reachy conversation app as reference material, not as the
  active personality stack.
- If Reachy has its own app memory or persona layer enabled, call that a
  different experiment.

## References

- Reachy Mini SDK: https://github.com/pollen-robotics/reachy_mini
- Reachy Mini conversation app: https://github.com/pollen-robotics/reachy_mini_conversation_app
- Reachy Mini SDK quickstart: https://huggingface.co/docs/reachy_mini/SDK/quickstart
