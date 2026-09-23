const assert = require('node:assert/strict');
const path = require('node:path');

async function checkPinnedTitles(page, artifacts) {
  const result = await page.evaluate(() => {
    const filename = 'sessions/session-20260923-101915-518.txt';
    loadedNoteContexts = [{ filename, content: 'STS Session Note\nFixture transcript.', loadedAt: 1 }];
    continuitySessions = [{ filename, title: 'Touch screen moods and Chamber Seven cold open' }];
    const before = formatLoadedNotesForInstructions();
    const pins = listPinnedNotes();
    contextCardOpenByName.set('Loaded Notes', true);
    renderContextMap();
    return { filename: pins.notes[0].filename, title: pins.notes[0].title,
      contextUnchanged: before === formatLoadedNotesForInstructions() };
  });
  assert.equal(result.filename, 'sessions/session-20260923-101915-518.txt');
  assert.equal(result.title, 'Touch screen moods and Chamber Seven cold open');
  assert.equal(result.contextUnchanged, true);
  const card = page.locator('[data-context-name="Loaded Notes"]');
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await card.evaluate(element => {
      for (let current = element; current; current = current.parentElement) {
        if (current.tagName === 'DETAILS') current.open = true;
      }
    });
    await card.scrollIntoViewIfNeeded();
    const text = await card.innerText();
    assert(text.includes(result.title));
    assert(text.includes(result.filename));
    assert(await card.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
    await card.screenshot({ path: path.join(artifacts, `pinned-titles-${name}.png`) });
  }
  const literalTitle = await page.evaluate(() => {
    continuitySessions[0].title = '<img src=x onerror=alert(1)>';
    renderContextMap();
    const card = document.querySelector('[data-context-name="Loaded Notes"]');
    return { literal: card.textContent.includes(continuitySessions[0].title), images: card.querySelectorAll('img').length };
  });
  assert.deepEqual(literalTitle, { literal: true, images: 0 });
  return result;
}

module.exports = { checkPinnedTitles };
