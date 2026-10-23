const assert = require('node:assert/strict');

// Reproduce the missed condition: native side replacement changes the fixed
// viewport height even though this is still the same card/orientation.
module.exports = async function edges(browser, base, renders) {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 },
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await context.route('**/edge-card?*', route => {
    const p = new URL(route.request().url()).searchParams;
    const html = renders.welcome[Number(p.get('index') || 0)][p.get('side') || 'front'];
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body:
      `<!doctype html><html class="mobile ${p.get('platform') || 'iphone'}"><head>` +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      `<base href="${base}/"></head><body class="card">` + html + '</body></html>' });
  });
  const tick = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const show = async (side, index = 0, platform = 'iphone') => {
    await page.goto(`${base}/edge-card?side=${side}&index=${index}&platform=${platform}`);
    await page.waitForSelector('#mm-react[data-ready]');
    await tick();
  };
  const measure = () => page.evaluate(() => [...document.querySelectorAll('nav button')].map(b => {
    const r = b.getBoundingClientRect(), t = b.querySelector('.mm-edge-label > span').getBoundingClientRect();
    return { top: r.top, height: r.height, text: t.top + t.height / 2 };
  }));
  const anchored = (actual, expected, message) => {
    actual.forEach((r, i) => {
      assert.ok(Math.abs(r.top - expected[i].top) < .5, message + ' seam');
      assert.ok(Math.abs(r.text - expected[i].text) < .5, message + ' label');
    });
  };
  const retire = () => page.evaluate(() => AnkiMindmap.current().dispose());
  await show('front');
  const front = await measure();
  await retire();
  await page.setViewportSize({ width: 390, height: 844 });
  await show('back');
  const back = await measure();
  anchored(back, front, 'same iOS card keeps seam and labels when native back grows viewport');
  assert.ok(back.filter(b => b.top > 0).every(b => Math.abs(b.top + b.height - 844) < .5), 'lower hit areas extend to the new bottom without a gap');
  assert.ok(await page.evaluate(() => AnkiMindmap.current().inspect().edgeLayout.pinned));
  for (const y of [0, 700, 150]) {
    await page.evaluate(y => window.scrollTo(0, y), y); await tick();
    assert.deepEqual(await measure(), back, 'scroll cannot change the restored side geometry');
  }
  const resource = await page.evaluate(() => {
    const old = AnkiMindmap.current(); old.dispose();
    window.dispatchEvent(new Event('resize'));
    return old.inspect().resources;
  });
  assert.ok(Object.values(resource).every(v => v === 0));

  // New fronts, ordinals, orientation and user zoom must not inherit anchors.
  await show('front');
  assert.ok((await measure()).every(b => Math.abs(b.height - 422) < 1));
  await retire(); await page.setViewportSize({ width: 390, height: 780 });
  await show('back', 1);
  assert.equal(await page.evaluate(() => AnkiMindmap.current().inspect().edgeLayout.pinned), false);
  await show('front'); await retire();
  await page.setViewportSize({ width: 390, height: 844 }); await show('back');
  await page.setViewportSize({ width: 780, height: 390 }); await tick();
  assert.ok((await measure()).every(b => Math.abs(b.height - 195) < 1));
  assert.equal(await page.evaluate(() => AnkiMindmap.current().inspect().edgeLayout.pinned), false);
  await page.setViewportSize({ width: 390, height: 780 });
  await show('front');
  await page.evaluate(() => AnkiMindmap.current().dispatch({ type: 'zoom', value: 1.1 }));
  const zoomed = await measure(); await retire();
  await page.setViewportSize({ width: 390, height: 844 }); await show('back');
  anchored(await measure(), zoomed, 'handoff uses pixel geometry correctly with CSS zoom');
  const mutations = await page.evaluate(async () => {
    let count = 0;
    const observer = new MutationObserver(records => { count += records.length; });
    observer.observe(document.querySelector('[data-mm-ui]'), { subtree: true, attributes: true, attributeFilter: ['style'] });
    for (let i = 0; i < 20; i++) AnkiMindmap.current().dispatch({ type: 'interrupt' });
    await Promise.resolve(); observer.disconnect(); return count;
  });
  assert.equal(mutations, 0, 'stable iOS scroll/interrupts do not rewrite normalised subpixel styles');
  await page.evaluate(() => AnkiMindmap.current().dispatch({ type: 'zoom', value: 1.2 }));
  assert.equal(await page.evaluate(() => AnkiMindmap.current().inspect().edgeLayout.pinned), false);

  await page.setViewportSize({ width: 390, height: 780 }); await show('front');
  await retire();
  await page.evaluate(() => {
    const key = 'anki_mindmap.front-layout.v1';
    const state = JSON.parse(sessionStorage.getItem(key)); state.edges.bounds = [null];
    sessionStorage.setItem(key, JSON.stringify(state));
  });
  await show('back');
  assert.equal(await page.evaluate(() => AnkiMindmap.current().inspect().edgeLayout.pinned), false);
  await page.setViewportSize({ width: 390, height: 780 }); await show('front', 0, 'android'); await retire();
  await page.setViewportSize({ width: 390, height: 844 }); await show('back', 0, 'android');
  assert.ok((await measure()).every(b => Math.abs(b.height - 422) < 1), 'Android keeps its existing responsive rules');
  await context.addInitScript(() => Object.defineProperty(window, 'sessionStorage', {
    get() { throw Error('unavailable'); },
  }));
  await show('front'); await show('back');
  assert.equal(await page.evaluate(() => AnkiMindmap.current().inspect().state.revealed.a0), true);
  await context.close();
  return { changedNativeViewport: '780 -> 844px, iOS seam/labels unchanged; lower surfaces fill the new bottom',
    scrolling: 'passed', newFrontAndOrdinal: 'passed', orientationAndZoom: 'passed',
    malformedOrBlockedStorage: 'passed (readable CSS fallback)', AndroidUnchanged: 'passed',
    limitations: 'No physical iOS certification; labels retain front anchors rather than recentering in newly exposed bottom space.' };
};
