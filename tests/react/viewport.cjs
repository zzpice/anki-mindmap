const assert = require("node:assert/strict");

// isMobile matters: narrow desktop viewports do NOT model Chromium's expanding
// layout viewport when an answer overflows. This reproduced 390 -> 1560 CSS px.
module.exports = async function viewport(browser, base, renders) {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 },
    isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    try {
      const theme = new URL(location.href).searchParams.get("theme") || "paper";
      localStorage.setItem("anki_mindmap.preferences.v1", JSON.stringify({ version: 1, theme }));
    } catch { /* about:blank has no storage origin */ }
  });
  let release, gate;
  await context.route(/_mm_react_.*\.js$/, async route => {
    if (gate) await gate;
    await route.continue();
  });
  await context.route("**/viewport-card?*", route => {
    const params = new URL(route.request().url()).searchParams;
    const side = params.get("side") || "front";
    return route.fulfill({ contentType: "text/html; charset=utf-8", body:
      '<!doctype html><html class="mobile android"><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
      `<base href="${base}/"><style>.card{background:white}</style><script>window.onload=()=>window.scrollTo(0,0)</script>` +
      `</head><body class="card ${params.get("night") === "1" ? "nightMode" : ""}">` +
      renders["wide-review"][0][side] + '</body></html>' });
  });
  const page = await context.newPage();
  const ready = () => page.waitForSelector('[data-mm-presented="true"]');
  const measure = () => page.evaluate(() => ({
    width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
    bars: [...document.querySelectorAll("nav button")].map(b => {
      const r = b.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  }));
  await page.goto(`${base}/viewport-card?side=front`);
  await ready();
  const before = await measure();
  await page.evaluate(() => AnkiMindmap.current().dispatch({ type: "toggleAnswer", id: "a0" }));
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const revealed = await measure();
  assert.deepEqual(revealed, before, "wide answer cannot resize viewport or fixed edge controls");
  const table = await page.evaluate(() => {
    const area = document.querySelector("[data-mm-content]");
    area.scrollLeft = area.scrollWidth;
    return { columns: area.querySelectorAll("td").length, scroll: area.scrollLeft,
      lastRight: area.querySelector("td:last-child").getBoundingClientRect().right,
      areaRight: area.getBoundingClientRect().right };
  });
  assert.equal(table.columns, 12);
  assert.ok(table.scroll > 100, "all wide content stays accessible by local horizontal scrolling");
  assert.ok(table.lastRight <= table.areaRight + 1, "last table column is reachable, not clipped away");
  await page.goto(`${base}/viewport-card?side=back`);
  await ready();
  assert.deepEqual(await measure(), before, "native back also keeps the same edge geometry");
  const paints = [];
  for (const [theme, night] of [["paper", false], ["bamboo", false], ["paper", true]]) {
    gate = new Promise(r => { release = r; });
    await page.goto(`${base}/viewport-card?side=front&theme=${theme}&night=${night ? 1 : 0}`, { waitUntil: "domcontentloaded" });
    const pending = await page.evaluate(() => ({ ready: !!document.querySelector("[data-ready]"),
      background: getComputedStyle(document.body).backgroundColor }));
    assert.equal(pending.ready, false);
    assert.equal(pending.background, night ? "rgb(36, 36, 36)" : theme === "bamboo"
      ? "rgb(240, 244, 232)" : "rgba(254, 251, 240, 0.7)");
    release(); gate = undefined;
    await ready();
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), pending.background,
      "runtime loading must not introduce a background-color flash");
    paints.push({ theme, night, background: pending.background });
  }
  await context.close();
  return { mobileViewport: "passed", width: before.width, edgeGeometry: "passed",
    wideColumnsReachable: table.columns, nativeBack: "passed", pendingBackgrounds: paints };
};
