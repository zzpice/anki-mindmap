const assert = require('node:assert/strict');

// Layout contract, not a simulation/certification of AnkiMobile's native insets.
// A real viewport change must remain responsive regardless of teardown order.
module.exports = async function edges(browser, base, renders) {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 },
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await context.route('**/edge-card?*', route => {
    const p = new URL(route.request().url()).searchParams;
    const html = renders[p.get('key') || 'welcome'][0][p.get('side') || 'front'];
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body:
      `<!doctype html><html class="mobile ${p.get('platform') || 'iphone'}"><head>` +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      `<base href="${base}/"></head><body class="card">` + html + '</body></html>' });
  });
  const tick = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const show = async (side, platform = 'iphone', key = 'welcome') => {
    await page.goto(`${base}/edge-card?side=${side}&platform=${platform}&key=${key}`);
    await page.waitForSelector('#mm-react[data-ready]');
    await page.evaluate(() => document.fonts.ready); await tick();
  };
  const measure = () => page.evaluate(() => [...document.querySelectorAll('nav button')].map(b => {
    const r = b.getBoundingClientRect(), t = b.querySelector('.mm-edge-label > span').getBoundingClientRect();
    return { top: r.top, height: r.height, text: t.top + t.height / 2,
      left: r.left, right: r.right, inlineGeometry: ['top', 'bottom', 'height'].some(k => b.style[k]) };
  }));
  const check = async height => {
    const bars = await measure();
    for (const b of bars) {
      assert.ok(Math.abs(b.height - height / 2) < .5, 'two equal viewport halves');
      assert.ok(Math.abs(b.top - (b.top < 1 ? 0 : height / 2)) < .5, 'single middle seam');
      assert.ok(Math.abs(b.text - b.top - b.height / 2) < .6, 'label centred in its current half');
      assert.ok(b.left >= -.5 && b.right <= 390.5, 'complete hit area inside viewport');
      assert.equal(b.inlineGeometry, false, 'geometry has one CSS authority, no inline coordinate compensation');
    }
    return bars;
  };
  const rows = [];
  for (const platform of ['iphone', 'android']) {
    for (const order of ['resize-before-dispose', 'resize-after-dispose']) {
      await page.setViewportSize({ width: 390, height: 780 });
      await show('front', platform); await check(780);
      if (order === 'resize-before-dispose') {
        await page.setViewportSize({ width: 390, height: 844 }); await tick();
      }
      await page.evaluate(() => AnkiMindmap.current().dispose());
      if (order === 'resize-after-dispose') await page.setViewportSize({ width: 390, height: 844 });
      await show('back', platform); await check(844);
      rows.push({ platform, order, seam: 422, centred: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 780 });
  await show('front', 'iphone', 'wide-review');
  const before = await check(780);
  for (const y of [0, 700, 150]) {
    await page.evaluate(y => window.scrollTo(0, y), y); await tick();
    assert.deepEqual(await measure(), before, 'content scrolling does not resize tabs');
  }
  await page.evaluate(() => AnkiMindmap.current().dispatch({ type: 'toggleAnswer', id: 'a0' }));
  assert.deepEqual(await measure(), before, 'answer reveal cannot resize tabs at a constant viewport');
  await show('back', 'iphone', 'wide-review');
  assert.deepEqual(await measure(), before, 'native flip stays stable at a constant viewport');
  await page.evaluate(() => AnkiMindmap.current().dispatch({ type: 'zoom', value: 1.1 }));
  await check(780);
  await page.setViewportSize({ width: 780, height: 390 }); await tick();
  const landscape = await measure();
  assert.ok(landscape.every(b => Math.abs(b.height - 195) < .5 &&
    Math.abs(b.text - b.top - b.height / 2) < .6));
  const resource = await page.evaluate(() => {
    const old = AnkiMindmap.current(); old.dispose();
    window.dispatchEvent(new Event('resize')); return old.inspect().resources;
  });
  assert.ok(Object.values(resource).every(v => v === 0));
  await context.close();
  return { viewportAndTeardownOrder: rows, constantViewportRevealFlipAndScroll: 'passed',
    zoomAndOrientation: 'passed', inlineCompensation: 'absent', disposal: 'passed',
    limitation: 'A changing real iOS visible inset/viewport still requires device measurements; this test does not claim it is fixed.' };
};
