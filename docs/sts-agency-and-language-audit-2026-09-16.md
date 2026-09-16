# STS Agency and Language Audit

Date: September 16, 2026. Status: analysis and offline characterization only; no runtime or prompt changes.

## Verdict

The concern is substantiated. STS is not merely an execution and scheduling layer. Several active paths interpret natural-language intent with English phrase matching, choose subjects and searches, constrain the next reasoning step, and prescribe Eric's exact spoken response. Other parts already have the better separation: models interpret meaning while code validates identifiers, receipts, permissions, freshness and persistence.

This is not a reason to discard the system, nor evidence that all of Eric's good conversation is scripted. It is a reason to remove competing behavioral authorities. Eric's model generates his substantive dialogue, but the runtime sometimes narrows what he can do and say more than its operating responsibilities require.

**A non-English Eric is not currently a configuration-only change.** Spanish conversation might work while actions silently fail. Japanese adds significant Unicode, retrieval and speech-segmentation failures. Neither outcome requires a model misunderstanding: the controller can reject a correctly understood tool call.

The criterion for the redesign should be: **changing the language of a request must not change its permissions, action semantics or task lifecycle.** Tool identifiers and protocol field names can remain stable English identifiers.

## Scope and Evidence

Reviewed the active browser control path, prompt assembly, tool continuations, idle scheduling/search/topic logic, B2 input/output handling, memory/note persistence, session preparation, voice launch configuration and installed speech-pipeline code. Traced key helpers to their callers; disabled performance-mode branches are not counted as active ordinary behavior.

Executed the actual extracted browser functions in Node VM with stubbed effects, plus Python note-lookup and installed speech-text helpers. No model requests, paid image calls, microphone operation, robot movement or real note writes. Python note fixtures were confined to a temporary directory.

Local characterization probes and full results are retained under
`logs/runs/20260916-behavior-language-audit/` (private evidence, not part of a
public checkout). On the lab machine, run from repository root:

```powershell
node logs/runs/20260916-behavior-language-audit/probe.cjs
.venv/Scripts/python.exe logs/runs/20260916-behavior-language-audit/probe.py
```

These are characterization probes, not tests that should enshrine today's faulty behavior. They are not a statistical multilingual evaluation or a full end-to-end language test.

## Findings, Ordered by Priority

### 1. Natural-language shortcuts can directly actuate the body despite negation

`maybeHandleDirectFaceCommand` at [index.html:15214](../web/sts/index.html#L15214) matches English sleep/wake phrases and calls `setFaceMode` directly. The transcript-completed handler invokes it at line 21396, independently of Eric choosing a tool.

**Verified with mocked hardware:** "Do not close your eyes." returns handled=true and calls `{mode: "sleeping"}`. "Cierra los ojos." does not trigger the shortcut. Quotation and negation are not interpreted. On a physical embodiment this is more consequential than a cosmetic language mismatch; actual physical behavior depends on the selected adapter. No physical test was performed.

Recommendation: retire prose-to-actuation shortcuts. Let the model choose the semantic body tool, then apply real hardware limits. Retain explicit UI sleep/wake/stop buttons and hardware emergency controls. Removing this shortcut must not remove those controls.

### 2. Unicode filename lookup can resolve to the wrong note

`note_files._slug_text` and `find_existing_note_path`, [note_files.py:110](../src/robot_790d/note_files.py#L110), erase non-ASCII characters for approximate matching. Distinct Japanese basenames all become the same `.txt` lookup key. After an exact miss, the resolver returns the first matching key before the later ambiguity check.

**Verified in a temporary directory:** with notes named for moon and star, asking for a nonexistent sun note resolves to an existing unrelated note. Exact existing paths still work. This is an identity bug, not a task for stronger prompting.

Recommendation: exact stable identifiers first; Unicode-preserving normalized labels for lookup; explicit ambiguity on collisions. Never turn an empty/lossy normalized name into evidence of identity. Apply the same principle to image and session references.

### 3. Memory and note permissions are English keyword classifiers, not authorization

Active browser gates: [index.html:5484](../web/sts/index.html#L5484), `rememberMemoryFact`, `forgetMemoryFact`, `memoryWriteAllowed`, `noteFileWriteAllowed`, and [index.html:17569](../web/sts/index.html#L17569), `writeTextFile`.

- Remember/forget/write permissions depend on English verbs, sometimes across the last eight user turns.
- An assistant sentence such as offering to remember something can arm a 45-second save window. The assistant's offer is not itself the user's consent.
- Fact grounding uses overlap of a few ASCII words, not whether the statement follows from the source.
- The browser strips non-ASCII memory names; the Python memory store supports Unicode names. Different layers disagree.

**Verified:** equivalent Spanish/Japanese requests fail the gates. Conversely, "Do not write a note about this," "Do not forget my address," and "Do not remember that my address changed" pass their positive gates. "Scott likes coffee" passes lexical grounding against "Scott does not like coffee."

Except for the direct face shortcut above, a positive gate does not independently execute an action: a tool call is still needed. But it cannot be defended as a reliable consent or truth check.

Recommendation: replace vocabulary-based permission with explicit operator-controlled capabilities and action scope. Within an enabled, low-risk notes sandbox, let Eric interpret the request; retain path confinement, limits, provenance and reversibility. For destructive/high-consequence operations, use a concrete confirmation bound to an action/resource, not a model-generated `authorized:true` and not English keyword matching. Keep durable-memory taste/selection in model guidance, separate from access control.

### 4. Tool follow-ups have become a second, restricted action planner

The main tool handler, [index.html:20047](../web/sts/index.html#L20047), creates workflow-specific continuation scopes. [image-task.js:4](../web/sts/image-task.js#L4) restricts the sequence and step count: search can lead to search/generation, generation can lead only to move-to-eye, failure ends eligibility. A normal search enters this research/artifact mechanism when enabled; it is not confined to requests already classified as images. Current runtime config enables it with three steps and a two-minute window.

Recall and session-map continuations also restrict actions. `maybeCreateToolFollowup`, [index.html:20304](../web/sts/index.html#L20304), chooses private prompts, modalities and tool permissions. Ordinary follow-up speech is logically tool-disabled. In the backend the catalogue may remain on the wire for prefix caching while returned tool calls are still blocked; visible schemas do not imply permission to act.

Some controls are legitimate: exact artifact association, duplicate-call suppression, no blind retry of an unknown paid request, and invalidating stale physical/UI operations. Others are behavioral choices: which next action is conceivable, whether Eric may consult a note, whether he can retry a known recoverable failure, and exactly how he must explain himself.

The latest run demonstrates the coupling: the image existed, the controller dropped the pending continuation after a 30-second playback wait, recall-only recovery rejected regeneration, and leftover text became another spoken promise. Local PM: `logs/runs/20260916-190331-image-handoff/postmortem.md` (not published).

Another concern: any newer user activity makes an image continuation stale. Preventing old UI actions is sensible; treating every new utterance as abandonment of the underlying request is not a semantic decision a timestamp can make. Preserve results and let Eric reconsider them in the new turn.

Recommendation: one general tool-result continuation on Eric's actual conversation, with the enabled capability set and typed outcomes. Enforce execution invariants, not a scripted search/draw/show ladder. A budget stop should produce a factual limit/result, not erase work or dictate a reply. Keep the successful cache-prefix discipline while replacing the special cases.

### 5. STS authors many of Eric's spoken confirmations

The follow-up block begins at [index.html:19725](../web/sts/index.html#L19725). `exactSpeechInstruction` at line 19775 instructs the LLM to say a supplied sentence verbatim. The tool handler assigns those sentences for memory, notes, images, embodiment, controls, media and error cases. Other helpers require one compact sentence with a prescribed selection of facts.

**Verified:** a successful image move yields `Say exactly this and nothing else: "I moved the generated image into my sensing eye."` regardless of conversational language. This is literal scripting of a limited but frequent portion of Eric's voice.

Receipt-grounding is valuable. Manufacturing Eric's dialogue is not necessary to achieve it. Return the fact, keep a general rule against false execution claims, and let Eric choose wording or silence. Put guaranteed factual status in the UI when a guaranteed display is needed; do not disguise UI status text as his reasoning.

Simply translating all these canned sentences would address localization while retaining the unwanted control architecture.

### 6. Idle is substantially controller-directed even with full history

`chooseIdleLane`, [index.html:11179](../web/sts/index.html#L11179), selects categories and priorities such as goal, self-task, discovery, bridge, revision, question and lookup. Its fallback rotates eligible lanes. `triggerIdlePonder`, [index.html:13239](../web/sts/index.html#L13239), turns that choice into detailed instructions about subject, phrasing, length, addressing the user and tool access.

In the ordinary path `idleCanCallTools=false`. B1 cannot itself call tools in that idle response. `maybeIdleCuriosityContext` may choose and execute a search first; B2 can separately propose idle art or a body beat. The backend shares B1's full history now, but that improves available memory, not freedom of action.

Controller topic/search logic includes:

- Literal lists of personal topics and expansion topics, with English matchers and queries (`idleTopicCandidates`, line 11250; `idleExpansionTopicCandidates`, line 11271).
- Hand-written interpretations such as lighthouse phrases becoming a Fresnel-lens query, or other story cues becoming a specific scientific subject (`focusedLoadedNoteSearchQuery`, near line 11354).
- Keyword judgments of source usefulness and off-topic results (`searchReceiptDigest`, near line 12621).
- ASCII/English cleaning of an inferred question before issuing the search.

These are not merely timers. They perform parts of attention, interpretation and research selection in code. They could contribute to recurring motifs, but this audit cannot attribute any particular joke or story to one matcher without its run trace.

Recommendation: preserve scheduled opportunities to think and the user's pacing preferences. Supply elapsed time, current receipts and optional external observations; let B1 decide whether to continue a task, converse, research, create, or abstain. Let B2 offer genuinely optional ideas, not replace one deterministic director with another mandatory director. An explicit non-speech/abstain result is preferable to inventing prose so every timer produces sound.

Tool-capable idle would need the same general execution lifecycle, cancellation and effect permissions as foreground work. It is not safe or complete to merely flip the current boolean.

### 7. Phrase classifiers police rhetoric and can impose substantial silence

[index.html:12741](../web/sts/index.html#L12741) through `noteIdleOutput` at line 12973 classify exhaustion, opening phrases, rhetorical moves and conceptual themes using English words. The results enter future prompts as styles/topics to avoid and accumulate exhaustion pressure. At ordinary lab speed that can cause an 8- or 15-minute cooldown; accelerated lab mode behaves differently.

Examples include detecting "the whole trick," "not X, just Y," "I keep thinking," and themes inferred from words such as memory, receipt, name or silence. A phrase can be a developing joke, an explicit quotation or a new factual topic. Its presence does not establish exhaustion.

**Verified:** "The experiment measures one repeat per second" matches the exhaustion detector. One match alone does not trigger the whole cooldown. Spanish/Japanese do not receive equivalent classifications; ASCII-normalized overlap checks also lose non-Latin content.

Recommendation: retire semantic style policing by regex. Keep exact transport deduplication by event/call ID. Treat broader repetition as a model judgment with attributable evidence and room for uncertainty. Any controller circuit breaker should target a technical runaway or explicit resource policy, not an inferred lack of originality.

### 8. B2 advice already has partial enforcement power

B2 itself uses an LLM and a structured evidence/steering schema, which is a better multilingual foundation. However, browser code turns repeated `steering.loop` assessments into a one-hour automatic-idle hard brake, with freshness and distinct-output checks. `steering.next=new_subject` also requests an outward headline. See [index.html:10872](../web/sts/index.html#L10872) and the accepting path at line 12339.

Thus "B2 advice is optional" is not universally true of the implementation. There is also an ASCII echo filter and an English "looks like revision" exception around B2 output at line 11791.

**Correction to the earlier PM recommendation:** `_brain2_evidence_context`, [sts_page_server.py:1647](../src/robot_790d/sts_page_server.py#L1647), already carries structured image-task receipts, including artifact, status and staged flag. The failed run cannot simply be explained as "B2 had no receipt machinery." More instruction text or another duplicate field is not automatically the cure. Audit the actual packet and interpretation; separate current artifact state from B2's beliefs.

Recommendation: keep B2's evidence binding and semantic contribution. Clearly separate advisory suggestions from controller-enforced commands. Do not turn a stylistic assessment into an hour of silence without an explicit, accepted policy. Give B1 the opportunity to agree, disagree or continue a developing bit.

### 9. Non-Latin text is damaged by normalization and sentence handling

**Verified in browser functions:** Japanese memory names, topic keys and dedupe keys become empty; the same Japanese transcript is classified as new rather than duplicate; even an exact Japanese fact fails the browser's grounding check. Accented Spanish is damaged (`informacion` with its original accent becomes `informaci n`). Japanese full stops do not split `noteSentences`, and a full-width question mark is not recognized by the idle question helper.

The fuzzy sensing-eye query path, [index.html:18706](../web/sts/index.html#L18706), also strips non-ASCII. A Japanese query fails against an identical Japanese image label; the same item remains selectable by exact ID. This is another reason to use identifiers for action and Unicode labels for people.

Installed speech dependency checks also showed that `remove_unspeechable` removes Japanese full stops and default `sent_tokenize` keeps two Japanese sentences as one. Sources: `.venv/Lib/site-packages/speech_to_speech/LLM/utils.py:20` and `base_openai_compatible_language_model.py:482`. This threatens early sentence streaming and prosodic punctuation, not necessarily all intelligible speech. These dependency observations are local-version-specific; no audio quality test was run.

Recommendation: Unicode-preserving normalization, language-aware segmentation and opaque IDs. Do not "fix" this by expanding English regex lists to many languages.

### 10. Voice and prompting independently steer back to English

- Active file-backed prompt: [robot-790-realtime-system.md:3](../prompts/robot-790-realtime-system.md#L3). English unless explicitly requested otherwise.
- Launcher default bootstrap prompt: [robot-790-reachy-no-tools.md:12](../prompts/robot-790-reachy-no-tools.md#L12) also contains English-only wording. The launcher defaults to this file; the browser later supplies its assembled session instructions.
- Browser TTS voice presets and `effectiveTtsInstruct`: [index.html:7653](../web/sts/index.html#L7653).
- Qwen TTS launch argument is explicitly `--qwen3_tts_language English`: [start_realtime_eric_qwen3.ps1:68](../scripts/start_realtime_eric_qwen3.ps1#L68). The installed TTS handler uses its configured `self.language` for generation, not simply the language code arriving with each text chunk.
- Optional B2 browser voice monitor filters selectable voices to English at line 11855.

The installed Parakeet handler declares its v3 European-language coverage and language detection; the input path is not simply an English-only recognizer. Spanish is within that declared scope; Japanese is not. Choosing a language outside the speech models' capabilities requires a suitable speech backend as well as controller changes. No model capability benchmark was performed.

Primary web search can carry Unicode queries, but controller-generated queries and relevance tokens have English assumptions; the Wikipedia fallback is explicitly `en.wikipedia.org`. These are locale biases, not proof that all non-English searches fail.

## What Breaks If Non-English Becomes a Requirement Today?

| Surface | Spanish / another supported European spoken language | Japanese / non-Latin text example |
| --- | --- | --- |
| Ordinary model dialogue | May work after language configuration; current prompts/TTS conflict | Text may work; spoken input requires a suitable STT backend |
| Remember / forget / write-note permission | Correctly understood calls can be rejected | Same, plus empty names and failed lexical grounding |
| Exact tool identifiers, numeric controls, receipts | Can remain unchanged | Can remain unchanged |
| Direct sleep/wake shortcut | Misses translated phrases; English negation bug remains | Same |
| Image generation request | Model can call tool; English pre-call interruption protection does not arm equivalently | Same |
| Image query recall | Approximate matching loses accents / language equivalence | Query can become empty; exact-ID recall still works |
| Generated image -> eye | Existing handoff bug remains; not caused by English | Same |
| Tool confirmations | Canned English is injected | Canned English is injected |
| Idle self-tasks, question cues, topic selection | Many recognizers no longer trigger correctly | Many keys/queries vanish in addition |
| Repetition / rhetorical controls | Different judgments for equivalent text | Often no usable signatures at all |
| Note content and session graph | UTF-8 content and IDs generally usable | Content can persist; approximate filename lookup is unsafe |
| Speech chunking / punctuation | Requires locale testing | Concrete punctuation loss and segmentation failure reproduced |

Measured scope: **seven selected semantic helper families, seven English positive examples, fourteen translated counterparts. All fourteen translated counterparts behaved differently from English.** This does not mean "100% of STS breaks," and there is no honest repository-wide failure percentage from this audit. The important conclusion is that failures span action permission, memory, autonomous activity, retrieval and voice, not merely translated UI labels.

English negation/quotation counterexamples also fail, so the issue is deeper than localization.

## What Should Stay Deterministic?

Do not replace reliable execution mechanics with prompting:

- Tool schemas, capability enablement, exact IDs, path confinement and device allowlists.
- Motion bounds, emergency controls, resource limits and explicit permissions for side effects.
- Audio ordering, microphone priority, cancellation, call-ID deduplication and session lifecycle.
- Execution status: queued, running, completed, failed, unknown; exact artifact identity and operation receipts.
- Raw-history preservation, source hashes, session graph integrity and structural summary validation.
- Context assembly that preserves meaning and cache stability; factual timestamps and actual device state.

All scheduling influences experience. The defensible distinction is not "code never affects behavior." It is **code controls opportunities and execution; language models interpret meaning and choose conversational/action content within declared capabilities.** Pacing is a transparent user/product policy, not a hidden diagnosis that an English phrase means boredom or consent.

A regex validating a SHA-256 digest or recognizing a fixed protocol tag is not the same problem as a regex deciding what a person meant. Stable `## STS NOTE 1`, `## B2`, JSON keys and tool names can remain unchanged in a Japanese session. Do not translate machine protocols as though they were conversation.

The session sweep is an existing positive example: the model proposes removals, while `sweep_protected_ids` [session_preparation.py:142](../src/robot_790d/session_preparation.py#L142) protects speaker/turn relationships, receipts and verbatim preservation. Those `You:` / `Robot 790:` labels are currently internal file structure. Translating the displayed UI labels is a separate issue; the body of a turn can already be non-English.

The idle-art grant, serialization, durable job IDs and receipts in `idle_art.py` are also useful building blocks. The source of a creative proposal and whether it is selected should remain model work, distinct from that execution machinery.

## Better Prompting Versus a Different Approach

### Prompting can help with meaning, but cannot repair a lost continuation

A concise, coherent operating contract should explain how to use tools, distinguish imagined narrative from actual execution, handle receipts and speak the selected language. Tool schemas should explain operations once. Setup cards should express taste/activity, not repeatedly compensate for controller restrictions.

Candidate for an experiment, not an applied prompt:

> You choose what to say and do. Use the available tools when they advance the current conversation or your interests within the enabled permissions. Tool results describe what actually happened, not what you must say next. Continue unfinished work when it is still relevant; reconsider it when new input changes the task. Imagination is welcome, but distinguish it from actual execution when that distinction matters. Use the session language. You may remain silent.

This is not a claim that a tiny prompt will outperform the current model setup. It needs comparison, and permission enforcement remains outside the prompt. Another paragraph cannot recover a callback that code discarded, permit a forbidden tool, disambiguate a lossy filename key, or make a configured English speech backend multilingual.

### Prefer one general continuation over special-case repairs

Proposed cycle:

1. Supply the real conversation, user input, optional B2 advice and factual runtime events.
2. Eric produces speech, a tool request or an explicit abstention.
3. STS validates that request against capabilities and operation state, executes it, and retains the correlated result.
4. Eric receives the result and chooses the next step. Speech playback may delay delivery of another spoken segment without destroying the reasoning/execution exchange.
5. New input changes the context. Completed artifacts survive; outdated actions are not blindly resumed. Eric decides whether the work is still relevant.

This is a general mechanism, not a prescribed plan. An optional model-authored task handle can preserve unfinished work across turns; STS should not infer that task from English promises or force a fixed plan to completion.

Use better tool affordances where they remove real ambiguity. For example, a stable artifact ID can identify a generated picture without a global eye-catalogue search. An explicit `destination` option could allow Eric to request generation plus staging as one operation. That is not automatic staging of every image: Eric chooses it, and the receipt must separately report render and staging outcomes. This alternative should be evaluated before adding another "now use this tool" prompt.

### Avoid the replacement traps

- Do not replace English matchers with a multilingual phrase dictionary.
- Do not translate every utterance into English for the same matchers; that adds latency and preserves the mistaken authority boundary.
- Do not put an extra LLM classifier in front of every action by default. B1 already interprets the conversation; use B2 when it adds a genuinely distinct perspective.
- Do not move the entire rule pile into a giant prompt and call the architecture fixed. Consolidate conflicting guidance; test what can be removed.
- Do not grant side effects because an LLM says they are authorized. Use explicit capability policy and specific confirmations where needed.
- Do not remove physical limits, provenance checks or private/protocol output separation merely because they are deterministic.
- Do not change tool catalogues or early prompt sections every turn while simplifying control; the previously demonstrated cache gains are worth preserving and retesting.

## Proposed Work Order

1. **Correct independently demonstrable bugs:** direct face negation shortcut, lossy filename resolution, and playback timeout discarding work. These do not require redesigning Eric's personality.
2. **Pilot a general foreground tool continuation:** remove exact speech and the image-specific action ladder in that experiment; keep ordinary receipts, stable tool schemas, execution limits and cancellation. Exercise the existing generated artifact without paying for another picture.
3. **Remove natural-language authorization gates carefully:** replace with explicit scoped permissions, provenance and reversible storage. Test negation, quotation, historical requests and changes of mind before broad rollout.
4. **Run a subtractive idle experiment:** same identity, history and timing, but no forced topic rotation, canned search queries or rhetoric-based cooldown. Give model-selected actions the general execution path and permit abstention. Keep B2 as advice, not a second mandatory director.
5. **Make language a real session setting:** coordinate LLM guidance, supported STT/TTS, voice monitor and Unicode handling. Keep protocol identifiers stable. Test a European language and a non-Latin language separately.
6. **Consolidate prompts after mechanisms are sound:** remove obsolete repairs, preserve useful creature identity/cards, generate prompt snapshots and disclose changes. Do not quietly rewrite Eric's personality during bug fixes.

No new dependency or second permanently loaded model is inherently required by this direction. Whether an additional semantic pass improves a particular task remains an experimental question, not an architectural assumption.

## Evaluation Required Before Calling It Better

Compare current behavior, a reduced-controller variant, and reduced-controller plus a consolidated prompt. Hold model/settings/history/permissions constant; repeat samples rather than judging one attractive output. Keep the same input task translated, including negation and mid-task interruptions.

Measure actual task receipts and first-audio latency, not promises. Include long speech (>30 seconds), generation failure, a known existing image, ambiguous recall, a new user turn during a tool, a changed request, disconnect, and cold/warm idle return. Report cache-evaluated tokens as well as total context.

For agency, count controller-prescribed lines/actions, unnecessary permission re-asks, missed authorized actions, unwanted actions and useful model-chosen follow-through. Also assess conversational quality with the user: banter, developing callbacks and intentional repetition must not automatically score as failures.

For language, require equivalent permissions and action paths across languages, preservation of names/content/punctuation, correct exact-ID recall, ambiguity rather than wrong-file lookup, and no forced English confirmation. Test speech quality separately from text/control logic.

Existing unit tests cover many important mechanical regressions, but some explicitly assert the current constrained workflow and prompt wording. Passing those tests proves consistency with that implementation, not that the implementation respects the desired division of responsibilities. Replace obsolete expectations deliberately when changing the architecture; keep mechanical safety/integrity tests.

## Bottom Line for the Next Decision

There is enough evidence to stop adding task-specific behavioral patches as the default repair strategy. The strongest next experiment is not "prompt Eric harder" and not "delete all deterministic code." It is to keep a dependable executor and reduce the runtime's role as an interpreter, director and scriptwriter. Multilingual equivalence is a useful acceptance test for that boundary even if Eric continues speaking English day to day.
