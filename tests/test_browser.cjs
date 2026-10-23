// 使用导入安装包后的真实 HTML 和官方 Anki reviewer，检查两种浏览器引擎。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium, webkit} = require('playwright');

const root = path.resolve(__dirname, '..');
const renderRoot = path.resolve(root, process.env.ANKI_RENDER_DIR || 'build');
const examples = JSON.parse(fs.readFileSync(path.join(renderRoot, 'cards.json'), 'utf8'));
const mindmapCases = JSON.parse(fs.readFileSync(path.join(renderRoot, 'mindmap-cases.json'), 'utf8'));
const checkMindMap = require('./mindmap_browser.cjs');
const checkOffline = require('./offline_browser.cjs');
const visualCases = JSON.parse(fs.readFileSync(path.join(renderRoot, 'visual-cases.json'), 'utf8'));
const nativeRoot = JSON.parse(fs.readFileSync(path.join(renderRoot, 'anki-web.json'), 'utf8'));
const server = http.createServer((request, response) => {
  const url = decodeURIComponent(request.url.split('?')[0]);
  if (url === '/card') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<base href="/cards/media/"><link rel="stylesheet" href="/native/css/reviewer.css">' +
      '</head><body class="card"><div id="qa"></div>' +
      '<script src="/native/js/vendor/jquery.min.js"></script><script src="/native/js/reviewer.js"></script></body></html>');
    return;
  }
  const directory = url.startsWith('/native/') ? nativeRoot : root;
  const file = path.resolve(directory, '.' + (directory === root ? url : url.slice(7)));
  if (!file.startsWith(directory + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end(); return;
  }
  const types = {'.html':'text/html', '.css':'text/css', '.json':'application/json',
    '.js':'text/javascript', '.svg':'image/svg+xml', '.apkg':'application/octet-stream'};
  response.setHeader('Content-Type', (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8');
  response.end(fs.readFileSync(file));
});

async function showCard(page, html) {
  const mindmap = html.includes('class="linkRender"');
  if (mindmap && !html.startsWith('<style>')) {
    html = '<style>' + examples.find(e => e.type === 'mindmap').css + '</style>' + html;
  }
  await page.evaluate(async ({html,mindmap}) => {
    document.body.classList.toggle('nightMode', matchMedia('(prefers-color-scheme:dark)').matches);
    const qa = document.getElementById('qa');
    qa.innerHTML = html;
    // 与官方 reviewer 相同，顺序执行内联脚本并等待媒体脚本完成。
    for (const old of Array.from(qa.querySelectorAll('script'))) {
      await new Promise(resolve => {
        const script = document.createElement('script');
        for (const attribute of old.attributes) script.setAttribute(attribute.name, attribute.value);
        script.textContent = old.textContent;
        if (old.src) {
          script.onload = resolve;
          script.onerror = () => { throw new Error('Script failed: ' + old.src); };
        }
        old.replaceWith(script);
        if (!script.src) resolve();
      });
    }
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, {html,mindmap});
}

async function run(engine, name, base) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
    const errors = [], external = [], failed = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (!r.url().startsWith(base)) external.push(r.url()); });
    page.on('response', r => { if (r.status() >= 400) failed.push(r.url()); });
    await page.goto(base + '/card');
    await checkMindMap(page, showCard, mindmapCases, name);
    await require('./migration_interactions.cjs')(page, showCard, mindmapCases);
    await require('./visual_browser.cjs')(page, showCard, visualCases, name);
    await checkOffline(browser, root, renderRoot, examples);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    assert.deepEqual(failed, []);
    console.log(name + ': mindmap interactions, layout and offline resources passed');
  } finally { await browser.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    await run(chromium, 'Chromium', base);
    await run(webkit, 'WebKit', base);
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
