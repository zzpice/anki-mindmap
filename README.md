# Anki Mindmap · React rewrite

A usable offline React/TypeScript mindmap card runtime, developed on `feat/react-rewrite`.
Main is unchanged. Anki remains responsible for native Cloze card generation, flipping,
grading and scheduling; the runtime preserves existing three-field note compatibility.

## Try it safely / 安全体验

Download [anki-mindmap-react-test.apkg](test-packages/anki-mindmap-react-test.apkg).
Use a new Anki profile with sync disabled, then import the file. The package includes a
Chinese experience card and anonymous compatibility examples. There is no website or
Vite server to run. On a work computer, downloading and importing the APKG is sufficient.

The test model is **思维导图 · React 测试版**, ID **1792748414**, separate from production
**1303378414**. Test GUIDs, deck and hashed media are separate. An automated import test
asserts an existing production model, note and scheduling rows remain unchanged. Do not
convert your real notes to the test model; evaluate with the included examples first.

Try folding the current branch then locating it; click current answers individually;
use ordered reveal/reverse hide; reveal other groups; search prose without exposing hidden
answers; open the diagram, annotation and image; switch the paper/bamboo theme. Use Anki's
own Show Answer and rating buttons. The personal-note popup is gone; all original fields
and content are retained. A Cloze present only in the personal-note field appears inline
when needed, without restoring that popup.

## Build and verify

Node 24 and Python 3.12 are the tested development defaults. Dependencies are locked.

```sh
npm ci
npm run check
npm run build
python3.12 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements-build.txt
.venv/bin/python scripts/build_react_package.py
npx playwright install chromium webkit
npm test
```

For actual isolated Desktop verification, install `aqt==26.9.3` with its Qt dependencies
into that environment and run `.venv/bin/python tests/react/desktop.py` in a graphical
session. It creates a unique disposable profile, disables sync, and never accesses a
personal collection. CI tests official Anki backends 25.9.2 and 26.9.3 and uploads APKGs.

`dist/` contains the importable test package, manifest and SHA256SUMS. The tracked package
under `test-packages/` is a tested branch snapshot for direct public downloading; no formal
Release is published. `build/react-site/` is only an optional local developer aid.

## How the code fits together

- `src/core.ts`: one pure state/command implementation for tree, answers, search, overlays
  and preferences; no React or DOM dependencies.
- `src/content.ts`: indexes native HTML and projects state inside its owned content root.
  It preserves rich fragments, native Cloze payloads, MathML, tables, images and unknown HTML.
- `src/ui.tsx`: React toolbar, search and accessible dialogs subscribe to the same store.
- `src/runtime.tsx`: assembles one card render, dispatches commands, coordinates navigation,
  input and disposal. Front and back share this entry.
- `src/resources.ts`, `math.ts`, `platform.ts`: cancellable resource ownership and narrow
  client capability boundaries. No pile of window-global patches.
- `scripts/build_react_package.py`: native backend packaging and collision-safety checks.
- `tests/react/`: business invariants, browser behavior, 100-cycle lifecycle stress and
  actual Desktop preview/reviewer checks. `tests/legacy/` is historical evidence only.

See [development](docs/development.md), [usage](docs/usage.md) and
[validation and limits](docs/validation.md). The old migration documents describe the
original extraction; its byte-level baseline is intentionally unchanged.
