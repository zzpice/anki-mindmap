const assert = require("node:assert/strict");

// Mobile-size browser evidence, not AnkiMobile/AnkiDroid device certification.
module.exports = async function transitions(browser, base, renders) {
  const results = [];
  for (const width of [360, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 780 }, hasTouch: true,
    });
    let bundles = 0;
    let pendingGate;
    const diagramRequests = [];
    context.on("request", (request) => {
      if (/_mm_react_.*\.js$/.test(request.url())) bundles++;
      if (request.url().includes("diagram-source")) diagramRequests.push(request.url());
    });
    // Amplify the initial load window; repeat flips must not fetch the bundle.
    await context.route(/_mm_react_.*\.js$/, async (route) => {
      if (pendingGate) await pendingGate;
      else await new Promise((resolve) => setTimeout(resolve, 120));
      await route.continue();
    });
    const page = await context.newPage();
    await page.goto(`${base}/welcome-0-front.html`);
    await page.waitForFunction(() => document.querySelector("#mm-react[data-ready]"));
    const baselineBundles = bundles;
    const result = await page.evaluate(async ({ front, back }) => {
      const area = document.createElement("div");
      document.body.append(area);
      // Keep a dedicated replacement region, just as reviewer hosts do.
      const visible = (element) => !!element?.getClientRects().length &&
        getComputedStyle(element).visibility !== "hidden";
      const rows = [];
      for (let i = 0; i < 40; i++) {
        const old = AnkiMindmap.current();
        const source = document.createElement("template");
        source.innerHTML = i % 2 ? front : back;
        const host = source.content.querySelector("#mm-react");
        const inactive = [...host.querySelectorAll("cloze2")]
          .find((element) => !element.closest(".cloze"));
        const image = document.createElement("img");
        image.src = "_mm_react_sample.svg?answer-image";
        image.dataset.transitionImage = "true";
        inactive.append(image);
        const diagram = host.querySelector("template[data-mm-diagram]");
        diagram.content.querySelector("img").src = "_mm_react_sample.svg?diagram-source";
        // Replace HTML before evaluating its inline scripts, exposing the
        // formerly unprotected raw-image interval on both front and back.
        document.querySelector("#mm-react").remove();
        area.replaceChildren(source.content);
        if (visible(image)) throw Error("inactive answer image visible before mount");
        if (host.querySelector("[data-mm-diagram] img")) throw Error("diagram source is live DOM");
        for (const original of area.querySelectorAll("script")) {
          const script = document.createElement("script");
          script.textContent = original.textContent;
          original.replaceWith(script);
        }
        const current = AnkiMindmap.current();
        if (!host.dataset.ready || !host.querySelector("[data-mm-ui] button"))
          throw Error("cached flip did not mount synchronously");
        if (current === old || old.inspect().alive ||
            Object.values(old.inspect().resources).some(Boolean))
          throw Error("previous card retained resources");
        if (visible(image)) throw Error("inactive answer image visible after mount");
        if (current.inspect().state.overlay !== null) throw Error("popup state leaked");
        if (current.inspect().resources.timers !== 0) throw Error("delayed flip timer retained");
        await new Promise(requestAnimationFrame);
        if (visible(image)) throw Error("inactive image flashed at paint boundary");
        rows.push({ side: current.inspect().side, scrolls: current.inspect().scrolls });
      }
      return rows;
    }, { front: renders.welcome[0].front, back: renders.welcome[0].back });
    assert.equal(bundles, baselineBundles, "flips must reuse the exact loaded bundle");
    assert.deepEqual(diagramRequests, [], "diagram images stay inert until opened");
    await page.getByRole("button", { name: "导图", exact: true }).click();
    await page.waitForFunction(() => {
      const image = document.querySelector("dialog img");
      return image?.complete && image.naturalWidth > 0;
    });
    assert.ok(diagramRequests.length, "diagram still loads when explicitly opened");
    await page.getByRole("button", { name: "关闭弹窗" }).click();
    // Failure and slow first-load paths must preserve native readable text.
    let release;
    pendingGate = new Promise((resolve) => { release = resolve; });
    const delayed = await context.newPage();
    await delayed.goto(`${base}/welcome-0-front.html`, { waitUntil: "commit" });
    await delayed.waitForFunction(() => document.querySelector("#mm-react") && !document.querySelector("#mm-react[data-ready]"));
    await delayed.evaluate((html) => {
      const source = document.createElement("template");
      source.innerHTML = html;
      document.querySelector("#mm-react").replaceWith(source.content.querySelector("#mm-react"));
      for (const original of source.content.querySelectorAll("script")) {
        const script = document.createElement("script");
        script.textContent = original.textContent;
        document.body.append(script);
      }
    }, renders.welcome[0].back);
    release();
    await delayed.waitForFunction(() => document.querySelector("#mm-react[data-ready]"));
    assert.equal(await delayed.evaluate(() => AnkiMindmap.current().inspect().side), "back");
    await context.route(/_mm_react_.*\.js$/, (route) => route.abort());
    const failed = await context.newPage();
    await failed.goto(`${base}/welcome-0-front.html`);
    await failed.waitForFunction(() => document.querySelector("#mm-react[data-mm-failed]"));
    assert.ok(await failed.evaluate(() => {
      const source = [...document.querySelectorAll("cloze2")]
        .find((element) => !element.closest(".cloze"));
      return source.getClientRects().length > 0 && source.textContent.length > 0;
    }), "failed local asset load keeps native source readable");
    await context.close();
    results.push({ width, flips: result.length, bundleLoadsDuringFlips: 0,
      hiddenImageFrames: "passed", pendingLoadHostReplacement: "passed" });
  }
  return results;
};
