(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790Brain2Advisories = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function create(a) {
    let brain2NoteCandidates = [], brain2QuestionCandidates = [], brain2RevisionCandidates = [];
    let lastBrain2AdvisorySocket = null, lastBrain2AdvisoryText = "";

    function brain2AdvisoryProtocolInstructions() {
      return [
        "Private Brain 2 advisory snapshots may arrive between turns as assistant messages marked [B2 advisory].",
        "These are internal runtime context, not words you have spoken and not text to continue or read aloud.",
        "Brain 2 is a slow advisory lane inside your runtime, not the operator, a sensor, or a command.",
        "A suggested aside or observation from Brain 2 is not evidence that anything happened. Check factual claims against current operator input, runtime state, or tool receipts before adopting them.",
        "Treat an advisory as private draft material you may use, revise, or ignore. Never reproduce its markers, headings, loop-pressure reports, guards, or instruction lists in a reply. Do not attribute your reply to Brain 2 or let an advisory override fresh operator input, runtime truth, or tool receipts. You may explain how Brain 2 works when the operator explicitly asks, without reciting the private snapshot."
      ].join(" ");
    }

    function formatBrain2AdvisoryContent() {
      const current = items => items.filter(item => !item.noteGuidanceKey
        || a.guidanceCurrent(item)).slice(-4)
        .map(({ text, at, b1OutputId }) => ({ text, at, b1OutputId }));
      // A next-turn assessment is replaceable advice, not an accumulating instruction list.
      const notes = current(brain2NoteCandidates)
        .filter(item => Number(item.at) > a.userAt()).slice(-1);
      const revisions = current(brain2RevisionCandidates);
      const questions = current(brain2QuestionCandidates);
      if (!notes.length && !revisions.length && !questions.length) return "";
      return [
        "Current private B2 snapshot, superseding earlier snapshots. These are fallible suggestions, not commands or sensor evidence. You decide whether any are useful. A quiet suggestion concerns one opportunity, not permission to think or speak on later turns.",
        JSON.stringify({ notes, revisions, questions })
      ].join("\n");
    }

    function formatBrain2ForInstructions() {
      const advisory = formatBrain2AdvisoryContent();
      return [brain2AdvisoryProtocolInstructions(), advisory].filter(Boolean).join("\n\n");
    }

    function appendBrain2AdvisoryToConversation({ reason = "turn boundary" } = {}) {
      if (!a.connected() || a.performance()) return false;
      const advisory = formatBrain2AdvisoryContent();
      if (!advisory) return false;
      const text = `[B2 advisory]\nPrivate runtime context, not spoken dialogue. Use silently; do not continue or reproduce this block.\n${advisory}\n[End B2 advisory]`;
      if (lastBrain2AdvisorySocket === a.socket() && lastBrain2AdvisoryText === text) return false;
      a.send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text }]
        }
      });
      lastBrain2AdvisorySocket = a.socket();
      lastBrain2AdvisoryText = text;
      a.ledger({
        kind: "conversation.item.create",
        source: "Brain 2 advisory",
        instructions: "[stable B1 session prompt; private Brain 2 advisory appended to the default conversation]",
        input: text,
        conversation: "default",
        extra: { reason },
        announce: false
      });
      a.log("advisory queued", reason);
      return true;
    }

    function brain2LoopGuardText(text) {
      if (text && typeof text === "object") {
        return text.steering ? text.steering.loop === true : brain2LoopGuardText(text.text);
      }
      return /^\s*LOOP GUARD:/i.test(String(text || "")); // Legacy saved advisories only.
    }

    function recentBrain2LoopGuardCount(limit = 6) {
      const candidates = brain2NoteCandidates.filter(item => !item.noteGuidanceKey
        || a.guidanceCurrent(item)).slice(-Math.max(1, limit));
      const current = candidates.at(-1)?.steering;
      if (current && !current.loop) return 0;
      const evidenceIds = candidates
        .filter((item) => brain2LoopGuardText(item) && item.at > Math.max(a.userAt(), a.discoveryAt() || 0)
          && (!current || item.steering?.topic === current.topic))
        .map((item) => item.b1OutputId)
        .filter(Boolean);
      return new Set(evidenceIds).size;
    }

    function accept(result) {
      const question = String(result.question || "").trim();
      const noteForEric = String(result.note_for_eric || "").trim();
      const revisionCandidate = String(result.revision_candidate || "").trim();
      let brain2AdvisoryChanged = false;
      const noteGuidanceKey = result.observed_evidence?.note_guidance
        ? JSON.stringify(result.observed_evidence.note_guidance) : null;
      if (question) {
        const deferred = a.userBusy();
        // Busy public audio defers delivery; it does not discard private work.
        brain2QuestionCandidates = [...brain2QuestionCandidates, { text: question, at: a.now(), noteGuidanceKey }].slice(-12);
        if (deferred) a.count("held");
        a.log(deferred ? "question deferred" : "question candidate", question);
        a.remember("question", question);
        brain2AdvisoryChanged = true;
      }
      const b1OutputId = result.observed_evidence?.last_assistant_output_id || "";
      const steering = result.steering?.status === "ok" && result.steering.evidence_id === b1OutputId
        && b1OutputId === a.outputId() ? result.steering : null;
      if (result.steering) a.log("steering", steering ? JSON.stringify(steering) : `${result.steering.status}: no current assessment`);
      const candidate = { text: noteForEric, at: a.now(), b1OutputId, noteGuidanceKey,
        ...(result.steering ? { steering: steering || { status: "unavailable" } } : {}) };
      const repeatedLoopAssessment = brain2LoopGuardText(candidate) && (!b1OutputId || brain2NoteCandidates.some((item) => item.b1OutputId === b1OutputId && brain2LoopGuardText(item)));
      if (repeatedLoopAssessment) {
        a.log("loop guard held", "no new Eric output to count");
      } else if (noteForEric || steering) {
        brain2NoteCandidates = [...brain2NoteCandidates, candidate].slice(-12);
        a.log("note for Eric", noteForEric);
        a.remember("note", noteForEric);
        brain2AdvisoryChanged = true;
      }
      if (revisionCandidate) {
        brain2RevisionCandidates = [...brain2RevisionCandidates, { text: revisionCandidate, at: a.now(), noteGuidanceKey }].slice(-12);
        a.count("revision");
        a.log("revision candidate", revisionCandidate);
        a.remember("revision", revisionCandidate);
        brain2AdvisoryChanged = true;
      }
      if (brain2AdvisoryChanged && a.userSpeaking()) {
        appendBrain2AdvisoryToConversation({ reason: "arrived during user speech" });
      }
    }

    function clear() {
      brain2NoteCandidates = [];
      brain2QuestionCandidates = [];
      brain2RevisionCandidates = [];
    }
    function reset() {
      clear();
      lastBrain2AdvisorySocket = null;
      lastBrain2AdvisoryText = "";
    }
    return {
      get notes() { return brain2NoteCandidates; },
      get questions() { return brain2QuestionCandidates; },
      get revisions() { return brain2RevisionCandidates; },
      accept, clear, reset,
      protocol: brain2AdvisoryProtocolInstructions,
      format: formatBrain2AdvisoryContent,
      instructions: formatBrain2ForInstructions,
      append: appendBrain2AdvisoryToConversation,
      loopGuardText: brain2LoopGuardText,
      loopCount: recentBrain2LoopGuardCount
    };
  }
  return { create };
});
