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
      return this.grant && !this.queued && !this.ready && !this.busy && this.context().eligible
        ? { run_id: this.runId, token: this.grant.token } : null;
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
        if (ready.eyeKey !== state.eyeKey || ready.mediaKey !== state.mediaKey) {
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
      if (!this.queued || !this.grant) return;
      if (this.queued.userKey !== state.userKey || this.now() - this.queued.at > 15 * 60000) {
        this.queued = null;
        this.changed();
        return;
      }
      if (state.blocked || state.quietMs < state.minimumQuietMs) return;
      const queued = this.queued;
      this.queued = null;
      this.busy = true;
      const epoch = this.epoch;
      const runId = this.runId;
      const history = this.history;
      const row = { status: "started", ...queued.proposal, at: this.now(), job_id: this.id() };
      history.push(row);
      this.receipt(row);
      this.changed();
      try {
        const result = await this.api("render", { ...this.grant, job_id: row.job_id, proposal: queued.proposal });
        Object.assign(row, { status: "complete", filename: result.filename, job_id: result.idle_art_job });
        if (epoch !== this.epoch || !this.context().connected) return;
        this.ready = { result, epoch, eyeKey: state.eyeKey, mediaKey: state.mediaKey };
        this.receipt(row);
      } catch (error) {
        Object.assign(row, { status: "failed", error: error.message });
        if (epoch === this.epoch) this.receipt(row);
      } finally {
        if (runId === this.runId) this.busy = false;
        this.changed();
      }
    }
  }
  return { Controller };
});
