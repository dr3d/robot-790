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
      const ready = this.ready;
      this.ready = null;
      if (grant) this.api("revoke", grant).catch(() => {});
      if (ready) this.recordDelivery(ready.result, 'retained', { reason: 'idle-art permission revoked' });
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
    assertCanRender({ requirePermission = false } = {}) {
      let error = '';
      if (requirePermission && !this.authorized()) error = 'Idle-art permission absent or revoked.';
      else if (this.busy) error = 'An idle-art job is already in progress.';
      else if (this.ready) error = `Completed image awaits eye delivery: ${this.ready.result.filename}. No new generation was submitted.`;
      if (error) throw Object.assign(new Error(error), { generationSubmitted: false });
    }
    recordDelivery(result, status, extra = {}) {
      const row = this.history.find(item => item.job_id === result.idle_art_job);
      if (row) Object.assign(row, { status, ...extra });
      this.receipt({ status, job_id: result.idle_art_job, filename: result.filename, ...extra });
      this.changed();
    }
    async stageReady({ isCurrent = () => true, expectedFilename = '' } = {}) {
      if (!isCurrent()) throw new Error('Image request was superseded.');
      if (!this.authorized()) throw new Error('Idle-art permission absent or revoked.');
      if (this.busy) throw new Error('An idle-art job is already in progress.');
      const ready = this.ready;
      if (!ready) throw new Error('No completed idle-art image is awaiting delivery.');
      if (expectedFilename && ready.result.filename !== expectedFilename) throw new Error('The generated image changed; the requested artifact was not staged.');
      const state = this.context();
      if (ready.epoch !== this.epoch || ready.userKey !== state.userKey
          || ready.eyeKey !== state.eyeKey || ready.mediaKey !== state.mediaKey) {
        this.ready = null;
        this.recordDelivery(ready.result, 'retained', { reason: 'user, eye or image changed' });
        throw new Error(`Image delivery was superseded; retained on disk: ${ready.result.filename}`);
      }
      // Claim before awaiting so the automatic tick and a model move cannot both stage it.
      this.ready = null;
      this.busy = true;
      const runId = this.runId;
      const current = () => ready.epoch === this.epoch && this.authorized() && isCurrent();
      try {
        const moved = await this.deliver(ready.result, current);
        if (!current()) throw new Error('Image delivery was superseded.');
        this.recordDelivery(ready.result, 'staged', { saved_filename: moved?.saved_filename || '' });
        return moved;
      } catch (error) {
        if (runId === this.runId) this.recordDelivery(ready.result, current() ? 'display_failed' : 'retained', { error: error.message });
        throw error;
      } finally {
        if (runId === this.runId) this.busy = false;
        this.changed();
      }
    }
    async renderRequested(proposal, { size = "1024x1024", isCurrent = () => true } = {}) {
      this.assertCanRender({ requirePermission: true });
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
        if (retained) Object.assign(row, { status: 'retained', reason: 'request or scene changed during generation' });
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
        try {
          await this.stageReady();
        } catch {
          // stageReady records the artifact outcome; never generate a replacement here.
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
        this.recordDelivery(result, 'ready');
      } catch {
        // renderRequested has already recorded the failed attempt; never retry it.
      }
    }
  }
  return { Controller };
});
