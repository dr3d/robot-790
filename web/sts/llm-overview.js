/* Aggregate existing Realtime events; no requests, timers, or per-call log. */
(function (root) {
  "use strict";
  const number = value => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  const rounded = value => value === null ? null : Math.round(value * 100) / 100;
  const bucket = () => ({ count: 0, first: null, last: null, peak: null });

  class LlmOverview {
    constructor(prepared = {}) {
      this.prepared = { ...prepared };
      this.pending = new Map();
      this.finished = new Set();
      this.responses = 0;
      this.incomplete = 0;
      this.measured = 0;
      this.inputTokens = 0;
      this.outputTokens = 0;
      this.pacedTokens = 0;
      this.pacedSeconds = 0;
      this.firstOutputSeconds = 0;
      this.firstOutputCount = 0;
      this.context = { conversation: bucket(), isolated: bucket(), unknown: bucket() };
    }

    observe(event, now) {
      const id = event.response?.id || event.response_id;
      if (!id || this.finished.has(id)) return false;
      if (event.type === "response.created") {
        if (!this.pending.has(id)) this.pending.set(id, { started: now, first: null });
        if (this.pending.size > 16) this.pending.delete(this.pending.keys().next().value);
        return false;
      }
      const timing = this.pending.get(id);
      if (timing && timing.first === null && event.delta && [
        "response.output_text.delta", "response.output_audio.delta", "response.output_audio_transcript.delta"
      ].includes(event.type)) timing.first = now;
      if (event.type !== "response.done") return false;
      this.pending.delete(id);
      this.finished.add(id);
      if (this.finished.size > 64) this.finished.delete(this.finished.values().next().value);
      this.responses += 1;
      if (event.response?.status !== "completed") {
        this.incomplete += 1;
        return false;
      }
      const usage = event.response?.usage;
      const input = number(usage?.input_tokens);
      const output = number(usage?.output_tokens);
      // A zero-input response is often a cancellation/transport placeholder.
      if (input === null || input === 0 || output === null) return false;
      this.measured += 1;
      this.inputTokens += input;
      this.outputTokens += output;
      const conversation = event.response.conversation_id;
      const group = this.context[conversation === null ? "isolated" : conversation ? "conversation" : "unknown"];
      group.count += 1;
      group.first ??= input;
      group.last = input;
      group.peak = Math.max(group.peak || 0, input);
      if (timing && now > timing.started) {
        this.pacedTokens += output;
        this.pacedSeconds += (now - timing.started) / 1000;
        if (timing.first !== null && timing.first >= timing.started) {
          this.firstOutputSeconds += (timing.first - timing.started) / 1000;
          this.firstOutputCount += 1;
        }
      }
      return this.measured === 1;
    }

    snapshot() {
      const window = number(this.prepared.context_window_tokens);
      const context = Object.fromEntries(Object.entries(this.context).map(([key, value]) => [key, {
        ...value, peak_window_percent: window > 0 && value.peak !== null ? rounded(value.peak / window * 100) : null
      }]));
      return {
        scope: "B1 Realtime responses in this connection; excludes B2 and offline preparation",
        prepared: { ...this.prepared },
        responses: this.responses, incomplete_responses: this.incomplete,
        unfinished_responses: this.pending.size, measured_responses: this.measured,
        context, total_input_tokens: this.inputTokens, total_output_tokens: this.outputTokens,
        mean_first_output_seconds: this.firstOutputCount ? rounded(this.firstOutputSeconds / this.firstOutputCount) : null,
        response_paced_output_tokens_per_second: this.pacedSeconds ? rounded(this.pacedTokens / this.pacedSeconds) : null,
        timing_basis: "response.created to first received output / response.done; includes orchestration and TTS, not GPU decode",
        context_basis: "Reported request input tokens, not resident KV occupancy. Cumulative input includes repeated prefixes.",
        prefill_seconds: null, cached_tokens: null, decode_tokens_per_second: null,
        unavailable_reason: "Current Realtime events do not expose engine prefill, cache reuse, or decode timing."
      };
    }

    text() {
      const s = this.snapshot();
      const show = value => value === null || value === undefined ? "not reported" : value.toLocaleString("en-US");
      const p = s.prepared;
      const timing = (value, unit) => value === null ? "not reported" : `${show(value)}${unit}`;
      const context = Object.entries(s.context).filter(([, group]) => group.count).map(([name, group]) =>
        `${name}: ${show(group.first)} -> ${show(group.last)} input tokens; peak ${show(group.peak)}` +
        (group.peak_window_percent === null ? "" : ` (${group.peak_window_percent}% of configured window)`)
      );
      return [
        `B1 before inference: ~${show(p.approximate_prompt_tokens)} prompt tokens (characters/4; instructions + tools, not tokenized); ${show(p.note_count)} notes; ${show(p.tool_count)} tools.`,
        `Configured context window: ${show(p.context_window_tokens)} tokens (connect-time status snapshot).`,
        ...context,
        `After: ${s.responses} responses; ${s.measured_responses} with usage; ${s.incomplete_responses} incomplete; ${s.unfinished_responses} unfinished.`,
        `First output avg ${timing(s.mean_first_output_seconds, "s")}; response-paced output ${timing(s.response_paced_output_tokens_per_second, " tokens/s")} (includes orchestration/TTS, not model decode).`,
        "Engine prefill / cache reuse / decode tokens/s: not reported. Input tokens are request size, not resident KV occupancy."
      ].join("\n");
    }
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { LlmOverview };
  else root.Robot790LlmOverview = LlmOverview;
})(globalThis);
