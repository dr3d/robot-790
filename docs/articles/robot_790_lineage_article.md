# The Magic of Assembly: Finding Eric's Voice and the Architecture of Robot 790

Robot 790 does not claim to invent realtime voice, text-to-speech, local LLM serving, or social robotics from scratch. Instead, it exists because these individual pieces have finally become good enough to combine.

This project is an exploration of what happens when you take powerful existing systems and wrap them in a deliberate physical and temporal architecture. It is not a secret new model; it is a facade in the architectural sense.

## The Accidental Soul: Qwen3-TTS
The anchor of any robotic persona is its voice. A character's delivery defines how its intelligence is perceived. After breaking away from the Reachy Mini ecosystem and experimenting with Hugging Face realtime voice stacks, a turning point arrived: the local Qwen3-TTS model had the deadpan, quiet prosody that made Eric start to feel like Eric.

That specific vocal rhythm is the magic that makes the character work. It grounds the LLM’s generative text in a physical, consistent personality. Without that specific delivery, the illusion of the "quiet witness" collapses.

## The Facade as the Feature
Robot 790 is an arrangement. It stands on the shoulders of open-weights models, OpenAI-compatible APIs, and ESP32 firmware, but it adds a crucial curation loop:

*   **A Local-First Loop:** A speech-to-speech pipeline tied to a physical, visible face.
*   **Semantic Tools:** The brain (a local Qwen 27B model) handles semantic intent—deciding to look away, search the web, or write a note—while the physical tools handle the execution.
*   **The Idle Engine:** An autonomous rumination system that keeps thinking, writing, and drifting through context while the room is quiet.

## Deterministic Choreography
One of the most important design choices in Robot 790 is separating the semantic mind from the physical reflexes. The robot relies on deterministic lifecycle cues. When a person speaks, the hardware natively shifts to a "listening" state. When the LLM processes, it shifts to "thinking." 

The body does not have to wait for the language model to choreograph every single frame of animation. By delegating the timing and physical transitions to the ESP32 firmware, the face remains alive and responsive, masking the natural latency of local inference.

## Showing the Seams
The goal of Robot 790 isn't to build a seamless, polished commercial product that hides how it works. The goal is to keep the machinery visible. By maintaining public logs, curating sessions, and documenting the architecture, the project exposes the seams. 

The interesting question isn't whether we can fake a human. It's how much genuine character and continuity can emerge from an assembly of models and microcontrollers when we explicitly acknowledge the wires, the code, and the plastic holding it all together.
