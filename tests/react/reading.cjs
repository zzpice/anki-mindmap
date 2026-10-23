const assert = require("node:assert/strict");

module.exports = async function reading(browser, base, renders) {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
  const page = await context.newPage();
  await context.route("**/reading-card?*", route => {
    const params = new URL(route.request().url()).searchParams;
    const side = params.get("side"), index = Number(params.get("index") ?? 0);
    const html = renders.welcome[index][side].replace('<article data-mm-content>',
      '<article data-mm-content>' + '<p style="height:900px">前置知识</p>');
    return route.fulfill({ contentType: "text/html; charset=utf-8", body:
      '<!doctype html><html class="mobile android"><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
      `<base href="${base}/"><script>window.onload=()=>window.scrollTo(0,0)</script>` +
      '</head><body class="card">' + html + '</body></html>' });
  });
  const show = async (side, index = 0) => {
    await page.goto(`${base}/reading-card?side=${side}&index=${index}`);
    await page.waitForSelector('#mm-react[data-mm-presented="true"]');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  };
  await show("front");
  const direct = await page.evaluate(() => {
    const r = AnkiMindmap.current(), element = document.querySelector("[data-mm-content] .cloze");
    const before = element.getBoundingClientRect().top;
    const expanded = r.inspect().state.expanded;
    r.dispatch({ type: "toggleAnswer", id: "a0" });
    return { before, after: element.getBoundingClientRect().top,
      expandedUnchanged: JSON.stringify(expanded) === JSON.stringify(r.inspect().state.expanded) };
  });
  assert.ok(Math.abs(direct.before - direct.after) < 1, "reveal keeps clicked answer start steady");
  assert.ok(direct.expandedUnchanged);
  const before = await page.evaluate(async () => {
    const r = AnkiMindmap.current();
    r.dispatch({ type: "toggleTree" });
    r.dispatch({ type: "zoom", value: 1.1 });
    const row = document.querySelectorAll("[data-mm-content] .node > .content")[2];
    row.scrollIntoView({ block: "start" });
    window.scrollBy(0, -110);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { expanded: r.inspect().state.expanded, zoom: r.inspect().state.zoom,
      rowTop: row.getBoundingClientRect().top };
  });
  await show("back");
  const after = await page.evaluate(() => ({
    ...AnkiMindmap.current().inspect(),
    rowTop: document.querySelectorAll("[data-mm-content] .node > .content")[2].getBoundingClientRect().top,
  }));
  assert.deepEqual(after.state.expanded, before.expanded, "flip retains manual expansion");
  assert.equal(after.state.zoom, before.zoom);
  assert.ok(Math.abs(after.rowTop - before.rowTop) < 2, `flip reading row ${before.rowTop} -> ${after.rowTop}`);
  assert.equal(after.scrolls, 0, "restored back must not locate again");
  assert.ok(Object.values(after.state.revealed).every(Boolean), "native back reveals current answers");
  assert.ok(Object.values(after.state.groups).every(x => !x));
  assert.equal(after.state.overlay, null);
  await show("front");
  const next = await page.evaluate(() => AnkiMindmap.current().inspect());
  assert.equal(next.state.zoom, 1, "identical source new front still resets layout");
  assert.ok(Object.values(next.state.revealed).every(x => !x));
  assert.ok(Object.values(next.state.expanded).some(x => !x));
  await page.evaluate(() => AnkiMindmap.current().dispatch({ type: "toggleTree" }));
  await show("back", 1);
  assert.equal((await page.evaluate(() => AnkiMindmap.current().inspect())).scrolls, 1,
    "different native ordinal cannot consume layout");

  // Delayed content above the held answer is compensated; manual input cancels
  // that compensation immediately, including its observer and timer.
  await show("front");
  const late = await page.evaluate(async () => {
    const r = AnkiMindmap.current(), e = document.querySelector("[data-mm-content] .cloze");
    const spacer = document.querySelector("[data-mm-content] > p");
    const tick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    r.dispatch({ type: "toggleAnswer", id: "a0" });
    const top = e.getBoundingClientRect().top;
    spacer.style.height = "1100px";
    await tick();
    const held = e.getBoundingClientRect().top;
    document.dispatchEvent(new Event("wheel"));
    await tick();
    const resources = r.inspect().resources;
    r.dispatch({ type: "toggleAnswer", id: "a0" });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown" }));
    const keyboardCancelled = r.inspect().resources.timers === 0;
    window.oldReadingRuntime = r;
    return { top, held, resources, keyboardCancelled };
  });
  assert.ok(Math.abs(late.top - late.held) < 2, "late media/math-sized reflow preserves answer start");
  assert.equal(late.resources.timers, 0, "manual input cancels reading hold deadline");
  assert.ok(late.keyboardCancelled, "native keyboard scrolling also cancels the hold");
  const disposed = await page.evaluate(() => {
    AnkiMindmap.current().dispose();
    return oldReadingRuntime.inspect();
  });
  assert.ok(Object.values(disposed.resources).every(x => x === 0));
  await show("front");
  await page.evaluate(() => {
    AnkiMindmap.current().dispose();
    const key = "anki_mindmap.front-layout.v1";
    const saved = JSON.parse(sessionStorage.getItem(key));
    saved.time = 0;
    sessionStorage.setItem(key, JSON.stringify(saved));
  });
  await show("back");
  assert.equal((await page.evaluate(() => AnkiMindmap.current().inspect())).scrolls, 1,
    "expired layout falls back to a fresh presentation");
  await context.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw Error("storage unavailable"); } });
  });
  await show("front");
  await show("back");
  assert.equal((await page.evaluate(() => AnkiMindmap.current().inspect())).state.revealed.a0, true,
    "storage failure cannot block native review");
  await context.close();
  return { directReveal: "passed", fullNavigationFlip: "passed", identicalFrontReset: "passed",
    nativeOrdinalIsolation: "passed", lateLayoutAndManualCancellation: "passed", disposal: "passed",
    expiredAndUnavailableStorage: "passed" };
};
