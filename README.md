# Anki Mindmap

A standalone, offline mindmap template for Anki. Extracted from
[zzpice/anki-cards](https://github.com/zzpice/anki-cards/tree/aaea69d147f2fb39723b827b40086e4bcb2fa056)
without changing its card runtime. This is a migration, not an architecture rewrite.

| Compatibility contract | Value |
| --- | --- |
| Note type | 思维导图 |
| Model ID | `1303378414` |
| Anki type | Native Cloze |
| Fields, in order | `填写笔记` / `导图` / `Text` |

Existing knowledge-tree HTML, nested nodes, custom Cloze elements, images, MathML,
Anki math notation, personal notes, themes, folding, search, positioning, popups,
keyboard shortcuts and gamepad mappings are retained. Anki generates the cards.
There is no React, TypeScript, Vite, CDN or remote card service.

## Build and test

Python 3.12 and Node.js 22+ are required. Commands below use a new virtual environment;
no personal Anki profile or running Anki instance is needed.

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements-build.txt
.venv/bin/python -m pip install --no-deps -r scripts/requirements-test.txt
npm ci
npx playwright install chromium webkit
npm run check
.venv/bin/python scripts/build_package.py
ANKI_RENDER_OUTPUT=build/cards.json .venv/bin/python -m unittest discover -s tests -v
npm test
.venv/bin/python scripts/build_preview.py
npm run test:preview
.venv/bin/python scripts/release_assets.py
```

Outputs: `dist/anki-mindmap.apkg`, `dist/anki-mindmap-templates.zip`,
`dist/build-info.json` and `dist/SHA256SUMS`. The ZIP contains fully expanded templates
and all local media and licenses. Raw HTML files in `cards/` contain build-time includes;
do not paste them directly into Anki.

For a local preview, serve `build/preview-site/` with a local HTTP server. Preview build
may download the matching official Anki source once for AGPL compliance; the generated
preview and installed cards have no external runtime dependency. No website deployment
or official GitHub Release is enabled by this migration. CI uploads tested artifacts.

## Learn the source

- `cards/note-types.json` defines the stable model identity and fields.
- `cards/templates/mindmap/front.html` and `back.html` are the original card sides.
- `style.css` beside them is the independent mindmap stylesheet.
- `storage.html`, `cloze.js`, `annotations.js` and `links.js` are shared build-time fragments.
- `cards/media/` contains the local font, mark.js and example image.
- `scripts/` builds the package, expanded template ZIP and anonymous preview.
- `tests/` verifies native import, identity, scheduling, browser behavior and extraction hashes.
- `preview/` contains the local debugging UI; `docs/` explains usage and validation.

See [usage](docs/usage.md), [development](docs/development.md),
[migration scope](docs/migration.md), [validation](docs/validation.md) and
[licensing](NOTICE). Browser tests and Qt previews do not certify AnkiMobile or AnkiDroid.
