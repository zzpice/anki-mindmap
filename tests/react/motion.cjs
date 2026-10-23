const assert = require('node:assert/strict');

// Engine evidence for mobile geometry/gestures; does not emulate WKWebView's
// native rubber-band compositor or certify AnkiMobile/AnkiDroid hardware.
module.exports = async function motion(browser, base, renders) {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 },
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await context.route('**/motion-card?*', route => {
    const side = new URL(route.request().url()).searchParams.get('side') || 'front';
    const html = renders['wide-review'][0][side].replace('<article data-mm-content>',
      '<article data-mm-content><p style="height:1000px">前置知识</p>');
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body:
      '<!doctype html><html class="mobile iphone"><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
      `<base href="${base}/"></head><body class="card">` + html + '</body></html>' });
  });
  const show = async side => {
    await page.goto(`${base}/motion-card?side=${side}`);
    await page.waitForSelector('#mm-react[data-ready="true"]');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  };
  const checkLabels = () => page.evaluate(() => [...document.querySelectorAll('nav button')].every(b => {
    const rect = b.getBoundingClientRect();
    const text = b.querySelector('.mm-edge-label > span').getBoundingClientRect();
    const left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
    return rect.left >= -.5 && rect.right <= innerWidth + .5 &&
      Math.abs(text.y + text.height / 2 - (rect.y + rect.height / 2)) < .6 &&
      Math.abs(text.x + text.width / 2 - (left + right) / 2) < .6;
  }));
  const geometry = () => page.evaluate(() => [...document.querySelectorAll('nav button')].map(b => {
    const r = b.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  }));
  await show('front');
  const before = await geometry();
  assert.ok(await checkLabels(), 'text centred in the visible half of every tab');
  for (const y of [0, 700, 150, 1200, 0]) {
    await page.evaluate(y => window.scrollTo(0, y), y);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    assert.deepEqual(await geometry(), before, 'edge frame remains fixed throughout scrolling');
    assert.ok(await checkLabels(), 'labels remain centred during scrolling');
  }
  await page.evaluate(() => AnkiMindmap.current().dispatch({ type: 'toggleAnswer', id: 'a0' }));
  assert.deepEqual(await geometry(), before, 'wide answer cannot stretch the shared frame');
  await page.evaluate(() => AnkiMindmap.current().dispatch({ type: 'zoom', value: 1.1 }));
  const zoomed = await geometry();
  assert.ok(await checkLabels(), 'labels centred after review zoom');
  assert.ok(zoomed.every(r => Math.abs(r[3] - 390) < 1), 'zoom does not stretch viewport frame');
  await show('back');
  assert.deepEqual(await geometry(), zoomed, 'native back shares front edge geometry and restored zoom');
  assert.ok(await checkLabels(), 'labels centred on native back');
  await page.setViewportSize({ width: 780, height: 390 });
  assert.ok((await geometry()).every(r => Math.abs(r[3] - 195) < 1), 'frame adapts to genuine resize');
  assert.ok(await checkLabels(), 'landscape labels remain centred');
  await page.setViewportSize({ width: 390, height: 780 });
  assert.deepEqual(await geometry(), zoomed);

  await page.goto(`${base}/welcome-0-front.html`);
  await page.waitForSelector('#mm-react[data-ready="true"]');
  await page.evaluate(() => document.fonts.ready);
  const controls = await geometry();
  await page.evaluate(() => AnkiMindmap.current().dispatch({ type: 'locate' }));
  const cue = await page.evaluate(() => {
    const c = document.querySelector('[data-mm-content]');
    return { resources: AnkiMindmap.current().inspect().resources,
      target: c.querySelector('.cloze').getAnimations().map(a => a.effect.getTiming().duration),
      content: getComputedStyle(c).transform,
      frame: getComputedStyle(document.querySelector('nav')).transform };
  });
  assert.equal(cue.resources.animations, 1);
  assert.deepEqual(cue.target, [560]);
  assert.equal(cue.content, 'none');
  assert.equal(cue.frame, 'none');
  assert.deepEqual(await geometry(), controls);
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => AnkiMindmap.current().inspect().resources.animations), 0);
  await page.getByRole('button', { name: '导图', exact: true }).tap();
  await page.getByRole('dialog').waitFor();
  const entry = await page.getByRole('dialog').evaluate(e => getComputedStyle(e).animationName);
  assert.equal(entry, 'mm-panel-enter');
  await page.locator('.mm-rich-overlay img').tap();
  assert.equal(await page.getByRole('dialog').count(), 1, 'diagram image cannot nest another viewer');
  await page.getByRole('button', { name: '关闭弹窗' }).tap();
  assert.equal(await page.getByRole('dialog').count(), 0, 'close is immediate, no exit wait');

  // Native zoom handlers need both touchend and compatibility click unconsumed.
  const gestures = await page.evaluate(() => {
    const r = AnkiMindmap.current();
    r.dispatch({ type: 'toggleTree' });
    const image = document.querySelector('[data-mm-content] img');
    const copy = image.cloneNode(true);
    document.querySelector('[data-mm-content] .cloze').append(copy);
    const commands = r.inspect().commands, revealed = JSON.stringify(r.inspect().state.revealed);
    const events = [];
    const touchEvent = (name, touches, changedTouches = []) => {
      const e = new Event(name, { bubbles: true, cancelable: true });
      Object.defineProperties(e, { touches: { value: touches }, changedTouches: { value: changedTouches } });
      return e;
    };
    for (const target of [image, copy]) {
      const touch = { identifier: 4, target, clientX: 50, clientY: 100 };
      target.dispatchEvent(touchEvent('touchstart', [touch]));
      const end = touchEvent('touchend', [], [touch]);
      target.dispatchEvent(end); events.push(!end.defaultPrevented);
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
      target.dispatchEvent(click); events.push(!click.defaultPrevented);
      const dbl = new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 });
      target.dispatchEvent(dbl); events.push(!dbl.defaultPrevented);
    }
    copy.remove();
    return { events, interrupts: r.inspect().commands - commands,
      answersUnchanged: JSON.stringify(r.inspect().state.revealed) === revealed, overlay: r.inspect().state.overlay };
  });
  assert.ok(gestures.events.every(Boolean));
  assert.equal(gestures.interrupts, 2, "only the two native touch-start interruptions dispatch commands");
  assert.ok(gestures.answersUnchanged);
  assert.equal(gestures.overlay, null);

  // A setting change cancels an already-running cue, not just the next cue.
  await page.evaluate(() => AnkiMindmap.current().dispatch({ type: 'locate' }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => AnkiMindmap.current().inspect().resources.animations === 0);
  await page.evaluate(() => AnkiMindmap.current().dispatch({ type: 'locate' }));
  assert.equal(await page.evaluate(() => AnkiMindmap.current().inspect().resources.animations), 0);
  await page.getByRole('button', { name: '导图', exact: true }).tap();
  assert.equal(await page.getByRole('dialog').evaluate(e => getComputedStyle(e).animationName), 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const disposed = await page.evaluate(() => {
    const r = AnkiMindmap.current();
    r.dispatch({ type: 'locate' });
    const c = document.querySelector('[data-mm-content]');
    r.dispose();
    return { resources: r.inspect().resources, animations: c.getAnimations({ subtree: true }).length };
  });
  assert.ok(Object.values(disposed.resources).every(x => x === 0));
  assert.equal(disposed.animations, 0, 'no navigation cue survives disposal');
  await context.close();
  return { labelCentres: 'passed: front/back, scroll, zoom, landscape', edgeFrameScrollFlipResize: 'passed', nativeImageGestures: 'passed',
    localPanelEntry: entry, navigationCue: '560ms; no geometry change',
    reducedMotion: 'passed including in-flight change', disposedAnimations: 0,
    limitation: 'native iOS scrolling compositor and client image zoom require physical retest' };
};
