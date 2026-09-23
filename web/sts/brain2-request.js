(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790Brain2Request = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function buildPayload(input) {
    const { manual, headlines, evidence, body } = input;
    const { fingerprint, user_key, ...evidenceContext } = evidence;
    return {
      mode: headlines ? "headlines" : manual ? "question" : "person",
      ...(Object.hasOwn(input, "idleArt") ? { idle_art: input.idleArt } : {}),
      ...(headlines ? { headlines } : {}),
      ...(body ? { body } : {}),
      person_focus: input.personFocus,
      setup_cards: evidence.setup_cards,
      note_guidance: evidence.note_guidance,
      conversation: input.conversation,
      recent_idle: input.recentIdle,
      recent_brain2: input.recentBrain2,
      voice_shape: evidence.latest_user_utterance?.prosody || "",
      evidence: evidenceContext
    };
  }

  async function run(input, effects) {
    const { manual, evidence, body, observedBody, socket, generation } = input;
    const requestPayload = buildPayload(input);
    const response = await effects.post(requestPayload);
    const result = await response.json().catch(() => ({}));
    const session = effects.currentSession();
    const current = socket === session.socket && generation === session.generation
      && evidence.evidence_generation === session.evidenceGeneration
      && JSON.stringify(evidence.setup_cards) === JSON.stringify(effects.setupCards())
      && JSON.stringify(evidence.note_guidance) === JSON.stringify(effects.noteGuidance());
    // Preserve diagnostic ordering: current-context replies are logged even if
    // newer speech subsequently makes them ineligible for advice delivery.
    if (current) {
      effects.rememberPrompt({ manual, requestPayload, result });
      if (body) effects.logBodyChoice(JSON.stringify(result.body_choice || { status: "unavailable" }));
    }
    if (!current || evidence.user_key !== effects.latestUserKey() || effects.userSpeaking()) {
      return { status: "stale", observed_evidence: evidence };
    }
    if (!response.ok || result.status === "error") {
      throw new Error(result.error || `${response.status} ${response.statusText}`);
    }
    effects.acceptEvidence(evidence);
    return { ...result, observed_evidence: evidence, observed_body: observedBody };
  }

  return { buildPayload, run };
});
