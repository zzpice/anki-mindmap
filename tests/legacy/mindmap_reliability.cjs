const assert = require('node:assert/strict');

module.exports = async function checkReliability(page, showCard, cases) {
  const fresh = async () => {
    await page.reload();
    await page.evaluate(() => localStorage.clear());
  };
  const branchStates = () => page.locator('.linkRender .children').evaluateAll(nodes =>
    nodes.map(node => getComputedStyle(node).display !== 'none'));

  // Fresh documents matter: an old delegated handler used to hide startup failures.
  for (const mode of ['bad-json', 'array', 'primitive', 'bad-deck', 'bad-value', 'read-denied', 'write-denied']) {
    await fresh();
    await page.evaluate(mode => {
      const values = {'bad-json':'{broken', array:'[]', primitive:'42', 'bad-deck':'{"Default":null}', 'bad-value':'{"Default":{"2":"true"}}'};
      if (mode in values) localStorage.setItem('decksBulletStates', values[mode]);
      if (mode === 'read-denied') Storage.prototype.getItem = () => { throw new DOMException('Denied', 'SecurityError'); };
      if (mode === 'write-denied') Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
    }, mode);
    await showCard(page, cases.overview[0].front);
    assert.deepEqual(await branchStates(), [true, false], mode);
    await page.locator('.cloze').click();
    assert.equal(await page.locator('.cloze').innerText(), 'Answer', mode);
    await page.locator('.custom2-button').click();
    assert.deepEqual(await branchStates(), [true, true], mode);
    await page.evaluate(() => toggleTheme());
    await showCard(page, cases.overview[0].back);
    assert.deepEqual(await branchStates(), [true, true], mode + ': preserve in-session expansion');
    assert.equal(await page.locator('html.theme-zhulu').count(), 1, mode + ': preserve theme');
    await page.keyboard.press('[');
    assert.equal(await page.locator('.cloze-placeholder').count(), 1, mode);
    await page.keyboard.press(']');
    assert.equal(await page.locator('.cloze').innerText(), 'Answer', mode);
  }

  // A valid hint and plain native Cloze also have a safe reveal/hide path.
  await fresh();
  for (const side of ['front', 'back']) {
    await showCard(page, cases.plain[0][side]);
    if (side === 'front') assert.equal(await page.locator('.cloze-placeholder').innerText(), '[提示]');
    else await page.locator('.cloze').click();
    await page.locator('.cloze').click();
    assert.equal(await page.locator('.cloze').innerText(), 'Plain answer');
  }

  // Repeated real clicks on nested rich answers and images, with both fresh backs and flips.
  for (let repeat = 0; repeat < 3; repeat++) {
    for (const side of ['front', 'back']) {
      await showCard(page, cases.mixed[0][side]);
      if (side === 'front') await page.locator('.cloze').first().click();
      await page.locator('.cloze b').click();
      assert.equal(await page.locator('.cloze').first().innerText(), '[...]');
      await page.keyboard.press(']');
      assert.equal(await page.locator('.cloze b').innerText(), '答案');
      await page.keyboard.press('[');
      await page.keyboard.press(']');
      // Other-group show/hide must not hide the active answer on the back.
      if (side === 'back') {
        await page.locator('.custom-button').click();
        assert.equal(await page.locator('.cloze b').isVisible(), true);
      }
    }
    await showCard(page, cases.image[0].back);
    await page.locator('.cloze img').click();
    assert.equal(await page.locator('.cloze-placeholder').count(), 1);
    await page.locator('.cloze').click();
    assert.equal(await page.locator('.cloze img').isVisible(), true);
  }

  // A completed browser tap must toggle once; a scroll/cancel must not reveal an answer.
  for (const side of ['front', 'back']) {
    await showCard(page, cases.overview[0][side]);
    await page.locator('.cloze').tap();
    await page.waitForFunction(expected => document.querySelectorAll('.cloze-placeholder').length === expected, side === 'front' ? 0 : 1, {timeout:2000});
    await page.locator('.cloze').tap();
    await page.waitForFunction(expected => document.querySelectorAll('.cloze-placeholder').length === expected, side === 'front' ? 1 : 0, {timeout:2000});
  }

  await showCard(page, cases.mixed[0].front);
  await page.locator('cloze2_w.cz-2').tap();
  assert.equal(await page.locator('cloze2.cz-2').isVisible(), true);
  await page.locator('cloze2.cz-2').tap();
  assert.equal(await page.locator('cloze2.cz-2').isVisible(), false);
  for (const gesture of ['scroll', 'cancel', 'multi']) {
    await showCard(page, cases.overview[0].front);
    await page.evaluate(gesture => {
      const element = document.querySelector('.cloze');
      const point = x => ({identifier:1, clientX:x, clientY:0});
      const send = (type, touches, changedTouches) => {
        const event = new Event(type, {bubbles:true,cancelable:true});
        Object.defineProperties(event, {touches:{value:touches},changedTouches:{value:changedTouches}});
        element.dispatchEvent(event);
      };
      send('touchstart', [point(0)], [point(0)]);
      if (gesture === 'scroll') send('touchmove', [point(30)], [point(30)]);
      if (gesture === 'cancel') send('touchcancel', [], [point(0)]);
      if (gesture === 'multi') send('touchstart', [point(0), {...point(0),identifier:2}], []);
      send('touchend', [], [point(0)]);
    }, gesture);
    assert.equal(await page.locator('.cloze-placeholder').count(), 1, gesture);
  }

  for (const side of ['front', 'back']) {
    await showCard(page, cases.bookmark[0][side]);
    assert.equal(await page.locator('.content').first().isVisible(), true);
    assert.match(await page.locator('.content').first().innerText(), /保留正文.*后续正文/);
    await showCard(page, cases.annotations[0][side]);
    assert.equal(await page.locator('.tooltip').count(), 2);
    await page.locator('a[href="#_msocom_42"]').click();
    assert.match(await page.locator('.tooltip:visible').innerText(), /First annotation/);
    assert.doesNotMatch(await page.locator('.tooltip:visible').innerText(), /Return/);
    await page.locator('a[href="#_msocom_7"]').click();
    assert.equal(await page.locator('.tooltip:visible').innerText(), 'Second annotation');
    assert.equal(await page.locator('p').filter({hasText:'Unreferenced annotation'}).isVisible(), true);
    assert.equal(await page.locator('p').filter({hasText:'Preceding prose'}).isVisible(), true);
    // Reinitialization must neither lose paired content nor duplicate tooltips.
    await page.evaluate(() => processCardContent());
    assert.equal(await page.locator('.tooltip').count(), 2);
    await page.locator('a[href="#_msocom_42"]').click();
    assert.match(await page.locator('.tooltip:visible').innerText(), /First annotation/);
  }

  for (const platform of ['desktop', 'iphone', 'android']) {
    await fresh();
    await page.evaluate(platform => {
      document.documentElement.classList.toggle('iphone', platform === 'iphone');
      if (platform === 'android') window.AnkiDroidJS = function () { this.ankiSearchCard = query => { window.testNoteQuery = query; }; };
    }, platform);
    for (const side of ['front', 'back']) {
      await showCard(page, cases.links[0][side]);
      assert.equal(await page.locator('#externalSearch1, #externalSearch2').count(), 0);
      assert.equal(await page.locator('a[href^="http"]').count(), 0);
      if (side === 'front') await page.locator('.cloze').click();
      if (platform === 'desktop') {
        assert.equal(await page.locator('a.noteLink').count(), 0);
        assert.match(await page.locator('.linkRender').innerText(), /Local/);
        assert.match(await page.locator('.cloze').innerText(), /Answer link/);
      } else {
        const links = page.locator('a.noteLink');
        assert.equal(await links.count(), 2);
        if (platform === 'iphone') assert.match(await links.first().getAttribute('href'), /^anki:\/\//);
        else {
          await links.last().click();
          assert.equal(await page.evaluate(() => window.testNoteQuery), 'nid:1234567890124');
        }
      }
      await page.locator('.cloze b').click();
      assert.equal(await page.locator('.cloze-placeholder').count(), 1);
      await page.locator('.cloze').click();
      assert.equal(await page.locator('.cloze b').isVisible(), true);
      await page.locator('.bullet').first().click();
      assert.equal(await page.locator('.children').isVisible(), false);
    }
  }
  await fresh();
};
