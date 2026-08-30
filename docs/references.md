# Reference Shelf

Robot 790 is derivative in the honorable sense: it is built from public tools,
open research directions, hobby hardware, local models, and older ideas about
animation, social presence, embodied agents, and believable characters.

This page is a living bibliography for the work Robot 790 wants to be associated
with. It is not exhaustive. It is a starting shelf for credit, comparison, and
future reading.

## Artificial Humans And Social Presence

- [Computers in Human Behavior: Artificial Humans](https://www.sciencedirect.com/journal/computers-in-human-behavior-artificial-humans) is a current journal home for work on artificial agents, social robots, virtual assistants, conversational agents, and human behavior around them. This is the broadest label for the project neighborhood.
- [The Media Equation](https://web.stanford.edu/group/cslipublications/cslipublications/site/1575860538.shtml), by Byron Reeves and Clifford Nass, is a core skeptical reference for why people respond socially to computers and media even when they know they are machines.
- [Computers Are Social Actors](https://dl.acm.org/doi/10.1145/191666.191703), by Clifford Nass, Jonathan Steuer, and Ellen R. Tauber, is an early HCI statement of the same pressure: social cues in software are enough to trigger social responses.
- [An Experimental Study of Apparent Behavior](https://doi.org/10.1080/00223980.1944.9917450), by Fritz Heider and Marianne Simmel, is the older psychological floor: people attribute goals, motives, and story to simple moving shapes.
- [ELIZA](https://dl.acm.org/doi/10.1145/365153.365168), by Joseph Weizenbaum, is the founding chatbot ancestor and a warning about how readily language can invite over-attribution.
- [Computer Power and Human Reason](https://books.google.com/books/about/Computer_Power_and_Human_Reason.html?id=3yfyAAAACAAJ), by Joseph Weizenbaum, is the ethical counterweight to ELIZA's success: a critique of confusing computational performance with human judgment.
- [Alone Together](https://www.basicbooks.com/titles/sherry-turkle/alone-together/9780465093656/), by Sherry Turkle, is an important critique of relational artifacts and machines that perform care or companionship.
- [Replika](https://replika.com/) is the mass-market AI companion shadow of this work: a commercial relational-agent path that Robot 790 intentionally contrasts with by being local, singular, and publicly inspectable.

## Uncanny Valley And Synthetic Behavior

- [The Uncanny Valley](https://spectrum.ieee.org/the-uncanny-valley), Masahiro Mori's original essay in authorized English translation, is the standard warning about machines that approach human likeness without fully reaching it.
- [Vehicles](https://mitpress.mit.edu/9780262521123/vehicles/), by Valentino Braitenberg, is a compact ancestor for simple mechanisms that invite rich behavioral interpretation. His "uphill analysis and downhill invention" framing fits Robot 790's build-and-audit method.

## Believable Agents And Synthetic Characters

- [The Role of Emotion in Believable Agents](https://dl.acm.org/doi/10.1145/176789.176803), by Joseph Bates, is close to Robot 790's center of gravity: believable character is not just intelligence; timing, emotion, expression, and personality matter.
- [The Oz Project](https://www.cs.cmu.edu/afs/cs.cmu.edu/project/oz/web/oz.html) at Carnegie Mellon is an important ancestor for interactive believable agents and artistically shaped character behavior.
- [Old Tricks, New Dogs: Ethology and Interactive Creatures](https://www.media.mit.edu/publications/old-dogs-new-tricks/), from Bruce Blumberg and the MIT Media Lab synthetic characters lineage, is part of the tradition that treats animated agents as creatures with situated behavior, not only chat interfaces.

## Embodied Conversational Agents

- [Embodied Conversational Agents](https://direct.mit.edu/books/edited-volume/3227/Embodied-Conversational-Agents), edited by Justine Cassell, Joseph Sullivan, Scott Prevost, and Elizabeth Churchill, is a foundational book for agents with bodies, faces, gesture, voice, and conversational timing.
- [Embodied Conversational Agents](https://www.justinecassell.com/publications/AIMag22-04-007.PDF), by Justine Cassell, is a compact paper version of the argument that multimodal embodied behavior changes what a conversational system can be.
- [Relational Agents](https://www.media.mit.edu/gnl/projects/socialrea/) from the MIT Media Lab are relevant to long-running human-agent relationships, continuity, rapport, and the way repeated interaction changes the interface.

## Sociable Robots

- [Sociable Machines](https://dspace.mit.edu/entities/publication/d66425a5-e57e-4bc8-95db-3fff5149c899), Cynthia Breazeal's Kismet dissertation, is one of the clearest ancestors for a face-forward robot that learns its social shape through interaction.
- [Designing Sociable Robots](https://mitpress.mit.edu/9780262524315/designing-sociable-robots/), by Cynthia Breazeal, is the book-length version of that design program.
- [Kismet](https://www.ai.mit.edu/projects/sociable/kismet.html) is especially relevant because it was a small expressive robot head whose face, voice, attention, and caregiver loop mattered as much as abstract task competence.

## Generative Agents And Memory Loops

- [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442), by Park, O'Brien, Cai, Morris, Liang, and Bernstein, is the modern LLM-era reference for memory, reflection, planning, and believable behavior in agents.
- [Generative Agent Simulations of 1,000 People](https://arxiv.org/abs/2411.10109), by Park and colleagues, extends the same family of ideas toward simulated human behavior from interviews and memory structures.

## Voice, Face, And Local Robot Plumbing

- [Reachy Mini Conversation App](https://github.com/pollen-robotics/reachy_mini_conversation_app) from Pollen Robotics is a direct practical ancestor: realtime voice, vision, tools, expressive movement, and a local robot conversation app.
- [Reachy Mini goes fully local](https://huggingface.co/blog/local-reachy-mini-conversation) documents the local-first direction Robot 790 also follows: run the voice engine nearby, keep the robot interface alive, and route tools through a local controller.
- [NVIDIA Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) is relevant to the speech recognition side: fast local ASR is one of the pieces that makes the live loop possible.

## What Robot 790 Adds

Robot 790 is not a claim to have invented these fields. Its contribution is an
assembly and a practice:

- a local-first speech-to-speech loop with an embodied face
- deterministic face/body lifecycle cues around probabilistic language
- sparse continuity notes instead of total autobiographical memory
- idle rumination as a first-class behavior
- note, library, world, and experiment files as controllable context
- visible logs and curated public artifacts so the machinery can be inspected

The working question is not only "Can an AI answer?" It is:

> What happens when a small embodied conversational agent is given voice, face,
> tools, sparse continuity, private idle time, and a human who keeps testing what
> survives?
