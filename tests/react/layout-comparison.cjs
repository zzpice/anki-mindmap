// Same official native cards, pinned main and current React, one host per kind.
// The probe is diagnostic-only and cannot write application layout or commands.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '../..'), site = path.join(root, 'build/layout-comparison');
const renders = JSON.parse(fs.readFileSync(path.join(site, 'renders.json')));
const native = JSON.parse(fs.readFileSync(path.join(root, 'build/anki-web.json')));
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname;
  if (pathname === '/card') {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html class="mobile iphone"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"><base href="/assets/">' +
      '<link rel="stylesheet" href="/native/css/reviewer.css"></head><body class="card"><div id="qa"></div>' +
      '<script>window.bridgeCommand=()=>{}</script><script src="/native/js/vendor/jquery.min.js"></script>' +
      '<script src="/native/js/reviewer.js"></script></body></html>'); return;
  }
  const directory = pathname.startsWith('/assets/') ? site : native;
  const file = path.join(directory, decodeURIComponent(pathname.replace(/^\/(assets|native|_anki)\//, '')));
  if (!file.startsWith(directory + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader('content-type', { '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf',
    '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
const result = { status: 'running', engines: [], externalRequests: [],
  limitation: 'Browser host only. Native iOS measurements are pending; no fix certification.' };
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const kind of ['main', 'react']) {
        const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
        await context.route('**/*', route => {
          if (route.request().url().startsWith(base)) return route.continue();
          result.externalRequests.push(route.request().url()); return route.abort();
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        const tick = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        const show = async (side, key = 'overview') => {
          await page.evaluate(async html => {
            await _updateQA(html, null, () => {}, () => {});
          }, renders[`${kind}-${key}`][0][side]);
          if (kind === 'react') await page.waitForSelector('#mm-react[data-ready]');
          await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
          }); await tick();
        };
        const measure = () => page.evaluate(() => {
          const r = document.querySelector('.floating-button').getBoundingClientRect();
          return { height: innerHeight, seam: r.top, length: r.height };
        });
        await page.goto(base+'/card');
        await show('front'); const front = await measure();
        if (name === 'webkit') await page.screenshot({ path: path.join(site, `${kind}-front.png`) });
        await show('back'); const back = await measure();
        assert.deepEqual(back, front, 'same card/viewport: native face update keeps the baseline edge geometry');
        if (name === 'webkit') await page.screenshot({ path: path.join(site, `${kind}-back.png`) });
        await page.getByRole('button', { name: '布局数据', exact: true }).click();
        const readout = await page.locator('[data-mm-layout-probe] pre').textContent();
        const diagnostic = JSON.parse(readout);
        assert.ok(diagnostic.front?.length, 'diagnostic retains original front measurements across host replacement');
        assert.equal(diagnostic.current.side, 'back');
        assert.equal(diagnostic.current.rows.at(-1).locate[0], back.seam);
        const orders = [];
        for (const order of ['before-removal', 'after-removal']) {
          await page.setViewportSize({ width: 390, height: 780 }); await show('front');
          if (order === 'before-removal') await page.setViewportSize({ width: 390, height: 844 });
          await page.evaluate(() => document.querySelector('#qa').replaceChildren());
          if (order === 'after-removal') await page.setViewportSize({ width: 390, height: 844 });
          await show('back'); const resized = await measure();
          assert.equal(resized.seam, 422); assert.equal(resized.length, 422);
          orders.push({ order, ...resized });
        }
        const cases = [];
        for (const key of Object.keys(renders).filter(k => k.startsWith(kind+'-')).map(k => k.slice(kind.length+1))) {
          await page.setViewportSize({ width: 390, height: 780 });
          const faces = {};
          for (const side of ['front', 'back']) {
            await show(side, key);
            const capture = await page.evaluate(() => ({
              width: innerWidth, height: innerHeight,
              documentHeight: document.documentElement.scrollHeight,
              current: JSON.parse(document.querySelector('[data-mm-layout-probe] pre').textContent).current,
              images: [...document.querySelectorAll('[data-mm-content] img,.linkRender img')]
                .filter(i => i.getClientRects().length).map(i => i.complete && i.naturalWidth > 0),
              longImages: [...document.querySelectorAll('[data-mm-long-image]')].map(i => ({
                loaded: i.complete && i.naturalWidth === 720 && i.naturalHeight === 8400,
                height: i.getBoundingClientRect().height,
              })),
            }));
            assert.equal(capture.current.side, side);
            assert.equal(capture.current.kind, kind);
            assert.ok(capture.images.every(Boolean));
            const baseline = await measure();
            const scrolls = [];
            if (key.startsWith('long-')) {
              if (side === 'back' || key !== 'long-image-answer') {
                assert.ok(capture.longImages.length > 0 && capture.longImages.every(i => i.loaded && i.height > 2300),
                  `${name} ${kind} ${key} ${side}: actual rendered long PNG exceeds three phone screens: ${JSON.stringify(capture.longImages)}`);
                assert.ok(capture.documentHeight > capture.height*3, 'fixture really creates a long page');
              }
              for (const part of [0, .5, 1]) {
                const y = await page.evaluate(part => {
                  window.scrollTo(0, (document.documentElement.scrollHeight-innerHeight)*part);
                  return scrollY;
                }, part); await tick();
                assert.deepEqual(await measure(), baseline, 'long-page scrolling keeps browser edge geometry at a constant viewport');
                scrolls.push({part, y});
                if (name==='webkit' && key==='long-image-visible' && side==='front' && part===.5)
                  await page.screenshot({path:path.join(site, `${kind}-long-middle.png`)});
              }
            }
            faces[side] = { width: capture.width, height: capture.height, documentHeight: capture.documentHeight,
              longImages: capture.longImages, bars: baseline, scrolls };
          }
          let tapReveal;
          if (kind === 'react' && key === 'long-image-answer') {
            await show('front', key);
            const baseline = await measure();
            const cloze = page.locator('[data-mm-content] .cloze').first();
            await cloze.tap();
            await page.waitForSelector('[data-mm-long-image="B"]');
            await page.evaluate(async () => {
              await document.querySelector('[data-mm-long-image="B"]').decode();
            }); await tick();
            const revealed = await page.evaluate(() => ({
              documentHeight: document.documentElement.scrollHeight,
              imageHeight: document.querySelector('[data-mm-long-image="B"]').getBoundingClientRect().height,
            }));
            assert.ok(revealed.imageHeight > 2300, 'tapping the current Cloze reveals a real long image');
            assert.ok(revealed.documentHeight > faces.front.documentHeight + 2300, 'revealing the image grows the actual page');
            assert.deepEqual(await measure(), baseline, 'revealing the image keeps browser edge geometry');
            // Tap the text at the beginning of the revealed answer, not the
            // image (which belongs to the native Anki image viewer).
            await cloze.tap({ position: { x: 8, y: 8 } }); await tick();
            assert.equal(await cloze.getAttribute('data-mm-revealed'), 'false');
            assert.equal(await page.locator('[data-mm-long-image="B"]').count(), 0);
            assert.deepEqual(await measure(), baseline, 'hiding the long answer keeps browser edge geometry');
            tapReveal = { status: 'passed', ...revealed, hiddenAgain: true };
          }
          cases.push({ key, faces, ...(tapReveal ? { tapReveal } : {}) });
        }
        await page.evaluate(() => sessionStorage.clear());
        await show('back');
        assert.match(await page.locator('[data-mm-layout-probe] output').textContent(), /正面：未取得/,
          'missing front measurements must be reported, not replaced with back geometry');
        assert.deepEqual(errors, [], 'native comparison has no script errors');
        result.engines.push({ engine: name, kind, front, back, orders, cases, probeFrontBack: 'passed' });
        await context.close();
      }
    } finally { await browser.close(); }
  }
  assert.deepEqual(result.externalRequests, []);
  result.status = 'passed';
})().catch(e => { result.status='failed'; result.error=e.stack; process.exitCode=1; }).finally(() => {
  fs.writeFileSync(path.join(root, 'build/layout-comparison-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({status:result.status, comparisons:result.engines.length, error:result.error}));
  server.close();
});
