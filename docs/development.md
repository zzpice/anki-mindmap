# Development

Run the full sequence in README from a clean checkout. Python 3.12, Node.js 22+,
`anki==26.9.3`, matching `aqt==26.9.3` and locked Playwright are the defaults.
CI repeats the complete checks with Anki/aqt 25.9.2 and 26.9.3. On Linux, use
`npx playwright install --with-deps chromium webkit`.

The package builder uses a temporary official collection, preserves model/field/template
IDs and sample GUIDs, adds local media, exports without scheduling, and appends licenses.
No build reads a personal collection. `scripts/sources.py` expands includes recursively;
relative traversal, cycles and missing files fail. There is one model and one stylesheet.

The native suite imports the actual APKG into temporary collections, checks media bytes,
field order, source/render equality, repeat imports, template updates and scheduling.
`ANKI_RENDER_OUTPUT=build/cards.json` writes fixtures for Chromium/WebKit. Use that flag
before `npm test`; browser fixtures must match the installed Anki version.
`ANKI_TEST_PACKAGE`, `ANKI_TEST_PREVIEW` and `ANKI_RENDER_DIR` override fixture locations.

`npm test` covers both sides, native Cloze, custom nodes, deep/rich content, annotations,
local links, touch, storage failures, search, popups, themes, keyboard and mocked gamepad
bridges. Layout tests record original overflow instead of changing the supplied template.
Optional screenshots: `ANKI_VISUAL_SCREENSHOTS=1 npm test` (ignored `build/uiux-visual/`).

## Local preview

```sh
.venv/bin/python scripts/build_preview.py
npm run test:preview
python3 -m http.server 8000 --directory build/preview-site
```

Open localhost port 8000. Preview uses official renders and local reviewer assets.
`--baseline-ref <local-commit>` compares with another commit in this repository;
default `HEAD` works for the initial commit and offline checkouts. Both panes use the
same anonymous fixtures and separate temporary storage. No old repository is fetched.
The matching Anki source archive is downloaded only at build time and cached in `build/`.
It accompanies the generated preview for AGPL compliance, outside card packages.

## Desktop preview

Install full Qt dependencies with `.venv/bin/python -m pip install -r scripts/requirements-test.txt`,
then run `.venv/bin/python tests/desktop_smoke.py` in a graphical desktop session.
It uses a unique single-instance key, safe mode, a new `build/desktop-preview-*` profile
and disabled auto-sync. It previews both sides in light/dark application themes and writes
`build/desktop-results.json`. Do not remove the isolation flags or point it at a personal profile.
This is the normal aqt previewer, not proof of actual review/grading or physical mobile support.

## Packaging and CI

After tests, run `.venv/bin/python scripts/release_assets.py`. It packages expanded
sources without rebuilding the tested APKG and writes revision/version metadata and
SHA-256 checksums. `dist/` is ignored. Assembly requires a Git commit.

The GitHub workflow runs on main, pull requests and manual dispatch. Both Anki matrices
run source/native/browser/preview tests. Anki 26.9.3 uploads the tested APKG, template ZIP,
manifest/checksums and local preview. There is no deploy, tag publishing or Release job.
Publishing a formal release is a separate authorized action.
