// File URLs and a blocked network verify that card assets have no online service dependency.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

module.exports = async function checkOffline(browser, root, renderRoot, examples) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'anki-mindmap-offline-'));
  const context = await browser.newContext({viewport:{width:320,height:700}});
  // WebKit's network-offline flag also rejects file: navigation on macOS.
  // Block every HTTP(S) request while leaving local media and scripts readable.
  await context.route(/^https?:/, route => route.abort('internetdisconnected'));
  const page = await context.newPage();
  const errors = [], network = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  try {
    for (const file of fs.readdirSync(path.join(root, 'cards/media'))) {
      fs.copyFileSync(path.join(root, 'cards/media', file), path.join(directory, file));
    }
    const nativeRoot = JSON.parse(fs.readFileSync(path.join(renderRoot, 'anki-web.json'), 'utf8'));
    fs.copyFileSync(path.join(nativeRoot, 'js/vendor/jquery.min.js'), path.join(directory, '_anki-jquery.js'));
    const css = fs.readFileSync(path.join(renderRoot, 'review.css'), 'utf8');
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({colorScheme:scheme});
      for (const sample of examples) {
        const card = sample.cards[0];
        for (const side of ['front', 'back']) {
          const file = path.join(directory, 'card.html');
          fs.writeFileSync(file, '<!doctype html><html><head><meta charset="utf-8">' +
            '<meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
            (sample.css || css) + '</style><script src="_anki-jquery.js"></script></head><body class="card'+(scheme==='dark'?' nightMode':'')+'">' + card[side] + '</body></html>');
          await page.goto(pathToFileURL(file).href);
          await page.locator('[data-ready="true"], .linkRender').first().waitFor();
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            'offline overflow: ' + sample.key + ' ' + side + ' ' + scheme);
        }
      }
    }
    assert.deepEqual(network, [], 'offline cards must not attempt HTTP requests');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    fs.rmSync(directory, {recursive:true, force:true});
  }
};
