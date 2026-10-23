const { chromium, webkit } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  os = require("node:os"),
  assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const ROOT = path.resolve(__dirname, "../.."),
  site = path.join(ROOT, "build/react-site");
const renders = JSON.parse(
  fs.readFileSync(path.join(ROOT, "build/react-renders.json")),
);
const result = { status: "running", engines: [], externalRequests: [] };
const activeBrowsers = [];
const server = http.createServer((req, res) => {
  const p = path.join(site, new URL(req.url, "http://local").pathname);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader(
    "Content-Type",
    p.endsWith(".js")
      ? "text/javascript; charset=utf-8"
      : p.endsWith(".css")
        ? "text/css"
        : p.endsWith(".svg")
          ? "image/svg+xml"
          : "text/html; charset=utf-8",
  );
  res.end(fs.readFileSync(p));
});
const inspect = (p) => p.evaluate(() => AnkiMindmap.current()?.inspect());
const ready = (p) =>
  p.waitForFunction(() =>
    document.querySelector("#mm-react[data-ready=true] [data-mm-ui] button"),
  );
async function run() {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [name, engine] of [
    ["chromium", chromium],
    ["webkit", webkit],
  ]) {
    const browser = await engine.launch({ headless: true });
    activeBrowsers.push(browser);
    const context = await browser.newContext();
    const page = await context.newPage();
    const record = {
      name,
      version: browser.version(),
      fixtures: 0,
      checks: [],
      errors: [],
    };
    result.engines.push(record);
    page.on("pageerror", (e) => record.errors.push(e.message));
    page.on("request", (r) => {
      if (/^https?:/.test(r.url()) && !r.url().startsWith(base))
        result.externalRequests.push(r.url());
    });
    for (const [key, cards] of Object.entries(renders))
      for (let i = 0; i < cards.length; i++)
        for (const side of ["front", "back"]) {
          await page.goto(`${base}/${key}-${i}-${side}.html`);
          await ready(page);
          const info = await inspect(page);
          assert.ok(
            Object.values(info.state.revealed).every(
              (x) => x === (side === "back"),
            ),
            `${key} initial answers`,
          );
          if (side === "front")
            await page.evaluate(() => {
              const r = AnkiMindmap.current();
              for (const id of Object.keys(r.inspect().state.revealed))
                r.dispatch({ type: "toggleAnswer", id });
            });
          if (key === "nested-custom")
            assert.match(
              await page
                .locator("[data-mm-content] .cloze")
                .first()
                .textContent(),
              /PREFIX.*INNER.*SUFFIX/,
            );
          if ((key === "reading" && i === 0) || key === "empty")
            assert.ok(
              (await inspect(page)).state.revealed.a0 !== undefined,
              "field-only native current must remain usable without popup",
            );
          if (key === "rich") {
            const s = await page.evaluate(() => {
              const c = document.querySelector("[data-mm-content]");
              return {
                text: c.textContent,
                imgs: [...c.querySelectorAll("img")].map((x) =>
                  x.getAttribute("src"),
                ),
                math: [...c.querySelectorAll("math,math *")].map(
                  (x) => x.namespaceURI,
                ),
                cells: [...c.querySelectorAll("td,th")].map((x) => [
                  x.getAttribute("rowspan"),
                  x.getAttribute("colspan"),
                ]),
                opaque: c.querySelector("x-legacy")?.outerHTML,
              };
            });
            assert.match(s.text, /富文本答案/);
            assert.match(s.text, /正常后续文字/);
            assert.match(s.text, /未知内容保留/);
            assert.equal(s.imgs.length, 1);
            assert.equal(s.cells[0][1], "2");
            assert.equal(s.cells[1][0], "2");
            assert.ok(
              s.math.every((x) => x === "http://www.w3.org/1998/Math/MathML"),
            );
            assert.match(s.opaque, /data-example="opaque"/);
          }
          record.fixtures++;
        }
    record.checks.push(
      "all native fixture sides, rich semantic fidelity, gapped/nested/custom cloze, field-only current fallback",
    );
    await page.goto(`${base}/mixed-0-front.html`);
    await ready(page);
    const hostReset = await page.evaluate(async () => {
      const before = AnkiMindmap.current().inspect().state;
      document.body.className = "card nightMode";
      await new Promise(requestAnimationFrame);
      return {
        before,
        after: AnkiMindmap.current().inspect().state,
        font: getComputedStyle(document.body).fontFamily,
        classes: document.body.className,
      };
    });
    assert.deepEqual(hostReset.before, hostReset.after);
    assert.ok(
      hostReset.classes.includes("nightMode") &&
        hostReset.classes.includes("mm-review"),
    );
    assert.match(hostReset.font, /lxgw/);
    record.checks.push(
      "native reviewer body-class reset preserves skin and host night mode without changing business state",
    );
    record.reading = await require("./reading.cjs")(browser, base, renders);
    record.transitions = await require("./transitions.cjs")(browser, base, renders);
    record.androidNavigation = await require("./navigation.cjs")(browser, base, renders);
    record.checks.push("mobile-size flip first-paint image guards, inert diagrams, cached runtime and pending-load replacement");
    const invariants = await page.evaluate(() => {
      const r = AnkiMindmap.current();
      r.dispatch({ type: "toggleAnswer", id: "a0" });
      const before = r.inspect().state;
      r.dispatch({ type: "toggleNode", id: "n0" });
      const folded = r.inspect().state;
      r.dispatch({ type: "locate" });
      return { before, folded, located: r.inspect().state };
    });
    assert.deepEqual(invariants.before.revealed, invariants.folded.revealed);
    assert.equal(invariants.before.revealed.a1, false);
    assert.equal(invariants.located.expanded.n0, true);
    await page.getByRole("button", { name: "揭示其他", exact: true }).click();
    assert.equal((await inspect(page)).state.revealed.a0, true);
    assert.ok(Object.values((await inspect(page)).state.groups).every(Boolean));
    record.checks.push(
      "fold/reveal independence; same-number occurrences independent; other groups exclude current; locate opens path",
    );

    await page.goto(`${base}/welcome-0-front.html`);
    await ready(page);
    await page.getByRole("button", { name: "搜索", exact: true }).click();
    const search = page.getByRole("textbox", { name: "搜索正文" });
    await search.fill("前提能够支持结论");
    assert.equal(
      (await inspect(page)).state.matches.length,
      0,
      "hidden current answer must not leak via search",
    );
    const answersBefore = (await inspect(page)).state.revealed;
    await search.fill("必要条件");
    assert.ok((await inspect(page)).state.matches.length > 0);
    assert.deepEqual((await inspect(page)).state.revealed, answersBefore);
    const searchLayout = await inspect(page);
    assert.ok(Object.keys(searchLayout.state.searchExpanded).length > 0);
    const changed = await page.evaluate(() => {
      const r = AnkiMindmap.current(),
        id = Object.keys(r.inspect().state.searchExpanded)[0];
      r.dispatch({ type: "toggleNode", id });
      r.dispatch({ type: "closeSearch" });
      return { id, state: r.inspect().state };
    });
    assert.equal(changed.state.expanded[changed.id], false);
    record.checks.push(
      "search excludes hidden answers, finds folded prose, leaves reveal untouched; closing respects later manual fold",
    );
    await page.getByRole("button", { name: "导图", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    assert.match(await page.getByRole("dialog").textContent(), /复习路线/);
    await page.getByRole("button", { name: "关闭弹窗" }).click();
    await page.locator('a[href="#_msocom_1"]').click();
    await page.getByRole("dialog").waitFor();
    assert.match(await page.getByRole("dialog").textContent(), /测试批注/);
    await page.getByRole("button", { name: "关闭弹窗" }).click();
    await page.getByRole("button", { name: "展开分支", exact: true }).click();
    await page.locator("[data-mm-content] img").first().click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "关闭弹窗" }).click();
    assert.equal(
      await page.getByRole("button", { name: "填写笔记", exact: true }).count(),
      0,
    );
    record.checks.push(
      "diagram, annotation and image overlays; personal-note popup absent",
    );

    await page.goto(`${base}/mixed-0-front.html`);
    await ready(page);
    await page.locator("[data-mm-content]").click({ position: { x: 1, y: 1 } });
    await page.keyboard.press("]");
    assert.equal((await inspect(page)).state.revealed.a0, true);
    await page.keyboard.press("]");
    assert.equal((await inspect(page)).state.revealed.a1, true);
    await page.keyboard.press("[");
    assert.equal((await inspect(page)).state.revealed.a1, false);
    await page.keyboard.press("ControlOrMeta+f");
    await page.getByRole("textbox", { name: "搜索正文" }).fill("c");
    const theme = (await inspect(page)).state.theme;
    await page.keyboard.press("c");
    assert.equal((await inspect(page)).state.theme, theme);
    await page.keyboard.press("Escape");
    record.checks.push(
      "ordered reveal/reverse hide keyboard, native host keys unclaimed, editable search protects single-letter shortcuts",
    );
    const touch = await browser.newContext({ hasTouch: true });
    const tp = await touch.newPage();
    await tp.goto(`${base}/mixed-0-front.html`);
    await ready(tp);
    await tp.locator("[data-mm-content] .cloze").first().tap();
    assert.equal((await inspect(tp)).state.revealed.a0, true);
    await tp.goto(`${base}/welcome-0-front.html`);
    await ready(tp);
    await require("./touch.cjs")(tp);
    await tp.close();
    await touch.close();
    record.checks.push("touch tap dispatches once; branch touchend works without click, compatibility click deduplicates, scroll/pinch/cancel are inert, focused keyboard works");

    await page.goto(`${base}/mixed-0-front.html`);
    await ready(page);
    const unicode = await page.evaluate(() => {
      const p = document.createElement("p");
      p.textContent = "İSTANBUL 与 Unicode 🧠";
      document.querySelector("[data-mm-content]").append(p);
      const runtime = AnkiMindmap.current();
      runtime.dispatch({ type: "search", query: "İstanbul" });
      return runtime.inspect().state.matches.length;
    });
    assert.equal(unicode, 1);
    record.checks.push(
      "Unicode case expansion keeps source text range offsets valid",
    );
    const gc = await browser.newContext();
    await gc.addInitScript(() => {
      window.mmTestPads = [];
      Object.defineProperty(navigator, "getGamepads", {
        value: () => window.mmTestPads,
      });
    });
    const gp = await gc.newPage();
    await gp.goto(`${base}/mixed-0-front.html`);
    await ready(gp);
    assert.equal((await inspect(gp)).resources.frames, 0);
    await gp.evaluate(() => {
      window.mmTestPads = [
        {
          index: 0,
          id: "controller-one",
          buttons: Array.from({ length: 12 }, () => ({
            pressed: false,
            value: 0,
          })),
          axes: [0, 0, 0, 0],
        },
      ];
      window.dispatchEvent(new Event("gamepadconnected"));
    });
    await gp.waitForTimeout(40);
    await gp.evaluate(() => {
      window.mmTestPads[0].buttons[5].pressed = true;
    });
    await gp.waitForFunction(
      () => AnkiMindmap.current().inspect().state.revealed.a0,
    );
    await gp.evaluate(() =>
      AnkiMindmap.mount(document.querySelector("#mm-react")),
    );
    await gp.waitForTimeout(60);
    assert.equal(
      (await inspect(gp)).state.revealed.a0,
      false,
      "held button cannot retrigger after remount",
    );
    await gp.evaluate(() => {
      window.mmTestPads[0].buttons[5].pressed = false;
    });
    await gp.waitForTimeout(40);
    await gp.evaluate(() => {
      window.mmTestPads[0].buttons[5].pressed = true;
    });
    await gp.waitForFunction(
      () => AnkiMindmap.current().inspect().state.revealed.a0,
    );
    await gp.evaluate(() => {
      window.mmTestPads = [];
      window.dispatchEvent(new Event("gamepaddisconnected"));
    });
    await gp.waitForTimeout(60);
    assert.equal((await inspect(gp)).resources.frames, 0);
    const hostContext = await browser.newContext({
      userAgent: "Mozilla/5.0 QtWebEngine/6.11 mock host",
    });
    await hostContext.addInitScript(() => {
      window.mmCalls = [];
      window.pycmd = (command) => {
        window.mmCalls.push(command);
        if (window.mmDisposeOnNative) {
          window.mmLastRuntime = AnkiMindmap.current();
          window.mmLastRuntime.dispose();
        }
      };
      window.mmPads = [
        {
          index: 0,
          id: "desktop-controller",
          buttons: Array.from({ length: 12 }, () => ({
            pressed: false,
            value: 0,
          })),
          axes: [0, 0, 0, 0],
        },
      ];
      Object.defineProperty(navigator, "getGamepads", {
        value: () => window.mmPads,
      });
    });
    const hp = await hostContext.newPage();
    await hp.goto(`${base}/mixed-0-back.html`);
    await ready(hp);
    await hp.evaluate(() => {
      window.mmPads[0].buttons[1].pressed = true;
    });
    await hp.waitForFunction(() => window.mmCalls.length === 1);
    assert.equal(await hp.evaluate(() => window.mmCalls[0]), "ease3");
    await hp.evaluate(() =>
      AnkiMindmap.mount(document.querySelector("#mm-react")),
    );
    await hp.waitForTimeout(60);
    assert.equal(await hp.evaluate(() => window.mmCalls.length), 1);
    await hp.evaluate(() => {
      window.mmPads[0].buttons[1].pressed = false;
    });
    await hp.waitForTimeout(40);
    await hp.evaluate(() => {
      window.mmDisposeOnNative = true;
      window.mmPads[0].buttons[2].pressed = true;
    });
    await hp.waitForFunction(() => window.mmCalls.length === 2);
    assert.equal(await hp.evaluate(() => window.mmCalls[1]), "ease2");
    assert.ok(
      await hp.evaluate(() =>
        Object.values(window.mmLastRuntime.inspect().resources).every(
          (x) => !x,
        ),
      ),
      "sync native disposal cannot register a new RAF or timer",
    );
    await hostContext.close();
    record.checks.push(
      "mock Desktop controller preserves original B=Good/X=Hard and held-button safety",
    );
    await gc.close();
    record.checks.push(
      "mock controller connect/edge/held remount/disconnect, no idle polling without hardware",
    );

    await page.goto(`${base}/rich-0-front.html`);
    await ready(page);
    assert.ok(
      await page.evaluate(async () => {
        const c = document.querySelector("[data-mm-content]"),
          nodes = [
            c,
            c.querySelector("table"),
            c.querySelector("math"),
            c.querySelector("x-legacy"),
          ],
          html = c.innerHTML;
        for (let i = 0; i < 20; i++)
          AnkiMindmap.current().dispatch({
            type: "theme",
            value: i % 2 ? "paper" : "bamboo",
          });
        await new Promise((r) => setTimeout(r, 20));
        return c.innerHTML === html && nodes.every((n) => n.isConnected);
      }),
    );
    record.checks.push("20 React updates preserve rich DOM identity and HTML");
    const stress = await page.evaluate(
      async ({ front, back, script }) => {
        const pause = () => new Promise((r) => setTimeout(r, 0));
        async function show(html) {
          const wrapper = document.createElement("div");
          wrapper.innerHTML = html;
          const host = wrapper.querySelector("#mm-react");
          document.querySelector("#mm-react")?.remove();
          document.body.append(host);
          AnkiMindmap.mount(host);
          await pause();
          return AnkiMindmap.current();
        }
        const rows = [];
        for (let i = 0; i < 100; i++) {
          let r = await show(front);
          const old = r;
          r.dispatch({ type: "toggleAnswer", id: "a0" });
          r = await show(back);
          if (!Object.values(r.inspect().state.revealed).every(Boolean))
            throw Error("back initial");
          r = await show(front);
          if (Object.values(r.inspect().state.revealed).some(Boolean))
            throw Error("next leaked");
          if (i % 10 === 0) {
            const s = document.createElement("script");
            s.src = script;
            await new Promise((res, rej) => {
              s.onload = res;
              s.onerror = rej;
              document.body.append(s);
            });
          }
          AnkiMindmap.mount(document.querySelector("#mm-react"));
          r = AnkiMindmap.current();
          r.dispatch({ type: "revealNext" });
          if (!r.inspect().state.revealed.a0) throw Error("one action");
          const before = JSON.stringify(old.inspect().state);
          old.dispatch({ type: "toggleAnswer", id: "a0" });
          if (JSON.stringify(old.inspect().state) !== before)
            throw Error("stale command");
          document.querySelector("#mm-react").remove();
          await pause();
          r.dispose();
          r.dispose();
          if (
            document.body.classList.contains("mm-review") ||
            document.documentElement.classList.contains("mm-review-document") ||
            document.body.hasAttribute("data-mm-theme")
          )
            throw Error("card skin leaked into next note type");
          for (const instance of [old, r])
            if (
              instance.inspect().alive ||
              Object.values(instance.inspect().resources).some(Boolean)
            )
              throw Error("owned resources retained");
          rows.push(r.inspect().resources);
        }
        await new Promise((r) => setTimeout(r, 120));
        return rows;
      },
      {
        front: renders.mixed[0].front,
        back: renders.mixed[0].back,
        script: Object.keys(
          JSON.parse(
            fs.readFileSync(path.join(ROOT, "dist/react-test-manifest.json")),
          ).assets,
        ).find((x) => x.endsWith(".js")),
      },
    );
    assert.equal(stress.length, 100);
    record.lifecycle = stress;
    record.checks.push(
      "100 front/back/next cycles, duplicate bundle execution, same-root mount, host replacement, zero owned resources on dispose",
    );
    await page.goto(`${base}/three-level-0-front.html`);
    await ready(page);
    const cancelled = await page.evaluate(async () => {
      const r = AnkiMindmap.mount(document.querySelector("#mm-react"));
      document.dispatchEvent(new Event("wheel"));
      const n = r.inspect().scrolls;
      await new Promise((x) => setTimeout(x, 160));
      return r.inspect().scrolls === n;
    });
    assert.ok(cancelled);
    record.checks.push("manual wheel cancels automatic navigation");
    const detached = fs.mkdtempSync(
      path.join(os.tmpdir(), "mm-react-offline-"),
    );
    fs.cpSync(site, detached, { recursive: true });
    if (name === "chromium") await context.setOffline(true);
    else await context.route(/^https?:/, (r) => r.abort());
    await page.goto(
      pathToFileURL(path.join(detached, "mixed-0-front.html")).href,
    );
    await ready(page);
    await page.getByRole("button", { name: "搜索", exact: true }).click();
    await page.getByRole("button", { name: "揭示下一处", exact: true }).click();
    assert.equal((await inspect(page)).state.revealed.a0, true);
    if (name === "chromium") await context.setOffline(false);
    else await context.unroute(/^https?:/);
    fs.rmSync(detached, { recursive: true });
    record.checks.push(
      name === "chromium"
        ? "offline emulation + detached file assets"
        : "detached file assets with all HTTP(S) blocked; WebKit offline emulator limitation retained",
    );
    assert.deepEqual(record.errors, []);
    await browser.close();
  }
  assert.deepEqual(result.externalRequests, []);
  result.status = "passed";
}
run()
  .catch((e) => {
    result.status = "failed";
    result.error = e.stack;
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled(activeBrowsers.map(browser => browser.close()));
    fs.writeFileSync(
      path.join(ROOT, "build/browser-results.json"),
      JSON.stringify(result, null, 2),
    );
    server.close();
    console.log(
      JSON.stringify({
        status: result.status,
        engines: result.engines.map((x) => ({
          name: x.name,
          fixtures: x.fixtures,
          cycles: x.lifecycle?.length,
          checks: x.checks.length,
        })),
        error: result.error,
      }),
    );
  });
