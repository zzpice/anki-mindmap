const assert = require("node:assert/strict");

// Models AnkiDroid's full-document navigation and card.js window.onload reset.
// Source: AnkiDroid/src/main/assets/scripts/card.js (not device certification).
module.exports = async function navigation(browser, base, renders) {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
  let imageGate;
  await context.addInitScript(() => {
    window.mmPaints = [];
    const observe = () => {
      const host = document.querySelector("#mm-react");
      const active = host?.querySelector(".cloze");
      if (host && active && getComputedStyle(host).visibility !== "hidden") {
        const r = active.getBoundingClientRect();
        window.mmPaints.push({ loaded: !!window.mmHostLoaded, ready: !!host.dataset.ready,
          font: document.fonts.status, y: r.y, height: r.height, scroll: window.scrollY });
      }
      requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  });
  await context.route("**/android-slow.svg", async (route) => {
    if (imageGate) await imageGate;
    else await new Promise((resolve) => setTimeout(resolve, 180));
    await route.fulfill({ contentType: "image/svg+xml", body:
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" fill="green"/></svg>' });
  });
  await context.route("**/android-card?*", (route) => {
    const side = new URL(route.request().url()).searchParams.get("side");
    const content = renders.welcome[0][side].replace('<article data-mm-content>',
      '<article data-mm-content><img src="android-slow.svg">' +
      Array.from({ length: 25 }, (_, i) => `<p style="height:36px">前置阅读段落 ${i}</p>`).join(""));
    return route.fulfill({ contentType: "text/html; charset=utf-8", body:
      '<!doctype html><html class="mobile android"><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
      `<base href="${base}/"><script>window.onload=function(){window.scrollTo(0,0);window.mmHostLoaded=true;};</script>` +
      '</head><body class="card">' + content + '</body></html>' });
  });
  const page = await context.newPage();
  const rows = [];
  for (let i = 0; i < 10; i++) {
    await page.goto(`${base}/android-card?side=${i % 2 ? "back" : "front"}`);
    await page.waitForFunction(() => document.querySelector('#mm-react[data-mm-presented="true"]'));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const result = await page.evaluate(() => ({
      paints: window.mmPaints,
      resources: AnkiMindmap.current().inspect().resources,
      scrolls: AnkiMindmap.current().inspect().scrolls,
    }));
    assert.ok(result.paints.length > 0);
    assert.ok(result.paints.every((p) => p.loaded && p.ready && p.font === "loaded"),
      "raw tree or fallback font was visible before host load completed");
    assert.ok(result.paints.every((p) => p.y >= 0 && p.y + p.height <= 780),
      "tree was painted at the pre-location/reset position");
    assert.equal(result.scrolls, 1);
    assert.equal(result.resources.timers, 0);
    rows.push({ navigation: i, paintedFrames: result.paints.length, scrolls: result.scrolls });
  }
  const edgeTouch = await require("./edge-touch.cjs")(page);
  let releaseImage;
  imageGate = new Promise((resolve) => { releaseImage = resolve; });
  await page.goto(`${base}/android-card?side=front`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('#mm-react[data-ready="true"]', { state: "attached" });
  const disposed = await page.evaluate(async () => {
    const runtime = AnkiMindmap.current();
    document.querySelector("#mm-react").remove();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return runtime.inspect();
  });
  assert.equal(disposed.alive, false);
  assert.ok(Object.values(disposed.resources).every((value) => value === 0));
  releaseImage();
  await page.waitForLoadState("load");
  await context.close();
  return { navigations: rows.length, firstPaintPositionAndFont: "passed", pendingDisposal: "passed", edgeTouch, rows };
};
