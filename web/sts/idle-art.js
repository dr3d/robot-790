(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790IdleArt = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  class Controller {
    constructor({ api, context, deliver, receipt, changed = () => {}, now = () => Date.now(), id = () => crypto.randomUUID() }) {
      Object.assign(this, { api, context, deliver, receipt, changed, now, id });
      this.epoch = 0;
      this.runId = id();
      this.history = [];
      this.grant = null;
      this.queued = null;
      this.ready = null;
      this.busy = false;
    }
    async arm(settings) {
      if (!this.context().connected) throw new Error("Connect before enabling idle art.");
      const epoch = ++this.epoch;
      const grant = await this.api("arm", { ...settings, consent: true, run_id: this.runId });
      if (epoch !== this.epoch || !this.context().connected) {
        await this.api("revoke", grant);
        return false;
      }
      this.grant = grant;
      this.changed();
      return true;
    }
    disarm() {
      this.epoch++;
      const grant = this.grant;
      this.grant = null;
      this.queued = null;
      this.ready = null;
      if (grant) this.api("revoke", grant).catch(() => {});
      this.changed();
    }
    reset() {
      this.disarm();
      this.runId = this.id();
      this.history = [];
      this.busy = false;
    }
    proposalContext() {
      return this.authorized() && this.context().proposalsEnabled !== false && !this.queued && !this.ready && !this.busy
        ? { run_id: this.runId, token: this.grant.token } : null;
    }
    authorized() {
      const state = this.context();
      return Boolean(this.grant && state.connected && state.eligible);
    }
    async renderRequested(proposal, { size = "1024x1024", isCurrent = () => true } = {}) {
      if (!this.authorized()) throw Object.assign(new Error("Idle-art permission absent or revoked."), { generationSubmitted: false });
      if (this.busy || this.ready) throw Object.assign(new Error("An idle-art job is already in progress."), { generationSubmitted: false });
      if (!isCurrent()) throw Object.assign(new Error("Image request was superseded."), { generationSubmitted: false });
      const state = this.context(), epoch = this.epoch, runId = this.runId;
      this.queued = null;
      this.busy = true;
      const row = { status: "started", ...proposal, at: this.now(), job_id: this.id() };
      this.history.push(row);
      this.receipt(row);
      this.changed();
      try {
        const result = await this.api("render", { ...this.grant, job_id: row.job_id, proposal, size });
        if (result.status !== "ok") throw new Error(result.error || "Idle-art render failed.");
        Object.assign(row, { status: "complete", filename: result.filename, job_id: result.idle_art_job });
        const current = this.context();
        const retained = epoch !== this.epoch || !this.authorized() || !isCurrent()
          || state.userKey !== current.userKey || state.eyeKey !== current.eyeKey || state.mediaKey !== current.mediaKey;
        if (epoch === this.epoch) this.receipt(row);
        return { ...result, retained };
      } catch (error) {
        Object.assign(row, { status: "failed", error: error.message });
        if (epoch === this.epoch) this.receipt(row);
        throw error;
      } finally {
        if (runId === this.runId) this.busy = false;
        this.changed();
      }
    }
    offer(proposal) {
      if (!this.proposalContext() || !proposal?.prompt || !proposal?.title) return false;
      if (this.history.some(row => row.prompt === proposal.prompt)) return false;
      this.queued = { proposal, at: this.now(), userKey: this.context().userKey };
      this.receipt({ status: "queued", title: proposal.title, run_id: this.runId });
      this.changed();
      return true;
    }
    snapshot(limit = Infinity) {
      return { run_id: this.runId, attempts: this.history.length,
        jobs: this.history.slice(-limit).map(({ prompt, ...receipt }) => receipt) };
    }
    async tick() {
      const state = this.context();
      if (!state.connected || !state.eligible || this.busy) return;
      if (this.ready) {
        if (state.blocked) return;
        const ready = this.ready;
        this.ready = null;
        if (ready.epoch !== this.epoch) return;
        if (ready.userKey !== state.userKey || ready.eyeKey !== state.eyeKey || ready.mediaKey !== state.mediaKey) {
          this.receipt({ status: "retained", filename: ready.result.filename, reason: "eye or image changed" });
          return;
        }
        this.busy = true;
        const deliveryRunId = this.runId;
        try {
          const current = () => ready.epoch === this.epoch && this.context().connected;
          await this.deliver(ready.result, current);
        } catch (error) {
          this.receipt({ status: "display_failed", filename: ready.result.filename, error: error.message });
        } finally {
          if (deliveryRunId === this.runId) this.busy = false;
          this.changed();
        }
        return;
      }
      if (!this.queued || !this.grant || state.proposalsEnabled === false) return;
      if (this.queued.userKey !== state.userKey || this.now() - this.queued.at > 15 * 60000) {
        this.queued = null;
        this.changed();
        return;
      }
      if (state.blocked || state.quietMs < state.minimumQuietMs) return;
      const queued = this.queued;
      const epoch = this.epoch;
      try {
        const result = await this.renderRequested(queued.proposal);
        if (result.retained) return;
        this.ready = { result, epoch, userKey: state.userKey, eyeKey: state.eyeKey, mediaKey: state.mediaKey };
      } catch {
        // renderRequested has already recorded the failed attempt; never retry it.
      }
    }
  }
  return { Controller };
});
