/** Compare identical official native Cloze output with main f67c932 and React.
 * Original runtime is a fixture only, never an application dependency.
 * Prepare fixtures with scripts/prepare_visual_comparison.py (official Anki/aqt).
 */
const { chromium, webkit } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../.."),
  out = path.join(root, "build/visual-comparison");
const original = JSON.parse(
    fs.readFileSync(path.join(root, "build/original-renders.json")),
  ),
  react = JSON.parse(
    fs.readFileSync(path.join(root, "build/react-renders.json")),
  );
const native = JSON.parse(
  fs.readFileSync(path.join(root, "build/anki-web.json")),
);
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://local").pathname;
  if (url === "/card") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/original/"><link rel="stylesheet" href="/native/css/reviewer.css"></head><body class="card"><div id="qa"></div><script>window.bridgeCommand=()=>{}</script><script src="/native/js/vendor/jquery.min.js"></script><script src="/native/js/reviewer.js"></script></body></html>',
    );
    return;
  }
  const prefix = url.startsWith("/_anki/")
    ? "/_anki/"
    : url.startsWith("/native/")
      ? "/native/"
      : url.startsWith("/original/")
        ? "/original/"
        : "/react/";
  const dir =
    prefix === "/native/" || prefix === "/_anki/"
      ? native
      : path.join(
          root,
          "build",
          prefix === "/original/" ? "original-site" : "react-site",
        );
  const file = path.join(dir, decodeURIComponent(url.slice(prefix.length)));
  if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader(
    "Content-Type",
    {
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".ttf": "font/ttf",
    }[path.extname(file)] || "application/octet-stream",
  );
  res.end(fs.readFileSync(file));
});
const metrics = () => {
  const content = document.querySelector("[data-mm-content],.linkRender");
  const style = (e) => {
    if (!e) return null;
    const s = getComputedStyle(e),
      r = e.getBoundingClientRect();
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      font: s.fontFamily,
      size: s.fontSize,
      line: s.lineHeight,
      color: s.color,
      bg: s.backgroundColor,
      border: s.border,
      radius: s.borderRadius,
      padding: s.padding,
      margin: s.margin,
      shadow: s.boxShadow,
      display: s.display,
    };
  };
  return {
    typeset: content.querySelectorAll("mjx-container").length,
    body: style(document.body),
    title: style(content.querySelector(".title")),
    nodes: [...content.querySelectorAll(".node")]
      .filter((x) => x.getBoundingClientRect().height)
      .map((x) => style(x.querySelector(":scope>.content"))),
    clozes: [...content.querySelectorAll(".cloze")].map(style),
    bullet: style(content.querySelector(".bullet-dot")),
    floating: style(document.querySelector(".floating")),
    treeButton: style(document.querySelector(".custom2-button")),
    connector: getComputedStyle(content.querySelector(".children"), "::before")
      .backgroundImage,
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    fontReady: document.fonts.check("16px lxgw"),
  };
};
async function show(page, base, kind, key, side, theme, mode) {
  await page.goto(base + "/card");
  await page.evaluate(
    ({ theme, mode }) => {
      localStorage.clear();
      localStorage.setItem(
        "anki_cfg_cardTheme",
        JSON.stringify(theme === "bamboo" ? "2" : "1"),
      );
      localStorage.setItem(
        "anki_mindmap.preferences.v1",
        JSON.stringify({ version: 1, theme }),
      );
      document.body.classList.toggle("nightMode", mode === "night");
    },
    { theme, mode },
  );
  await page.evaluate(
    async ({ html, kind }) => {
      document.querySelector("base").href =
        "/" + (kind === "main" ? "original" : "react") + "/";
      await _updateQA(
        html,
        null,
        () => {
          document.body.className = document.body.classList.contains(
            "nightMode",
          )
            ? "card nightMode"
            : "card";
        },
        () => {},
      );
    },
    { html: (kind === "main" ? original : react)[key][0][side], kind },
  );
  if (kind === "react")
    await page.waitForSelector('#mm-react[data-ready="true"]');
  // main initializes several controls in document.ready; allow its original locate task.
  await page.waitForTimeout(350);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((i) => i.decode().catch(() => {})),
    );
  });
}
async function captureInteractions(page, base, engine, out) {
  const records = [];
  for (const [device, viewport] of Object.entries({
    desktop: { width: 1280, height: 900 },
    phone: { width: 390, height: 844 },
    narrow: { width: 320, height: 700 },
  })) {
    await page.setViewportSize(viewport);
    for (const side of ["front", "back"])
      for (const stage of [
        "expanded",
        "others",
        "search",
        "diagram",
        "annotation",
      ]) {
        const pair = { engine, device, side, stage };
        for (const kind of ["main", "react"]) {
          await show(page, base, kind, "welcome", side, "paper", "day");
          if (stage === "expanded" || stage === "others")
            await page.locator(".custom2-button").click();
          if (stage === "others") await page.locator(".custom-button").click();
          if (stage === "search") await page.locator(".floating").click();
          if (stage === "diagram")
            await page.locator("#left-floating-widget").click();
          if (stage === "annotation")
            await page.locator('a[href="#_msocom_1"]').click();
          await page.waitForTimeout(40);
          pair[kind] = await page.evaluate(() => {
            const measure = (e) => {
              if (!e) return null;
              const r = e.getBoundingClientRect(),
                s = getComputedStyle(e);
              return {
                x: r.x,
                y: r.y,
                width: r.width,
                height: r.height,
                right: r.right,
                display: s.display,
                bg: s.backgroundColor,
                size: s.fontSize,
                radius: s.borderRadius,
              };
            };
            return {
              tree: [
                ...document.querySelectorAll(
                  ".linkRender .content,[data-mm-content] .content",
                ),
              ]
                .filter((e) => e.getBoundingClientRect().height)
                .map(measure),
              overlayAboveContent: (() => {
                const dialog = document.querySelector(
                  '.mm-dialog[open],#popup2[style*="display: block"],.tooltip[style*="display: block"]',
                );
                if (!dialog) return null;
                const r = dialog.getBoundingClientRect();
                return dialog.contains(
                  document.elementFromPoint(
                    r.x + r.width / 2,
                    r.y + r.height / 2,
                  ),
                );
              })(),
              overlay: measure(
                document.querySelector(
                  '.mm-dialog[open],#popup2[style*="display: block"],.tooltip[style*="display: block"]',
                ),
              ),
              search: measure(document.querySelector(".search-box")),
              input: measure(document.querySelector(".search-box input")),
            };
          });
          if (engine === "chromium" && device !== "narrow")
            await page.screenshot({
              path: path.join(
                out,
                `${device}-paper-day-welcome-${side}-${stage}-${kind}.png`,
              ),
            });
        }
        if (stage === "expanded" || stage === "others") {
          assert.equal(pair.main.tree.length, pair.react.tree.length);
          for (let i = 0; i < pair.main.tree.length; i++)
            for (const field of ["x", "y", "width", "height"])
              assert.ok(
                Math.abs((pair.main.tree[i][field] - (field === "y" ? pair.main.tree[0].y : 0)) -
                  (pair.react.tree[i][field] - (field === "y" ? pair.react.tree[0].y : 0))) <
                  1,
                `${device} ${side} ${stage} node ${i} ${field}`,
              );
        }
        if (stage === "search") {
          assert.ok(pair.react.input.width > 35);
          assert.ok(pair.react.search.right <= viewport.width);
        }
        if (stage === "annotation" || stage === "diagram") {
          assert.ok(pair.react.overlay?.height > 0);
          assert.ok(
            pair.react.overlayAboveContent,
            `${device} ${stage} covers lower content layers`,
          );
          assert.ok(
            pair.react.overlay.right <= viewport.width + 1,
            `${device} ${stage} stays inside viewport`,
          );
        }
        records.push(pair);
      }
  }
  return records;
}
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`,
    records = [],
    interactions = [];
  try {
    for (const [engineName, engine] of [
      ["chromium", chromium],
      ["webkit", webkit],
    ]) {
      const browser = await engine.launch();
      try {
        const page = await browser.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        for (const [device, viewport] of Object.entries({
          desktop: { width: 1280, height: 900 },
          phone: { width: 390, height: 844 },
          narrow: { width: 320, height: 700 },
        })) {
          await page.setViewportSize(viewport);
          for (const [theme, mode] of [
            ["paper", "day"],
            ["bamboo", "day"],
            ["paper", "night"],
          ])
            for (const key of ["welcome", "rich", "visual-design"])
              for (const side of ["front", "back"]) {
                const pair = {
                  engine: engineName,
                  device,
                  theme,
                  mode,
                  key,
                  side,
                };
                for (const kind of ["main", "react"]) {
                  await show(page, base, kind, key, side, theme, mode);
                  pair[kind] = await page.evaluate(metrics);
                  pair[kind].frosted = await page.evaluate(() => {
                    const e = document.querySelector(".cloze-frosted");
                    return e
                      ? {
                          blur: getComputedStyle(e).backdropFilter,
                          bg: getComputedStyle(e).backgroundColor,
                          rect: e.getBoundingClientRect().toJSON(),
                        }
                      : null;
                  });
                  if (engineName === "chromium" && device !== "narrow")
                    await page.screenshot({
                      path: path.join(
                        out,
                        `${device}-${theme}-${mode}-${key}-${side}-${kind}.png`,
                      ),
                    });
                }

                for (const field of [
                  "font",
                  "size",
                  "line",
                  "color",
                  "bg",
                  "border",
                  "radius",
                  "padding",
                  "margin",
                ]) {
                  // Alpha.6 intentionally compacts only the context heading.
                  if (!["size", "line", "padding", "margin"].includes(field))
                    assert.equal(pair.react.title?.[field], pair.main.title?.[field],
                      `${engineName} ${device} ${key} ${side} title ${field}`);
                  assert.equal(
                    pair.react.body[field],
                    pair.main.body[field],
                    `${engineName} ${device} ${key} ${side} body ${field}`,
                  );
                }
                if (pair.react.title) {
                  assert.equal(pair.react.title.size, "20px");
                  assert.equal(pair.react.title.line, "28px");
                  assert.equal(pair.react.title.padding, "0px 0px 6px 10px");
                  assert.equal(pair.react.title.margin, "0px 0px 10px");
                }
                for (const field of [
                  "x",
                  "y",
                  "width",
                  "height",
                  "bg",
                  "radius",
                  "color",
                  "size",
                ])
                  assert.equal(
                    pair.react.floating[field],
                    pair.main.floating[field],
                    `${device} deck strip ${field}`,
                  );
                for (const control of ["treeButton", "bullet"])
                  for (const field of [
                    "x",
                    "y",
                    "width",
                    "height",
                    "bg",
                    "radius",
                    "color",
                    "size",
                    "margin",
                    "shadow",
                  ])
                    if (control !== "treeButton" || !["y", "height"].includes(field)) assert.equal(
                      control === "bullet" && field === "y"
                        ? pair.react[control][field] - pair.react.nodes[0].y : pair.react[control][field],
                      control === "bullet" && field === "y"
                        ? pair.main[control][field] - pair.main.nodes[0].y : pair.main[control][field],
                      `${engineName} ${device} ${theme} ${mode} ${key} ${side} ${control} ${field}`,
                    );
                assert.equal(pair.react.treeButton.y, 0);
                // Shared viewport lengths may round to 1/64px in WebKit.
                assert.ok(Math.abs(pair.react.treeButton.height - viewport.height / 2) < .5,
                  "edge control remains half the viewport within subpixel rounding");
                assert.equal(
                  pair.react.frosted?.blur,
                  pair.main.frosted?.blur,
                  "frosted Cloze survives production CSS build",
                );
                assert.equal(pair.react.connector, pair.main.connector);
                assert.ok(
                  pair.react.fontReady,
                  "bundled original font must load",
                );
                assert.equal(
                  pair.react.nodes.length,
                  pair.main.nodes.length,
                  `${device} initial visible node count`,
                );
                for (let i = 0; i < pair.react.nodes.length; i++)
                  for (const field of [
                    "x",
                    "y",
                    "width",
                    "height",
                    "size",
                    "line",
                    "color",
                  ])
                    assert.ok(
                      typeof pair.main.nodes[i][field] === "number"
                        ? Math.abs(
                            (pair.react.nodes[i][field] - (field === "y" ? pair.react.nodes[0].y : 0)) -
                              (pair.main.nodes[i][field] - (field === "y" ? pair.main.nodes[0].y : 0)),
                          ) < 1
                        : pair.react.nodes[i][field] ===
                            pair.main.nodes[i][field],
                      `${device} ${theme} ${mode} ${key} ${side} node ${i} ${field}: ${pair.react.nodes[i][field]} vs ${pair.main.nodes[i][field]}`,
                    );
                records.push(pair);
              }
        }
        interactions.push(
          ...(await captureInteractions(page, base, engineName, out)),
        );
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
      }
    }
    fs.writeFileSync(
      path.join(out, "metrics.json"),
      JSON.stringify(
        {
          status: "passed",
          baseline: "f67c932",
          build: JSON.parse(
            fs.readFileSync(path.join(root, "dist/react-test-manifest.json")),
          ),
          records,
          interactions,
        },
        null,
        2,
      ),
    );
    console.log(
      "Visual checks passed:",
      records.length,
      "pairs, two browser engines, three widths, both themes/night, same native front/back",
    );
  } finally {
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
