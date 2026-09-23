const assert = require('node:assert/strict');
const vm = require('node:vm');
const clone = value => JSON.parse(JSON.stringify(value));
function functionSource(page, name) {
  const start = page.indexOf(`    function ${name}(`);
  const end = page.indexOf('\n    }\n', start);
  assert(start >= 0 && end > start, name);
  return page.slice(start, end + 6);
}
function fixture(page, install) {
  let now = 1000;
  const trace = [];
  const c = vm.createContext({
    Date: { now: () => now++ },
    brain2NoteCandidates: [], brain2QuestionCandidates: [], brain2RevisionCandidates: [],
    lastBrain2AdvisorySocket: null, lastBrain2AdvisoryText: '',
    lastUserTurnActivityAt: 100, idleDiscovery: null, loadedNoteContexts: [],
    userSpeechActive: false, busy: false, connected: true, performance: false,
    realtimeConnection: { socket: {}, generation: 1 }, currentOutputId: 'b1', guidance: 'current',
    Robot790NoteBrains: { isCurrent: item => item.noteGuidanceKey === c.guidance },
    realtimeConnected: () => c.connected, performanceModeEnabled: () => c.performance,
    brain2EvidenceSnapshot: () => ({ last_assistant_output_id: c.currentOutputId }),
    brain2UserPresentButBusy: () => c.busy,
    bumpBrain2Counter: (...args) => trace.push(['count', ...args]),
    logBrain2: (...args) => trace.push(['log', ...args]),
    rememberBrain2Output: (...args) => trace.push(['remember', ...args]),
    rememberPromptLedger: packet => trace.push(['ledger', clone(packet)]),
    send: packet => { if (c.failSend) throw Error('send failed'); trace.push(['send', clone(packet)]); },
  });
  if (install) install(c, page);
  for (const name of ['brain2AdvisoryProtocolInstructions', 'formatBrain2AdvisoryContent',
    'formatBrain2ForInstructions', 'appendBrain2AdvisoryToConversation', 'brain2LoopGuardText',
    'recentBrain2LoopGuardCount']) vm.runInContext(functionSource(page, name), c);
  if (install) c.accept = result => c.brain2Advisories.accept(result);
  else {
    const start = page.indexOf('        let brain2AdvisoryChanged = false;');
    const end = page.indexOf('\n      } catch (error)', start);
    assert(start >= 0 && end > start);
    vm.runInContext(`function accept(result) {
      const question = String(result.question || '').trim();
      const noteForEric = String(result.note_for_eric || '').trim();
      const revisionCandidate = String(result.revision_candidate || '').trim();
      ${page.slice(start, end)}
    }`, c);
  }
  function snapshot(label) {
    return clone({ label, notes: c.brain2NoteCandidates, questions: c.brain2QuestionCandidates,
      revisions: c.brain2RevisionCandidates, content: c.formatBrain2AdvisoryContent(),
      instructions: c.formatBrain2ForInstructions(), loops: c.recentBrain2LoopGuardCount(), trace });
  }
  return { c, trace, snapshot, setTime: value => { now = value; } };
}
function characterize(page, install) {
  const f = fixture(page, install), { c } = f, results = [];
  const save = name => results.push(f.snapshot(name));
  const accept = (extra = {}) => c.accept({ note_for_eric: ' A note ', question: ' A question? ',
    revision_candidate: ' A revision ', observed_evidence: { last_assistant_output_id: c.currentOutputId }, ...extra });
  save('empty');
  accept(); save('all lanes');
  c.appendBrain2AdvisoryToConversation({ reason: 'first' }); save('delivered');
  c.appendBrain2AdvisoryToConversation(); save('duplicate');
  c.realtimeConnection.socket = {}; c.appendBrain2AdvisoryToConversation(); save('new socket');
  c.busy = true; c.userSpeechActive = true; accept(); save('busy but private advice arrives');
  c.userSpeechActive = false; c.lastUserTurnActivityAt = 2000; save('old note expired questions persist');
  c.lastUserTurnActivityAt = 0;
  accept({observed_evidence: {note_guidance: [], last_assistant_output_id: 'b1'}}); save('stale guidance');
  c.guidance = '[]'; save('guidance now current');
  for (let i = 0; i < 15; i++) accept({note_for_eric: `note ${i}`, question: `question ${i}`, revision_candidate: `revision ${i}`});
  save('bounded lists and snapshot');
  const loop = { status: 'ok', evidence_id: 'b1', loop: true, topic: 'topic' };
  accept({question:'', revision_candidate:'', note_for_eric:'loop note', steering:loop}); save('first loop');
  accept({question:'', revision_candidate:'', note_for_eric:'loop note', steering:loop}); save('same output loop held');
  c.currentOutputId = 'b2';
  accept({question:'', revision_candidate:'', note_for_eric:'next loop', steering:{...loop,evidence_id:'b2'}}); save('new output loop');
  c.idleDiscovery = {at:2000}; save('discovery retires loop count'); c.idleDiscovery = null;
  accept({question:'', revision_candidate:'', note_for_eric:'', steering:{...loop,evidence_id:'b2',loop:false}}); save('quiet steering replaces assessment');
  accept({question:'', revision_candidate:'', note_for_eric:'stale assessment', steering:loop}); save('stale steering not authoritative');
  c.connected = false; c.appendBrain2AdvisoryToConversation(); save('disconnected'); c.connected = true;
  c.performance = true; c.appendBrain2AdvisoryToConversation(); save('performance'); c.performance = false;
  c.failSend = true;
  assert.throws(() => c.appendBrain2AdvisoryToConversation(), /send failed/); save('failed send');
  c.failSend = false; c.appendBrain2AdvisoryToConversation(); save('retry send');
  if (install) c.brain2Advisories.clear();
  else c.brain2QuestionCandidates = c.brain2NoteCandidates = c.brain2RevisionCandidates = [];
  save('candidate clear');
  accept({note_for_eric:'LOOP GUARD: legacy',question:'',revision_candidate:'',observed_evidence:{}}); save('legacy without evidence');
  if (install) c.brain2Advisories.reset();
  else { c.brain2QuestionCandidates = []; c.brain2NoteCandidates = []; c.brain2RevisionCandidates = [];
    c.lastBrain2AdvisorySocket = null; c.lastBrain2AdvisoryText = ''; }
  save('connection reset');
  return results;
}
module.exports = { fixture, characterize, functionSource };
