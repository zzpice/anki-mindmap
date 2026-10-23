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
answers; open the diagram and annotations; use the client’s own image zoom; switch the paper/bamboo theme. Use Anki's
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

The alpha.2 package restores the original WenKai typography, ivory/bamboo palettes,
round bullets, dotted tree connectors, Cloze frosting and fixed edge controls.
See [same-card visual comparisons](test-packages/visual-comparison/README.md).

Alpha.6 compacts the knowledge heading, places two controls on each edge, and
keeps reading position and manual expansion across a front-to-back flip.
New cards still reset; answer state stays native. See [behavior and fallback limits](docs/reading-layout.md).

Alpha.7 contains wide answers inside the knowledge surface so mobile layout
zoom cannot stretch the edge controls, and matches the theme during startup.
The package includes a wide-table card. [Mobile regression details and remaining flicker limits](docs/mobile-viewport.md).

Alpha.9 removes the duplicate image viewer and leaves client image gestures unclaimed.
Buttons respond immediately with a 90ms release, panels fade in over 140ms, and manual
location/search navigation briefly outlines the destination. Reduced motion is respected.
The four edge controls retain the earlier independent fixed layout.
[Motion, image and iOS edge details](docs/motion-and-images.md).
Alpha.11 removes the shared frame and keeps narrow edge buttons wholly on screen,
with explicit two-line horizontal labels. This addresses clipping visible in supplied
iOS screenshots; original scroll/flip stability still needs physical retesting.

Alpha.13 withdraws alpha.12's ineffective edge-coordinate cache and consolidates
edge layout into one CSS definition. Manual scrolling no longer changes business
state or forces React updates. At that stage the iOS native flip issue remained open.
[Confirmed findings and independent main/React diagnostic APKG](docs/ios-edge-continuity.md).

Alpha.14 uses the live document layout height after user measurements showed the
visual height growing when other branches opened. The user reports that this
specific iOS real-card scenario now stays stable; broader mobile validation remains
open. An extra 10px outer-tree gutter also keeps folded marker rings inside the
content scroller. [Evidence, changes and limits](docs/ios-layout-viewport.md).

## How the code fits together

- `src/core.ts`: one pure state/command implementation for tree, answers, search, overlays
  and preferences; no React or DOM dependencies.
- `src/content.ts`: indexes native HTML and projects state inside its owned content root.
  It preserves rich fragments, native Cloze payloads, MathML, tables, images and unknown HTML.
- `src/ui.tsx`: React floating controls, search and accessible dialogs subscribe to the same store.
- `src/runtime.tsx`: assembles one card render, dispatches commands, coordinates navigation,
  input and disposal. Front and back share this entry.
- `src/resources.ts`, `math.ts`, `platform.ts`: cancellable resource ownership and narrow
  client capability boundaries. No pile of window-global patches.
- `src/reading.ts` handles cancellable viewport anchoring; `continuity.ts` hands only
  layout geometry from front to back, without persisting answers or note content.
- `src/viewport.ts` projects the current host layout height; CSS owns edge geometry.
- `scripts/build_react_package.py`: native backend packaging and collision-safety checks.
- `tests/react/`: business invariants, browser behavior, 100-cycle lifecycle stress and
  actual Desktop preview/reviewer checks. `tests/legacy/` is historical evidence only.

See [development](docs/development.md), [usage](docs/usage.md) and
[validation and limits](docs/validation.md). The old migration documents describe the
original extraction; its byte-level baseline is intentionally unchanged.
