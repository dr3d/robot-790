# Eric / Robot 790 — Full Project Assessment

Date: September 7, 2026  
Prepared for: Scott  
Source: Codex assessment conversation, preserved in full

This report retains both complete assessment responses and all ten progress updates from the review. The full-corpus assessment appears first because it revises and qualifies the earlier engineering-focused assessment. The earlier response remains intact so none of its detailed findings, evidence, validation results, or recommendations are lost.

The review covered the working tree as it stood during the conversation, including existing uncommitted work. It was read-only; creating this report is a subsequent documentation action, not an implementation of the proposed fixes. File references and line numbers describe that reviewed state. Original citation targets are retained, including local notes, logs, and the adjacent archive; those references require this workspace and are not all public web links.

This file belongs in `curation/reviews/` because the project reserves `docs/` for its public shelf, while this assessment draws on internal notes and raw evidence.

- [Full-corpus assessment](#full-corpus-assessment)
- [Original engineering assessment](#original-engineering-assessment)
- [Review progress updates](#review-progress-updates)
- [Preservation check](#preservation-check)

## Full-corpus assessment

Original response timestamp: `2026-09-07T16:28:08.497Z` (UTC).

I’ve now completed the much broader read: **all 161 project Markdown files—about 160,000 words—plus four archived Markdown documents and 54 additional text notes and experiment inputs.** That includes all 39 postmortem files, the articles, curation material, labtable exchanges, prompts, hardware documentation, and publishing drafts. I also checked pivotal original conversations and event logs. Raw-log checking was selective; many exports contain overlapping snapshots of the same conversations.

**The fuller reading changes my assessment. Eric’s direction is more coherent than my first, engineering-heavy response conveyed. The project has demonstrated compelling moments of participation, curiosity, expression, and continuity. Its central challenge now is making those moments dependable enough to develop—while preserving the qualities that make them interesting.**

My first pass underweighted your intent and the experimental work already present. Two instructions in the material should govern any recommendations:

> “Automate the clutch, not the wheel.”

Your role includes taste, interpretation, live interaction, and deciding what matters. Reducing mechanical work should preserve that role. [Scott’s labtable note](D:/_PROJECTS/robot-790/notes/labtable/day_001/from_scott.md:10)

> “Do not over-clean Eric. The daemon should become more selective; Eric should not become more orderly.”

That is a precise distinction. The machinery can become more disciplined while Eric retains associative freedom, peculiar interests, theatricality, and productive wrong turns. [Controlled associative drift](D:/_PROJECTS/robot-790/notes/experiments/controlled_associative_drift.txt:85)

The trajectory I now see is this:

| Period | The question being explored | What the material establishes |
|---|---|---|
| Early character, world, and model experiments | What makes Eric recognizable across changes in context? | Voice, sentence construction, tools, recurring interests, and surroundings jointly shape him. A short successful conversation does not predict a good extended idle run. |
| NapEdge and the purpose experiments | Can returning to an idea deepen it? Can he keep an unfinished question alive? | Some returns produce real corrections and better connections. Others become familiar routines. The experiments already include prospective predictions and controlled contrasts. |
| September 3–4 | What does being a companion and participant actually involve? | Timing, face, interruptions, shared objects, and Brain2’s presence become substantive parts of the interaction. |
| September 5 | Can interests and intentions carry forward, meet evidence, and survive a gap? | The world-map exchange is a strong success. Research, mirror, and passivation runs expose the gap between explaining an intention and carrying it through. |
| September 6–7 | Can Eric participate in his own apparatus and creative work? | Conversation becomes part of the workshop; face inspection and draw/see/paint begin closing meaningful feedback loops. Get Go exposes how persistent the generic service reflex remains. |

That progression makes the face, notes, memory experiments, performance routines, and image tools much easier to understand. Much of what initially resembles feature proliferation is pursuing the same question through different materials.

The best work is quite specific.

**The world-map exchange is one of the strongest examples of what Eric should become.** A detail in a loaded profile becomes an interest; Eric raises it during a pause; you bring an image; the two of you investigate it together. He helps choose the next object of attention. That is a more revealing achievement for this project than completing another command.

The same conversation contains failed searches, awkward mirror operation, and an unsupported precise visual claim. Those failures matter, but they do not cancel the successful interaction. The right improvement preserves his contribution while making the factual parts more trustworthy. [Original conversation](D:/_PROJECTS/robot-790/logs/live/20260905-070413-conversation.txt:142)

**The experiments are more thoughtful than my first assessment credited.** NapEdge has advance predictions about attractors, factual traps, searches, and useful corrections. Alpha and Beta provide a meaningful contrast in guidance around substantially similar material. The purpose probe explicitly anticipates both generic helpfulness and excessive policing that flattens the voice. The missing piece is more consistent follow-through from prediction to outcome to the next comparable experiment. [NapEdge predictions](D:/_PROJECTS/robot-790/notes/experiments/nap_edge_probe/run_recipe_and_predictions.txt:91)

**The body work belongs near the center.** A neck changes conversational orientation. A face changes how a pause feels. Touch and tilt can give Eric something consequential to notice. The browser face is already an embodiment and an experimental workbench. The mirror and image feedback work also follows an older thread: the Mars material already proposes making an image, seeing it, and reacting to it. The recent implementation is giving an earlier creative intention an actual mechanism. [Mars discussion](D:/_PROJECTS/robot-790/notes/worlds/mars/mars_idea.txt:83)

**Brain2 has value beyond supervision.** The environmental arrangement—Scott hearing or seeing a second perspective and deciding what to bring into the conversation—is a legitimate part of the medium. It can produce counterpoint, friction, and useful observations. Accidental acoustic feedback attributed to Scott is a defect; deliberate, visibly attributed counterpoint is an experiment worth retaining. [Brain2 as environment](D:/_PROJECTS/robot-790/docs/logs/Brain2-As-Environment-2026-09-04-postmortem.md:133)

**The archive itself is a major asset.** You have preserved unsuccessful runs, predictions, corrections, uncomfortable interactions, staged-image disclosures, voice specimens, and creative journals. That allows an assessment much more serious than selecting impressive clips. The distinction between expressive journals and factual notes is especially worth preserving.

The deeper reading also exposes weaknesses that a code review alone would miss.

**1. A successful moment is sometimes being promoted into a lasting capability too quickly.**

NapEdge is the clearest case. The selected wax-tablet arc reaches a correction. In the archived full conversation, Eric later returns to the rejected hidden-groove idea, repeatedly.

That leaves a meaningful result: he can reconsider and improve an explanation. It does **not yet establish that the improvement reliably constrains later thinking**. A correction that survives a topic change, interruption, and passivation would be a stronger achievement. [Archived conversation, correction](D:/_PROJECTS/robot-790-archive/20260905-active-cruft-sweep/logs/live/20260830-021635-conversation.txt:398), [later return](D:/_PROJECTS/robot-790-archive/20260905-active-cruft-sweep/logs/live/20260830-021635-conversation.txt:775)

Get Go exposes a related gap. Eric reads the desired posture, says “Self-powered first,” then immediately asks “What’s next?” and promises to justify himself through usefulness. He can describe the change before expressing it consistently. That is a central frontier for this project. [Get Go conversation](D:/_PROJECTS/robot-790/logs/live/20260907-004134-conversation.txt:18)

**2. The interpretation process can feed its own conclusions back into the evidence.**

A run becomes a postmortem, then an article or critic’s letter, then a note Eric reads. Eric produces an eloquent reflection, which can feel like another confirmation of the original interpretation.

There is a concrete example: the memorable glass-of-water response follows Eric reading Claude’s letter supplying the corrected fan story and framing the question. It is a good creative response to that material. It is not independent recollection of the original incident. [Captured conversation](<D:/_PROJECTS/robot-790/notes/From Eric.txt:56>)

This feedback is also part of how you cultivate Eric, so eliminating it would be counterproductive. What needs improvement is the record: **what happened originally, what interpretation was supplied later, and what Eric had read before responding.**

Similarly, duplicated postmortems and overlapping log snapshots should remain one observation in an evidence ledger. The archive’s volume exceeds its number of independent trials.

**3. Eric’s explanations of his own operation are often better language than diagnostics.**

He can deny receiving Brain2 while the event log shows Brain2 activity. He can explain a failed action through an invented mechanism. A transcription error can become the foundation for an elaborate interpretation.

“Four diets, one mouth” is a useful design principle. Eric explaining it fluently does not establish that four independent, effective processes are operating. The documents themselves assign evolving meanings to the lanes.

The distinction should be maintained in the system: expressive self-description has room to breathe; answers about loaded notes, current images, Brain2 activity, saved files, or motor state need observable evidence. [Four-diets postmortem](D:/_PROJECTS/robot-790/curation/postmortems/20260905-215204-four-diets-note-reload-b2-advisory.md:151)

**4. Continuity needs ownership and attribution together.**

The first-person continuity envelope is a promising intervention. It gives future Eric a history to inhabit.

But there are journal passages that absorb Scott’s biography into Eric’s first person. Creative writing can legitimately do that; factual memory needs to preserve the distinction between:

- Something Scott experienced.
- Something Eric and Scott discussed.
- Something Eric observed or measured.
- Something Eric imagined.
- Something Eric committed to doing.

Some factual build notes also disagree while using dates such as “current session.” Explicit dates and supersession markers would help much more than polishing all the prose. [Thinking journal](D:/_PROJECTS/robot-790/notes/journals/thinking.txt:143), [Build-note supersession](D:/_PROJECTS/robot-790/notes/robot_build.txt:88)

**5. Some proposed fixes would damage the interaction if generalized.**

The fan incident and the later frown/mirror collapse point in opposite directions: Eric can surrender a correct observation under social pressure, or defend an unsupported observation. Teaching him always to agree or always to stand firm would preserve one failure.

Likewise, the face-gallery postmortem says ten seconds was not inherently too fast; cue discipline was the problem. Later material calls the interval too fast. The invariant should be that the chosen cadence works correctly. The desired cadence remains an experimental choice.

And the Hermes conversation shows an unnecessary permission obstacle: Eric offers to save, asks for a filename, receives “just call it latest,” then demands another explicit instruction. The postmortem treats the refusal more favorably than the conversation warrants. This is exactly the mechanical friction your “clutch” principle should remove. [Original exchange](D:/_PROJECTS/robot-790/logs/live/20260906-114305-conversation.txt:74)

**The immediate engineering priorities still stand, but I would now frame them as protecting the experiment and the participant you are building.**

| Priority | Immediate attention | Why it matters here |
|---|---|---|
| **Now** | **Session boundaries, cancellation, and cadence.** Fence asynchronous work to its originating session; prevent stale completions after stop or reconnect; fix the scheduler’s default-delay handling. | Otherwise the machinery produces unwanted repetition, interruption, and apparent disobedience that can be mistaken for Eric’s behavior. |
| **Now** | **Reliable saving and restoration.** Address concurrent note writes, checkpoint size failures, disconnect after failed saving, and restore ordering/context limits. | Continuity is becoming a central promise. A good conversation should not depend on a fragile handoff. |
| **Now** | **Truthful action and observation results.** Propagate failures; associate images and results with the current action and session; distinguish requested state from observed state. | A companion needs dependable contact with his world. Fluent claims of completion undermine that contact. |
| **Before powered track operation** | **An independently effective motion timeout and verified stop behavior.** | The firmware’s HTTP handling precedes the timeout check; blocked handling can delay enforcement. This priority is conditional on operating the chassis. |
| **Before broader network access** | **Restrict or authenticate the control surface and address cross-origin writes.** | The launcher defaults to all interfaces, and the reviewed API exposes consequential operations without authentication. Actual reachability depends on the network and firewall. |
| **Before interpreting the next major comparison** | **Capture the exact runtime version, loaded notes, settings, and canonical run artifacts.** | Old pages, changing schemas, accelerated clocks, and evolving notes can otherwise obscure what a run actually tested. |

The scheduler issue is concrete: omitted delays become zero through `Number(null)`, causing subsequent scheduling to use the minimum interval instead of the configured cadence. [Scheduler](D:/_PROJECTS/robot-790/web/sts/index.html:13768) The session-completion and note-writing paths also contain the previously identified failure modes. [Tool completion](D:/_PROJECTS/robot-790/web/sts/index.html:17255), [Note writes](D:/_PROJECTS/robot-790/src/robot_790d/note_files.py:101), [Chassis loop](D:/_PROJECTS/robot-790/firmware/esp32-chassis/src/main.cpp:1001)

These obligations belong primarily in ordinary runtime logic. Brain2 can advise about an interaction; stopping, rejecting a stale result, or confirming a successful save should not depend on a second model interpreting the situation correctly.

For the next focused development period, I would prioritize three repeated experiments alongside those repairs:

1. **Carry one correction through time.** Start with a concrete mistaken explanation, establish the correction, change subjects, interrupt, passivate, and return later. Compare a compact owned memory against the current restoration method. Preserve the complete record while varying what enters active context. Look for whether the correction changes subsequent reasoning.

2. **Recreate the conditions for shared attention.** Use a real object, image, or activity with enough substance to invite interest. Observe whether Eric contributes a particular curiosity, responds to your contribution, and leaves comfortable space. Compare the ordinary boot with a compact Get Go intervention. Count richer contributions and fewer operator rescues, rather than more speech. Include an actual unfamiliar participant eventually; the Tom run is explicitly Scott role-playing a guest.

3. **Complete one creative or bodily feedback loop.** Let Eric choose an image idea, generate it, inspect the actual result, notice something unexpected, and choose a meaningful variation. Or use one real touch/tilt event with an observable response and accurate later recollection. This would connect initiative, embodiment, evidence, and continuity in one assessable experience.

I would give those experiments priority over a broad four-brain expansion. The material repeatedly shows that another architectural concept can become another subject Eric talks about. A small working contingency gives him something that can actually change what happens next.

**My strongest positive assessment is that Eric already sometimes contributes to the encounter in the way you are seeking.** The world-map curiosity, productive revisitations, expressive experiments, and workshop conversations support that. The next milestone is making those contributions recur and survive interruption with less mechanical rescue—while preserving your ability to shape, enjoy, and critically examine them.

The review remained read-only. The earlier 134 passing Python tests are useful evidence about the backend; they do not establish the reliability of the browser lifecycle, physical stop timing, or lived interaction described above.

## Original engineering assessment

This is the earlier response, preserved verbatim. Read it alongside the fuller assessment above, which refines the project interpretation and qualifies several recommendations.

Original response timestamp: `2026-09-07T16:17:52.444Z` (UTC).

**Eric is a strong experimental companion system whose reliability layer is lagging behind its behavioral sophistication.** The expressive face, voice, continuity, compound tools, and surrounding feedback loop have produced real, inspectable successes. The next major improvement should be making that arrangement dependable across interruptions, long sessions, failed actions, and restarts.

I reviewed the current working tree—including the uncommitted changes—across the runtime, browser code, Python services, firmware, memory system, tests, architecture documents, recent postmortems, and selected underlying logs. I also used independent reviews and isolated reproductions to check suspected defects. No application source was changed or hardware operated.

Several findings deserve immediate attention.

1. **Fix the recurring-task timers first. There is a concrete cause of excessive activity.**

   Both schedulers default their delay argument to `null`, then convert it with `Number(delayMs)`. JavaScript converts `null` to zero, so subsequent scheduling ignores the configured cadence.

   Using the actual source functions with a configured **30-second interval**, the reproduced delays were **500 milliseconds for GPU watch** and **one second for standing routines**. The initial tick uses an explicit delay, which helps conceal the defect until the routine reschedules.

   This can produce rapid retries, log churn, and spoken routines restarting much sooner than requested. It directly affects judgments about whether Eric is too talkative or unable to settle. Fix the default-delay handling and test first, subsequent, blocked, and failed ticks. See the [GPU scheduler](D:/_PROJECTS/robot-790/web/sts/index.html:13768) and [standing-routine scheduler](D:/_PROJECTS/robot-790/web/sts/index.html:14001).

2. **Make disconnect, halt, and reconnect invalidate outstanding work.**

   An outstanding tool call uses the mutable global WebSocket when it eventually completes. In an isolated reproduction, a tool started in conversation A finished after reconnect, and **conversation B received A’s tool result and old call ID**.

   A separate reproduction resolved a pending Brain2 request after halt/disconnect. Its old mouth output still surfaced. Idle processing also has asynchronous work followed by response creation without a fresh session check.

   These are session-ownership defects. Every operation needs an originating session ID, cancellation handling, and a check immediately before producing a side effect. Outstanding work must not become part of a replacement session. See [tool completion](D:/_PROJECTS/robot-790/web/sts/index.html:17255) and [Brain2 completion](D:/_PROJECTS/robot-790/web/sts/index.html:10214).

   Reset boundaries need the same treatment: clearing the visible conversation currently leaves old user text, questions, and other scratch state available to later runtime decisions. A single replaceable session-state object would be safer than a growing list of manually cleared variables. See [conversation reset](D:/_PROJECTS/robot-790/web/sts/index.html:11693).

3. **Strengthen continuity before trusting longer unattended runs.**

   Three different problems undermine the memory design:

   - **Concurrent appends can lose updates.** Two writes to the same note were forced to overlap; both reported success, but only the second update survived. The atomic replacement helps avoid partial files, but the read–modify–write operation is not synchronized. Threads also share the same temporary filename. See [note writing](D:/_PROJECTS/robot-790/src/robot_790d/note_files.py:101).
   - **A failed checkpoint does not prevent normal Disconnect from continuing.** Notes have a 200,000-character limit. An over-limit checkpoint was rejected, but the actual disconnect handler still closed the session. Separate exit logs may permit recovery; the promised resume checkpoint remains stale. Timeouts also leave their underlying operations running. See [disconnect checkpoint handling](D:/_PROJECTS/robot-790/web/sts/index.html:19026).
   - **A long restored transcript can crowd out core memories.** Normal startup prepends passivation ahead of core memory, then spends one shared 64,000-character note budget in that order. A reproduction with a 66,000-character passivation omitted the core memory entirely—even though it was enabled. See [note-budget allocation](D:/_PROJECTS/robot-790/web/sts/index.html:5579).

   I would reserve space explicitly for core memory, serialize note updates with revision checks, and make checkpoints versioned and recoverable. Long transcripts need chunking or archival before reaching the write limit. A graceful stop should clearly distinguish “saved successfully” from “stopped with continuity still needing recovery.”

4. **Make tool receipts tell the truth about failure.**

   This matters particularly because Eric is instructed to trust receipts.

   Several Python wrappers return top-level `status: "ok"` even when the underlying device client reports an error. A reproduced emergency-stop result effectively said **“OK: connection timed out.”** The error is present inside the response, but the wrapper’s success flag contradicts it. See [chassis result wrapping](D:/_PROJECTS/robot-790/src/robot_790d/realtime_tools.py:863).

   The staged Reachy adapter has a related issue: a failed movement POST can be followed by successful status reads that clear the error, leaving an `ok:true` response and the requested pose represented as current state. Keep its existing motion gate until that is corrected. See [Reachy action reporting](D:/_PROJECTS/robot-790/src/robot_790d/reachy_embodiment_server.py:136).

   Use a consistent distinction between **requested, accepted, completed, and observed**. For visual actions, include the capture ID and time. When the operator challenges a claim, the recovery path should obtain fresh evidence.

   The pose-gallery postmortem shows why: ten captures worked, then Eric repeatedly claimed later poses existed although the final actual image was still “Frown test.” That is a particularly useful failure to turn into a regression scenario. See the [pose-gallery evidence](D:/_PROJECTS/robot-790/docs/logs/Pose-Gallery-And-Stale-Receipt-Collapse-2026-09-07-postmortem.md:69).

5. **Before powered chassis use, fix the watchdog’s dependence on network processing.**

   This becomes the first priority whenever the tracks will be powered.

   The motor loop processes synchronous HTTP before checking command expiry. The installed Arduino HTTP parser can wait seconds for incoming request data. During that wait, the nominal **400-millisecond command watchdog is not being evaluated**, and existing PWM output can remain active.

   Ordinary stop/watchdog expiry also ramps down through the normal slew behavior, adding up to approximately another half-second from full output. The emergency-stop handler does immediately zero outputs once executed, which is good, but receiving that HTTP command depends on the same processing path. See the [chassis control loop](D:/_PROJECTS/robot-790/firmware/esp32-chassis/src/main.cpp:1001).

   Establish an independently enforced motor-off deadline, then verify it with interrupted commands and deliberately stalled network input. Also reconcile the build-reference document: it describes a separate pinned motor loop that this implementation does not contain.

6. **Put an access boundary around the control APIs.**

   The normal page launcher binds to `0.0.0.0`, while the page API has no authentication. A client that can reach it can access private notes, enqueue operator input, invoke restart/stop operations, and use configured smart-home or paid image-generation capabilities.

   An isolated dispatcher check also accepted a note-write request carrying a foreign `Origin` and `text/plain` content type. This does not establish Internet exposure or a working attack through every browser; actual reachability depends on the machine and network. It does establish that the application itself has no admission check.

   Default to loopback, and make intentional LAN access use authentication and explicit origin checks. See the [launcher default](D:/_PROJECTS/robot-790/scripts/start_sts_page.ps1:2) and [API dispatcher](D:/_PROJECTS/robot-790/src/robot_790d/sts_page_server.py:124).

There is also a lot here worth preserving.

- **The compound tools are a real achievement.** “Make a picture book of your mouth shapes” became repeated pose–label–capture operations. Generated images successfully moved into the sensing eye. These let Eric work at the level of the user’s intention, and their results can be inspected.
- **The separation of creature, runtime, and embodiment is the right architectural direction.** Eric can retain continuity while moving between the S3 face, browser face, and future bodies. Continue that separation incrementally. The [architecture document](D:/_PROJECTS/robot-790/docs/creature-runtime-architecture.md:1) is appropriately candid about its current stage.
- **The memory vocabulary is useful.** Core memory, pinned notes, hot conversation, passivation, stale observations, and current receipts have distinct purposes. Keeping raw history intact while separately constructing prompt context is a sound design.
- **The recordkeeping culture is a major asset.** You preserve failures, operator corrections, tool results, and awkward sessions. That makes meaningful diagnosis possible. The pose collapse and overnight repetition are valuable evidence precisely because they were recorded honestly.
- **Several hardware precautions are already sensible.** Startup forces motor outputs low; emergency stop latches; firmware bounds movement; Python rejects overlapping timed drives; Reachy starts motion-gated. Build stamps and modest sensor reporting are also good practices.

The recent hard-idle-brake work deserves credit. The current tree now has a path where three recent loop warnings arm a one-hour automatic-idle brake. The historical overnight failure therefore should **not** be described as an untouched, purely advisory design. What remains is demonstrating that the new brake behaves correctly alongside pending work, recurring routines, queued audio, and the operator’s return. See the [current brake implementation](D:/_PROJECTS/robot-790/web/sts/index.html:9141).

After the immediate fixes, I would concentrate on a few specific consolidation tasks.

| Area | Finding and next step |
|---|---|
| Browser runtime | About **17,400 lines of inline JavaScript** combine presentation, session ownership, tools, audio, memory, recording, and scheduling. Extract session lifecycle and scheduling first, with focused regression tests. |
| Empty Connect | It records positions in rolling history arrays. Once the 24-entry Brain2 buffer is full, fresh entries can remain invisible to the “current session” slice. Use session IDs or monotonic sequence numbers. [Context selection](D:/_PROJECTS/robot-790/web/sts/index.html:11002) |
| Transcript extraction | A Markdown heading inside conversation text can terminate extraction early and silently omit later turns. Preserve structured boundaries alongside the readable transcript. [Parser](D:/_PROJECTS/robot-790/src/robot_790d/passivation.py:173) |
| Face consistency | Some advertised moods are rejected by the active S3 firmware; mappings differ; the browser simulator ignores some pose durations that firmware honors. Extend contract tests to behavior, duration, release, and combined commands. [Contract status](D:/_PROJECTS/robot-790/docs/face_contract.md:46) |
| Run evidence | Starting recording clears prompt/setup ledgers. Long-run ledgers also retain bounded windows despite “all emissions” wording. Persist evidence independently of recorder lifecycle. [Recording initialization](D:/_PROJECTS/robot-790/web/sts/index.html:17707) |
| Startup reliability | Native `lms` failures are not checked through `$LASTEXITCODE`; `try/catch` alone does not catch those exits in the tested shell. Verify successful model loading and readiness before reporting startup success. [Gold launcher](D:/_PROJECTS/robot-790/scripts/start_realtime_gold.ps1:20) |

The largest architectural pressure is that the browser now owns much of the runtime’s state and supervision. That is workable for a lab, but it makes tab lifetime, recording lifetime, conversation lifetime, and persistent memory easy to entangle. The reproduced defects cluster exactly at those boundaries. A staged extraction of those responsibilities would have much more value than a broad cosmetic rewrite.

For the experimental side, I would make the next milestone **Eric requiring less management while retaining his personality**. Four focused experiments would provide useful evidence:

- **Quiet companionship:** matched real-time sessions with the operator present, away, and returning. Measure unwanted speech, repetition, useful unsolicited remarks, interruption burden, and recovery.
- **Receipt repair:** deliberately fail a capture, then ask what Eric sees. Separately challenge a correct observation. Measure fresh reinspection and unsupported claims.
- **Continuity quality:** compare a compact handoff, a summary, and a full transcript using the same core facts and unfinished task. Measure useful callbacks, stale carryover, and responsiveness.
- **Brain2’s practical value:** compare off, monitor-only, and narrowly enforceable guard modes. Measure prevented mistakes and operator effort, alongside latency and resource use.

Keep experiment conditions explicit. “Empty Connect” currently retains enabled core memory; accelerated lab mode changes cooldown behavior; Brain2 monitor audio may affect the operator without appearing in the recording. Also record the actual client revision, tool-schema fingerprint, model configuration, and loaded-note hashes. A previous experiment demonstrably ran an old tool list because the page had not reloaded. See that [postmortem](D:/_PROJECTS/robot-790/curation/postmortems/20260905-065808-profile-search-friction.md:29).

Verification gives a mixed but useful picture: **all 134 existing Python tests pass**, including generated face-contract checks. Ruff reports four minor violations. The configured type check stops on a dependency/Python-target mismatch; using a Python 3.12 target exposes 62 source type errors across nine files. The more consequential gap is that the passing suite does not exercise the browser lifecycle failures reproduced during this review.

Firmware compilation remains unverified because PlatformIO attempted writes to its protected global cache. No live browser connection was available, and I did not conduct hardware or end-to-end audio testing. The conclusions above are grounded in source, records, and isolated reproductions.

My next development milestone would be concrete: **Eric honors his cadence, stops cleanly, preserves his thread, reloads his core context, and reports failed actions honestly—across repeated fresh sessions.** Those improvements directly support the companion you are building.

## Review progress updates

All ten assessment progress updates follow in their original chronological order. They retain intermediate findings, assumptions, and qualifications; the full-corpus assessment above contains the final synthesis.

### Update 1 ? 2026-09-07T16:10:21.151Z (UTC)

I’ll review the architecture, robot control and safety paths, hardware assumptions, and test coverage, then rank the findings by urgency. I’ll keep this read-only and take the time to trace issues back to concrete code.


### Update 2 ? 2026-09-07T16:11:09.359Z (UTC)

This is a substantial system: the STS page alone is about 19,000 lines, alongside several hardware embodiments, voice services, memory tools, and extensive experiment records. I’m reviewing those areas in parallel and including the current uncommitted work, which contains significant recent changes to the browser loop and session memory.


### Update 3 ? 2026-09-07T16:11:48.501Z (UTC)

All 134 existing tests pass. The first attempts hit test-folder permission issues; rerunning with a fresh temporary directory resolved those.

The main concern emerging is the gap between Eric’s “act, then trust the receipt” design and what the runtime enforces. I’m tracing cases where failed actions can look successful, or delayed work can outlive the session that requested it. Those could affect both continuity and the interpretation of experiment logs.


### Update 4 ? 2026-09-07T16:12:54.579Z (UTC)

The review has now reproduced two session-boundary bugs without contacting the robot: an old tool result can be sent into a newly connected conversation, and a delayed Brain2 result can surface after Eric has been halted. The hardware review also found a separate watchdog concern that should be resolved before powered chassis use.

I’m checking memory durability next. I’ll also use the browser skill to inspect the control surface, without connecting Eric or operating devices.


### Update 5 ? 2026-09-07T16:14:24.965Z (UTC)

One concrete cause of overactivity has surfaced: both recurring-task schedulers convert their default `null` delay to zero. A configured 30-second cadence therefore falls back to a one-second recurring-task timer, or a half-second GPU-watch timer.

I also reproduced a memory-write race: two concurrent appends both report success, but one update disappears. These are runtime issues worth fixing ahead of further prompt tuning.


### Update 6 ? 2026-09-07T16:16:13.942Z (UTC)

The review is converging on a clear direction: Eric’s expressive behavior, compound tools, and evidence trail are strengths. Timing, session ownership, action reporting, and memory durability need firmer runtime guarantees.

The latest changes do add a hard idle brake, so I won’t describe that historical failure as untouched. I also confirmed that a long restored transcript can crowd core memories out of the prompt. I’m separating current defects from past failures with fixes awaiting validation, and ranking the hardware concerns according to whether motion is enabled.


### Update 7 ? 2026-09-07T16:17:58.972Z (UTC)

You’re right—the first pass leaned too heavily toward code defects and recent incidents. I’ll read the full Markdown corpus, with particular attention to the postmortems, and trace how the project’s aims, experiments, and design decisions developed. I’ll use the underlying logs to check that trajectory rather than treating each failure in isolation.


### Update 8 ? 2026-09-07T16:19:17.420Z (UTC)

The inventory contains 161 project Markdown files, about 160,000 words, including the private labtable notes and curation drafts.

An important distinction is already clearer: this project deliberately values rumination, performance, sparse memory, and human participation. “Make Eric quieter and more autonomous” would be too blunt a direction. I’m tracing how those choices emerged and where the experiments changed their meaning.


### Update 9 ? 2026-09-07T16:21:37.496Z (UTC)

The full Markdown read is complete across the four review tracks: articles, all 39 postmortem files, architecture notes, curation material, labtable exchanges, prompts, hardware docs, and publishing drafts. I’m now checking the experiment inputs and pivotal logs behind them.

One distinction matters throughout: NapEdge values returning to a thought and improving it, while later runs document returning without progress. Both involve repetition. A useful fix has to distinguish them, or it could remove behavior the project is trying to cultivate.


### Update 10 ? 2026-09-07T16:25:05.099Z (UTC)

The primary logs expose a distinction the postmortems sometimes blur: a good moment can be real without yet being a lasting capability. NapEdge contains genuine corrections followed by later regression; the world-map exchange shows Eric helping choose a shared interest despite broken tools; and Get Go shows him explaining a new posture before reliably behaving that way. I’m using those distinctions to separate what deserves protection, what remains an experiment, and what the engineering must make dependable.

## Preservation check

Both final assessment responses and all ten review progress updates were copied directly from the original conversation record. Their complete text was checked against the saved report after writing; all 12 messages are present verbatim. No assessment text was shortened or paraphrased.
