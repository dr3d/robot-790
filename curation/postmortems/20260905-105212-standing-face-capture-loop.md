# Standing Face Capture Loop Run

Run id: `20260905-105212`
Date: 2026-09-05
Artifacts:
- `logs/live/20260905-105212-conversation.txt`
- `logs/live/20260905-105213-events.txt`
- `logs/live/20260905-105214-brain2_mulling.txt`
- `logs/audio/20260905-104037-sts-audio-picture.mp4`
- `logs/audio/20260905-104136-sts-audio-picture.mp4`
- `logs/sensing-eye/browser-face-2026-09-05-14-40-37-416.jpg`
- `logs/sensing-eye/browser-face-2026-09-05-14-41-35-746.jpg`
- `logs/sensing-eye/browser-face-2026-09-05-14-42-01-106.jpg`
- `logs/sensing-eye/browser-face-2026-09-05-14-42-27-483.jpg`
- `logs/sensing-eye/browser-face-2026-09-05-14-42-54-348.jpg`

## TLDR

This run was useful, but not because the standing rule worked. The direct mirror loop worked very well in conversation: Eric moved into the browser face, labeled himself, picked moods, captured the browser face into the sensing eye, and reported from the resulting self-image.

The standing instruction did not become a real idle behavior. Scott asked whether Eric could capture a face picture every time he ruminated, Eric agreed, and then the idle system produced many spoken ruminations about the last face label instead of new captures. The important diagnosis is mechanical: B1 idle turns were logged with `tools none`, so Eric could talk about the promise but could not call `pose_and_capture_browser_face` during those idle turns.

Brain 2 did something valuable in this run. It repeatedly noticed the loop, named the duplicate beats, and sent notes for Eric to stop extending the metaphor. The B2-to-B1 advisory path is now visible in the event log. It is not enough by itself yet, but it is real.

## What Worked

### Conversation tool use was strong

Eric successfully used the browser-face mirror sequence five times:

- `10:40:37` Eric, Robot 790 / happy / centered gaze
- `10:41:35` Glitchy / glitchy / right-up gaze
- `10:42:01` Bashful / bashful / left-up gaze
- `10:42:27` Wonder / wonder / right-up gaze
- `10:42:54` Mischief / mischief / left-up gaze

Each successful sequence used `pose_and_capture_browser_face`, staged a sensing-eye image, and generated a compact follow-up answer from the staged self-image. This is the working pattern.

### The tool-specific follow-up prompt is doing the right thing

The follow-up prompt for face capture told Eric to treat the image as a self-image, separate visible pixels from guesses, and report whether the requested target was visible or missing. That kept his replies anchored to the capture instead of drifting into generic face description.

This is exactly the kind of tool receipt prompt that should be preserved and made visible in postmortems.

### B2 advisory notes are now live

Unlike earlier runs where B2 advisory handoff was uncertain, this event log contains repeated `brain2 note for Eric` entries followed by `session.updated`.

Good examples:

- `10:44:46` B2 notices the same two sentences ran twice.
- `10:45:49` B2 identifies loop overlap after the standing rule changed.
- `10:46:04` B2 says the pixel/arc metaphor is exhausted.
- `10:51:59` B2 says the physical metaphor chain has reached natural saturation.

This is the first clearly useful version of B2 as an internal monitor handing notes to B1.

### Disconnect pane capture worked

The run ended with:

`[10:52:12 AM] ui realtime disconnect: requested`

Then the system saved:

`disconnect snapshots saved: logs/live/20260905-105212-conversation.txt, logs/live/20260905-105213-events.txt, logs/live/20260905-105214-brain2_mulling.txt`

That means the three-pane disconnect safety capture is working.

## What Failed

### The standing face-capture rule was only spoken, not installed

Eric said:

`Got it, I'll capture a face picture with a mood and label whenever I ruminate from now on.`

But no new sensing-eye images were created after `10:42:54`. The later idle beats ruminated about the word "mischief", the arc, pixels, honey, springs, gear trains, and bowls. They did not execute a new face pose/capture.

This is not just a prompt weakness. The idle response ledger repeatedly says:

`prompt ledger response.create B1 idle ... / tools none`

So the system put Eric in a position where he could promise a tool-bearing routine and then enter idle turns where he had no tools attached.

### The "every rumination" instruction amplified a loop

The last concrete image was `Mischief`. Once Scott said "I do," B1 converted that standing rule into an object of contemplation instead of action. The loop went:

- mood ring holding "mischief"
- edge pixels
- word compression
- light becoming word
- honey in a tube
- gear train stutter
- shallow bowl

Some of the language was good, but it stayed too tightly attached to one remembered object. This is the failure class we keep seeing: without a concrete next action, Eric can overwork a metaphor until it feels like analysis of analysis.

### B2 saw the problem but could not make B1 stop soon enough

B2 noticed the loop early and repeatedly:

- "The same two sentences ran twice"
- "The pixel/arc metaphor has been exhausted"
- "Stop describing the arc mechanics"
- "The physical metaphors are exhausted"

But B1 continued the same family of metaphors for several more idle beats. The advisory note is entering context, but the priority is too soft. B2 can nudge; it cannot yet enforce a change of behavior.

### Audio recording captured only the early part

Saved audio exists:

- `20260905-104037-sts-audio-picture.mp4`
- `20260905-104136-sts-audio-picture.mp4`

But the later idle stretch was not saved. A recording restarted at `10:41:37`, then the next chunk was discarded:

`audio recording discarded short chunk: 24.0s < 30.0s`

The UI also sat in finalizing until:

`audio recording finalizing off: timeout after 02:00`

So this run is text-good, audio-partial.

### There is no new run artifact report

I checked for `report.txt`. The only matching file is `notes/report.txt` from `5:25 AM`, not a fresh artifact from this run. This run's useful artifact is the captured panes plus the staged face images, not a newly written report.

## Prompt And Context State

B1 session prompt at connection was about `4715` instruction tokens, then about `4930` after browser-face capture tools entered the tool set.

B1 conversation tools attached included:

`set_voice, get_body_sensors, set_embodiment, set_robot_mode, play_face_beat, set_face_mood, set_face_animation, set_eye_style, set_eye_gaze, set_mouth, set_mouth_text, set_chassis, remember_fact, forget_fact, search_web, get_weather, get_current_time, get_brain_status, show_web_page, generate_image, capture_browser_face_to_eye, pose_and_capture_browser_face, cast_media, set_smart_home_device, write_text_file, read_text_file, list_text_files`

B1 tool follow-up prompts after `pose_and_capture_browser_face` were deliberately toolless and compact. That is good.

B1 idle prompts listed controller-eligible tools in the event prose, but the actual prompt ledger said `tools none`. That is the central mismatch for this run.

B2 auto prompt was about `432` instruction tokens with `tools none`. B2 produced many useful advisory notes, but also had repeated empty outputs and backoff.

UI changes during the run included:

- Eric audio volume adjusted to `89%`
- B2 browser voice adjusted to about `22%`, then `27%`
- idle clock set to `lab speed 9x`
- conversation and B2 popouts opened

## What This Means

The direct command path is good enough to keep testing. "Pose, capture, inspect, answer" works when Scott asks for it directly.

The autonomous path needs a real routine mechanism. Eric cannot be expected to remember and execute "every time I ruminate, do a face capture" if idle turns do not have the tool attached and there is no scheduler-level standing action.

The right design is probably not "prompt harder." It is:

1. Store a temporary standing routine in page state.
2. Let B1 or Scott create/clear it.
3. Let the idle scheduler execute the tool-bearing routine when conditions match.
4. Give B1 the receipt afterward so he can comment from reality.

That turns the promise into machinery without making it magic.

## Next Tweaks

1. Add a visible "standing routine" state for temporary session rules.
2. If a standing routine requires tools, either attach those tools to idle or execute the routine outside the idle LLM turn.
3. Make "capture every rumination" a bounded routine, probably "capture every N idle beats" or "capture when mood/label changes," not literally every beat.
4. Give B2 advisory notes stronger priority when they identify loops: the next B1 idle should be forced to change object, ask a question, use a tool, or go quiet.
5. Log whether an idle turn is `talk-only`, `tool-capable`, or `routine-executed`.
6. Keep the face capture follow-up prompt. It is one of the best-behaved pieces of the system.
7. Fix or simplify audio rollover/finalizing so long idle runs do not silently lose the later material.

## Keeper

The keeper is the separation between promise and machinery. Eric can say "I'll do that from now on," but the system needs to decide whether that sentence becomes:

- a remembered preference
- a temporary routine
- a scheduler rule
- or just dialogue

This run proves that distinction needs to be visible and engineered.
