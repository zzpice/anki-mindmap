const assert = require('node:assert/strict');

module.exports = async function checkMindMap(page, showCard, cases, engine) {
  await page.evaluate(() => localStorage.removeItem('decksBulletStates'));
  await showCard(page, cases.overview[0].front);
  assert.equal(await page.locator('.linkRender .bullet').count(), 4);
  const branches = () => page.locator('.linkRender .bullet').evaluateAll(bullets => bullets.map(b => {
    const child = b.parentElement.querySelector('.children');
    return child && {active:!!child.querySelector('.cloze'), open:getComputedStyle(child).display !== 'none'};
  }).filter(Boolean));
  assert.deepEqual(await branches(), [{active:true,open:true},{active:false,open:false}]);
  await page.locator('.custom2-button').click();
  assert.ok((await branches()).every(branch=>branch.open));
  await page.locator('.custom2-button').click();
  assert.deepEqual(await branches(), [{active:true,open:true},{active:false,open:false}]);
  await page.locator('.linkRender .cloze').click();
  assert.equal(await page.locator('.cloze-placeholder').count(), 0);
  assert.match(await page.locator('.linkRender .cloze').innerText(), /Answer/);
  await page.locator('.linkRender .cloze').click();
  assert.equal(await page.locator('.cloze-placeholder').count(), 1);
  await showCard(page, cases.mixed[0].front);
  assert.equal(await page.locator('.linkRender .cloze').count(), 2);
  await page.locator('.linkRender .cloze').first().click();
  assert.match(await page.locator('.linkRender .cloze').first().innerText(), /答案/);
  await showCard(page, cases.mixed[1].back);
  assert.match(await page.locator('.linkRender .cloze').innerText(), /另一个编号/);
  await showCard(page, cases.image[0].back);
  assert.equal(await page.locator('.linkRender .cloze img').isVisible(), true);
  assert.equal(await page.locator('#popup2 img').count(), 1);
  assert.equal(await page.locator('#popup').isVisible(), false);
  await showCard(page, cases.deep[0].front);
  assert.equal(await page.locator('.linkRender .cloze').count(), 1);
  assert.equal(await page.locator('.linkRender .cloze').isVisible(), true);
  await showCard(page, cases.reading[0].front);
  assert.equal(await page.locator('.linkRender .cloze').count(), 0);
  // Anki filters Text to empty when this ordinal only occurs in another field.
  assert.equal((await page.locator('.linkRender').textContent()).trim(), '');
  assert.match(await page.locator('#popup').textContent(), /Whole-note card/);
  await showCard(page, cases.table[0].back);
  assert.match(await page.locator('table .cloze').innerText(), /Cell answer/);
  for (const theme of ['light','dark']) {
    await page.emulateMedia({colorScheme:theme});
    await showCard(page, cases.overview[0].front);
    assert.equal(await page.locator('.linkRender .cloze').isVisible(), true);
  }
  await page.emulateMedia({colorScheme:'light'});
  await require('./mindmap_reliability.cjs')(page, showCard, cases);
  console.log(engine + ': offline mindmap folding, cloze, reliability, annotations, local links and resources passed');
};
