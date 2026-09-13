const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function source(name) {
  const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
  const end = page.indexOf('\n    }\n', start);
  assert.ok(start >= 0 && end > start, name);
  return page.slice(start, end + 6);
}

function fixture(allowed = true) {
  const writes = [];
  const c = vm.createContext({
    noteFileWriteAllowed: () => allowed,
    location: { href: 'http://localhost/' }, URL, Date,
    currentModelStamp: () => 'test',
    conversationDisplayText: () => 'You: Original conversation\nRobot 790: Original reply',
    events: { textContent: 'Original events' },
    formatIdleRuminationsSection: () => 'Original idle thoughts',
    maxSessionNoteChars: 100000,
    log() {},
    fetch: async (url, options) => {
      const payload = JSON.parse(options.body);
      writes.push(payload);
      return { ok: true, json: async () => ({ status: 'ok', filename: payload.filename, characters: payload.content.length }) };
    },
  });
  for (const name of ['sessionNoteSection', 'clipSessionNote', 'formatSessionNote', 'writeTextFile']) {
    vm.runInContext(source(name), c);
  }
  return { c, writes };
}

test('authored note content is written unchanged, without transcript substitution', async () => {
  const { c, writes } = fixture();
  const content = 'Gulu Gulu: paid questions, projected Salem art, and a teetering Plexiglas puppet.\nMusic could punctuate the act.';
  const receipt = await c.writeTextFile({ filename: 'puppet.txt', content });
  assert.equal(receipt.status, 'ok');
  assert.equal(writes[0].content, content);
  assert.equal(writes[0].mode, 'overwrite');
  assert.doesNotMatch(writes[0].content, /Original conversation|STS Session Note/);
});

test('missing or blank content never silently saves a transcript', async () => {
  const { c, writes } = fixture();
  for (const content of [undefined, null, '', '   ']) {
    await assert.rejects(c.writeTextFile({ filename: 'puppet.txt', content }), /Nothing was written.*pass content/);
  }
  assert.equal(writes.length, 0);
});

test('obsolete summary selectors and unknown sources cannot overwrite a note', async () => {
  const { c, writes } = fixture();
  for (const source of ['note_summary', 'summary', 'unknown']) {
    await assert.rejects(c.writeTextFile({ filename: 'puppet.txt', source, source_filename: 'old.txt' }), /Nothing was written/);
  }
  assert.equal(writes.length, 0);
});

test('explicit raw capture paths remain available, including append', async () => {
  const { c, writes } = fixture();
  for (const source of ['conversation', 'events', 'idle_ruminations', 'conversation_and_idle', 'full_session']) {
    await c.writeTextFile({ filename: 'archive.txt', source, mode: 'append' });
    const saved = writes.at(-1);
    assert.equal(saved.mode, 'append');
    assert.ok(saved.content.includes(`Source: ${source}`));
  }
  assert.match(writes[0].content, /Original conversation/);
  assert.doesNotMatch(writes[0].content, /Original events|Original idle thoughts/);
  assert.match(writes.at(-1).content, /Original events/);
  assert.match(writes.at(-1).content, /Original idle thoughts/);
});

test('authored content and code are not reformatted; write authorization remains required', async () => {
  const { c, writes } = fixture();
  const content = 'print("hello")\n';
  await c.writeTextFile({ filename: 'example.py', content, source: 'conversation' });
  assert.equal(writes[0].content, content);
  const blocked = fixture(false);
  await assert.rejects(blocked.c.writeTextFile({ filename: 'no.txt', content: 'note' }), /explicit user request/);
  assert.equal(blocked.writes.length, 0);
});

test('tool instructions prefer composed notes and no longer offer keyword summaries', () => {
  const start = page.indexOf('    const noteFileTools = [');
  const end = page.indexOf('        name: "read_text_file"', start);
  const schema = page.slice(start, end);
  assert.match(schema, /By default, compose a concise note in your own words/);
  assert.match(schema, /Required for authored notes and summaries/);
  assert.doesNotMatch(schema, /note_summary|source_filename/);
  assert.match(page, /Save these ideas, make a note, save our discussion, and summarize this mean an authored note/);
  assert.doesNotMatch(page, /function formatLoadedNoteSummary|function appendTopicSections|detailed summary note of this conversation or our situation/);
  assert.match(source('saveConversationThreadNote'), /formatSessionNote\(\{ source: "conversation" \}\)/);
});
