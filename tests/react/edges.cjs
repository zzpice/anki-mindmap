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
    // Model the two independently observed native metrics, not just a normal
    // browser resize (where root and visual heights always move together).
    // This is a host-adapter contract, not an emulation of WKWebView internals.
    const rootHeight = Number(p.get('rootHeight'));
    const hostMetrics = rootHeight > 0 ? '<script>Object.defineProperty(document.documentElement,"clientHeight",' +
      `{configurable:true,get:()=>${rootHeight}})</script>` : '';
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body:
      `<!doctype html><html class="mobile ${p.get('platform') || 'iphone'}"><head>` +
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      `<base href="${base}/">` + hostMetrics + '</head><body class="card">' + html + '</body></html>' });
  });
  const tick = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const show = async (side, platform = 'iphone', key = 'welcome', rootHeight = 0) => {
    await page.goto(`${base}/edge-card?side=${side}&platform=${platform}&key=${key}&rootHeight=${rootHeight}`);
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
  const markers = [];
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 780 });
    for (const side of ['front', 'back']) {
      await show(side);
      for (const zoom of [.5, 1, 1.1, 2]) {
        await page.evaluate(value => AnkiMindmap.current().dispatch({type:'zoom', value}), zoom);
        const dots = await page.evaluate(() => {
          const content = document.querySelector('[data-mm-content]');
          const clip = content.getBoundingClientRect(), rail = document.querySelector('.mm-edge-left').getBoundingClientRect();
          return [...content.querySelectorAll('.bullet[aria-expanded="false"]')]
            .filter(b => b.getClientRects().length).map(b => {
              const r = b.querySelector('.bullet-dot').getBoundingClientRect();
              // getBoundingClientRect omits the folded dot's 4px outer ring.
              const scale = Number(document.querySelector('#mm-react').style.zoom);
              const left = r.left - 4 * scale, right = r.right + 4 * scale;
              return { insideScroller: left >= clip.left + 1 && right <= clip.right,
                clearOfRail: left >= rail.right + 4 };
            });
        });
        assert.ok(dots.length > 0, 'fixture includes visible folded outer branches');
        assert.ok(dots.every(d => d.insideScroller), 'complete folded ring stays inside the content clip');
        assert.ok(dots.every(d => d.clearOfRail), 'outer marker stays clear of the side control');
        // At 2x zoom some branches lie below the viewport; visibility is checked
        // separately from the geometry of those offscreen nodes below.
        const target = page.locator('[data-mm-content] > .node-list > .node > .bullet[aria-expanded="false"]').first();
        await target.scrollIntoViewIfNeeded();
        const element = await target.elementHandle();
        await target.locator('.bullet-dot').tap();
        assert.equal(await element.getAttribute('aria-expanded'), 'true', 'tap on a visible outer dot expands that branch');
        markers.push({ width, side, zoom, completeRing: true, tap: 'passed' });
        await show(side);
      }
    }
  }
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
  await page.setViewportSize({ width: 390, height: 606 });
  await show('front', 'iphone', 'welcome', 606);
  const answers = await page.evaluate(() => AnkiMindmap.current().inspect().state.revealed);
  const siblingIndex = await page.locator('.bullet').evaluateAll(bullets =>
    bullets.findIndex(b => b.getAttribute('aria-expanded') === 'false'));
  assert.ok(siblingIndex >= 0, 'fixture includes another closed branch');
  const sibling = page.locator('.bullet').nth(siblingIndex);
  const splitMetrics = [];
  for (const visualHeight of [681, 684, 606, 684]) {
    await sibling.evaluate(b => b.click());
    await page.setViewportSize({ width: 390, height: visualHeight }); await tick();
    await check(606);
    assert.deepEqual(await page.evaluate(() => AnkiMindmap.current().inspect().state.revealed), answers,
      'expanding other branches leaves current answers untouched');
    splitMetrics.push({ rootHeight: 606, visualHeight, seam: 303 });
  }
  await show('back', 'iphone', 'welcome', 606); await check(606);
  await page.evaluate(() => AnkiMindmap.current().dispatch({ type: 'zoom', value: 1.1 }));
  await check(606);
  await page.setViewportSize({ width: 390, height: 844 });
  await show('front', 'iphone', 'welcome', 844); await check(844);
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
  assert.deepEqual(await page.evaluate(() => ['--mm-layout-height','--mm-view-zoom'].map(
    name => document.querySelector('#mm-react').style.getPropertyValue(name))), ['', ''],
    'unmount removes card-owned viewport projections');
  await context.close();
  return { viewportAndTeardownOrder: rows, foldedMarkers: markers, splitHostMetrics: splitMetrics, constantViewportRevealFlipAndScroll: 'passed',
    zoomAndOrientation: 'passed', inlineCompensation: 'absent', disposal: 'passed',
    limitation: 'Mocked host-metric divergence follows user iOS readings. This adapter contract does not certify a physical iOS fix.' };
};
