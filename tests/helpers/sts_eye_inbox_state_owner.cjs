const fs = require('node:fs');
const vm = require('node:vm');
const fields = { sensingEyeInboxLastSeq: 'lastSeq', sensingEyeInboxIgnoreSeqThrough: 'ignoreSeqThrough', handledSensingEyeInboxSeqs: 'handled' };
const installed = new WeakMap(), aliases = new WeakSet();

function installInboxState(c, page) {
  if (!page.includes('const sensingEyeInboxState = Robot790SensingEyeInboxState.create();')) return;
  if (c.sensingEyeInboxState && installed.get(c) === c.sensingEyeInboxState) return;
  const descriptors = Object.fromEntries(Object.keys(fields).map(key => [key, Object.getOwnPropertyDescriptor(c, key)]));
  const initial = Object.fromEntries(Object.entries(fields).map(([key, field]) => [field, c[key]]));
  let state;
  // Legacy VM fixtures seed races and observe writes; shipped code has no state hook.
  c.__fixtureInboxState = defaults => {
    for (const [key, value] of Object.entries(initial)) if (value !== undefined) defaults[key] = value;
    state = new Proxy(defaults, { set(target, key, value) {
      target[key] = value;
      const legacy = Object.keys(fields).find(name => fields[name] === key);
      const setter = descriptors[legacy]?.set;
      if (setter && !aliases.has(setter)) setter.call(c, value);
      return true;
    } });
    return state;
  };
  const source = fs.readFileSync(`${__dirname}/../../web/sts/sensing-eye-inbox-state.js`, 'utf8');
  if (!source.includes('const s = createState();')) throw Error('Inbox fixture state hook missing');
  vm.runInContext(source.replace('const s = createState();', 'const s = __fixtureInboxState(createState());'), c);
  c.sensingEyeInboxState = c.Robot790SensingEyeInboxState.create();
  installed.set(c, c.sensingEyeInboxState);
  for (const [key, field] of Object.entries(fields)) {
    const setter = value => { state[field] = value; };
    aliases.add(setter);
    Object.defineProperty(c, key, { configurable: true, enumerable: true, get: () => state[field], set: setter });
  }
}

function normalizeInboxState(source) {
  source = require('./sts_b2_evidence_scope.cjs').normalizeB2Evidence(source);
  return source
    .replaceAll('sensingEyeInboxState.observeSaved(seq);', 'sensingEyeInboxLastSeq = Math.max(sensingEyeInboxLastSeq, seq);\n          sensingEyeInboxIgnoreSeqThrough = Math.max(sensingEyeInboxIgnoreSeqThrough, seq);\n          handledSensingEyeInboxSeqs.add(String(seq));')
    .replaceAll('sensingEyeInboxState.ignoreThrough(Number(result.latest_seq) || 0);', 'sensingEyeInboxLastSeq = Math.max(sensingEyeInboxLastSeq, Number(result.latest_seq) || 0);\n      sensingEyeInboxIgnoreSeqThrough = Math.max(sensingEyeInboxIgnoreSeqThrough, Number(result.latest_seq) || 0);')
    .replaceAll('sensingEyeInboxState.ignoreThrough(latestSeq);', 'sensingEyeInboxLastSeq = Math.max(sensingEyeInboxLastSeq, latestSeq);\n      sensingEyeInboxIgnoreSeqThrough = Math.max(sensingEyeInboxIgnoreSeqThrough, latestSeq);')
    .replaceAll('sensingEyeInboxState.advance(seq);', 'sensingEyeInboxLastSeq = Math.max(sensingEyeInboxLastSeq, seq);')
    .replaceAll('sensingEyeInboxState.remember(seqKey);', 'handledSensingEyeInboxSeqs.add(seqKey);\n        while (handledSensingEyeInboxSeqs.size > 100) {\n          handledSensingEyeInboxSeqs.delete(handledSensingEyeInboxSeqs.values().next().value);\n        }')
    .replaceAll('sensingEyeInboxState.has(', 'handledSensingEyeInboxSeqs.has(')
    .replaceAll('sensingEyeInboxState.lastSeq', 'sensingEyeInboxLastSeq')
    .replaceAll('sensingEyeInboxState.ignoreSeqThrough', 'sensingEyeInboxIgnoreSeqThrough');
}
module.exports = { installInboxState, normalizeInboxState };
