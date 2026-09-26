# Prosody And Mouth

Status: working architecture note.

## Long Speech Delivery

The realtime launcher streams LLM text one sentence at a time, but the TTS
handler can combine queued sentences before synthesis. Its 4096-token output
allowance is separate from faster-qwen3-tts's 2048-position CUDA buffer, which
also holds the text input. Increasing only the output allowance cannot prevent
that smaller buffer from filling during a long utterance.

`src/robot_790d/tts_capacity.py` partitions coalesced CustomVoice text using
tokenized input length and the handler's audio-duration estimate, leaving a
20% buffer reserve plus prompt overhead. It prefers sentence boundaries,
falls back to whitespace or characters, and preserves all text in order.
Cancellation abandons the remaining parts. The CUDA buffer and VRAM allocation
are unchanged. Other TTS backends keep their existing path.

The decoder logs input positions, generated audio tokens, configured budget,
buffer capacity and completion reason (`eos`, `sequence_capacity`,
`token_budget`, `cancelled`, or `error`). Unexpected limit stops are warnings.
The diagnostic wrapper classifies normal returns using the installed decoder's
loop boundaries; it does not claim that the audio spoke every word merely
because EOS was emitted. A real replay and speech-recognized ending check live
in `tests/helpers/tts_capacity_probe.py` (voice worker must be stopped first).

## Embodiment Channels

Robot 790's speech loop has two small embodiment channels wrapped around the
words:

```text
input prosody -> transcript context
output audio/text -> mouth motion
```

They are separate mechanisms. Input prosody is a low-authority note about how
the operator's utterance arrived. Mouth motion is a visual cue that Eric is
speaking through a body. Together they make the loop feel less like a detached
chat transcript and more like a creature sharing timing, pressure, and turn
taking in the room.

Neither channel is proof of emotion, understanding, or exact lip sync. They are
scaffolding: small signals that the system can use, inspect, correct, and tune.

## Input Prosody

When the realtime layer finishes transcribing a spoken user turn, STS may
receive a `voice_shape` field on the completed transcription event.

STS stores that value in two places:

- `lastInputVoiceShape`: the most recent user-turn prosody signal.
- `conversationProsodyByIndex`: a sidecar map from accepted transcript line to
  that turn's prosody string.

The transcript UI can display this sidecar in three modes:

- `off`: show only the words.
- `compact`: show a short tag under the turn.
- `full`: show the raw voice-shape string.

The compact form looks like this:

```text
[v: q-m-low/hi-mid/pauses]
```

The shorthand is deliberately small:

- `q`: quiet
- `m`: medium
- `l`: loud
- `p`: pause
- pitch labels such as `low`, `mid`, and `hi`
- features such as `hit`, `punchy`, `pauses`, `soft-end`, and `steady`

This is not emotion recognition. A quiet turn is not automatically sadness. A
loud turn is not automatically anger. Prosody is evidence for timing, pressure,
emphasis, hesitation, or mismatch. It only becomes meaningful when checked
against the words, logs, and surrounding events.

## Brain2 Use

Brain2 can receive a short tail of recent input prosody along with recent
conversation. Its prompt explicitly treats prosody as weak evidence, not
mind-reading.

That matters because the useful behavior is not "Scott sounds annoyed, so say
X." The useful behavior is closer to:

```text
The words were clipped and the turn ended softly; maybe do one smaller move.
```

or:

```text
There was a long hesitation before the correction; preserve uncertainty.
```

The point is not to diagnose the user. The point is to give the second lane a
little more shape around turn timing and conversational pressure.

## Output Mouth Motion

When Eric speaks, STS receives streaming output audio deltas. Each audio delta
does two things:

- queues PCM audio for playback,
- cues the active face into a speaking mouth state.

If output transcript text is also arriving, STS accumulates a short text tail
and uses it to choose coarse speech-mouth shapes. If no text is available yet,
it falls back to a simple loop.

The speech mouth ticks about every 90 ms. The text heuristic is intentionally
tiny:

```text
b/m/p                 -> closed
oo/ou/ow/o/u/w/q/r    -> round
th/f/v                -> teeth
ee/ea/i/y/s/z/sh/ch   -> wide
a/e                   -> open
other                 -> small
```

The fallback cycle is:

```text
closed -> small -> open -> wide -> small -> round -> open -> teeth
```

STS sends the face a `/mouth` update with ordinary mouth state plus a speech
substate:

```json
{
  "shape": "open",
  "talking": true,
  "energy": 0.72,
  "speech": {
    "active": true,
    "shape": "round",
    "energy": 0.72,
    "seq": 12
  }
}
```

When playback ends, is cancelled, or the face returns to idle, STS clears that
speech substate.

## Rendering

The browser face treats speech-mouth shapes as temporary pose targets. They do
not erase the underlying expression. Instead, the renderer blends the speech
pose into the current mouth pose.

That means Eric can be in a smile, smirk, neutral face, or grimace-like shape,
while speech briefly pulls the lips through coarse positions. In the browser
face:

- `round` renders through the `o` topology,
- `teeth` renders through the grimace/teeth topology,
- other speech shapes render through the normal open-mouth topology.

The full expressive vocabulary still comes from the face contract: `neutral`,
`smile`, `big_smile`, `smirk_left`, `smirk_right`, `open`, `o`, `wide`,
`tongue`, `frown`, `grimace`, `sneer`, and `sleep`.

Different embodiments may draw those states differently. The contract is the
shared language; browser canvas, ESP32 firmware, and other bodies remain native
renderers.

## Why It Enhances The Experience

Prosody and mouth motion help for practical reasons:

- Turn taking becomes visible. Listening, thinking, speaking, and idle have
  bodily cues.
- The user can see that Eric is speaking now, not just that audio is playing.
- The transcript keeps a little of how the user turn arrived, not only the
  words that survived STT.
- Brain2 gets a modest signal about timing and pressure without being invited
  to invent private emotional truth.
- PM work gets better evidence: words, events, audio, mouth state, and prosody
  can be compared after the run.

The effect is small but cumulative. A body does not need perfect lip sync to
change the room. It needs responsive timing, consistent vocabulary, visible
state, and repairable mistakes.

## Limits

For the September 8 source audit, research, and isolated next-generation rig,
see [Mouth Animation: From Pose Switching To Articulation](mouth-animation-research.md).
That study does not change the production behavior described here.

The system should keep these limits visible:

- `voice_shape` may be absent.
- Prosody tags can be wrong, vague, or too compressed.
- Prosody is not emotion detection and not biography.
- Mouth motion is heuristic, not phoneme-accurate lip sync.
- Output transcript deltas and audio deltas may arrive with different timing.
- Browser audio buffering can make the mouth lead or lag.
- The `teeth` speech shape can over-trigger grimace if the renderer makes that
  pose too strong.
- Eye gaze is not yet coupled tightly to speech. Gaze mostly follows face mode,
  idle behavior, manual gaze commands, or direct tool state.

These are acceptable only because they are inspectable. The rule is not "make
it magical." The rule is "make the mechanism visible enough to tune."

## Implementation Map

- `web/sts/index.html`: stores input prosody, formats compact transcript tags,
  queues output audio, and sends speech-mouth cues.
- `src/robot_790d/sts_page_server.py`: gives Brain2 the weak-prosody rule and
  passes recent prosody into its mulling request.
- `src/robot_790d/face_sim_server.py`: stores mouth state, validates speech
  mouth shapes, and exposes `/mouth`.
- `web/face-sim/index.html`: blends speech mouth poses into the rendered mouth.
- `config/face/robot-790-face.json`: defines the expressive mouth vocabulary
  and pose fields shared across embodiments.
