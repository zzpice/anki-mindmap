# Validation and remaining limits

The publicly downloadable APKG uses an independent test model. Any separately
authorized local template maintenance is not part of these isolated tests.
The production contract file, original sample field content and historical extraction
baseline are unchanged. The old runtime's duplicated scripts are replaced by shared React
UI, pure business rules and a bounded native-content module. Legacy tests are retained as
historical evidence, not silently changed to bless old defects.

## Current automated checks

- Ten core tests, including 1000 invariant sequences: folding never changes answers,
  reveal never changes layout, native occurrences stay independent, other groups exclude
  current, ordered reveal/reverse hide and search/manual-layout precedence.
- Official Anki backend: 21 anonymous notes, 27 cards, same-number occurrences, c1/c30,
  nested/native/custom Cloze, field-only questions, empty Text, HTML/image/table/MathML.
- Collision-safe test import into a collection already containing model 1303378414 and a
  synthetic scheduled note: original model JSON, complete note/card rows unchanged.
  Repeated import does not duplicate test notes; fields, ordinals and media round-trip.
- Chromium and WebKit each load 54 native sides and run 100 front/back/next lifecycle
  sequences, including duplicate bundle execution, same-root remount, externally removed
  hosts, rejected stale commands and zero owned resources after disposal.
- Search excludes hidden answers, navigates folded prose, does not change reveal and does
  not undo later manual folding. Diagram and annotation dialogs work; image gestures are left to the client. Mouse,
  browser touch and keyboard use shared commands; editable fields protect shortcuts.
- Twenty React updates preserve rich-content DOM identities. Detached local file assets
  run in Chromium offline emulation; WebKit uses HTTP(S) blocking because its local-file
  offline emulator fails on this host. Neither browser is a mobile-device certification.

## Actual Desktop evidence

Official Anki/aqt 26.9.3 on macOS 27.0.1 arm64, PyQt/Qt compiled 6.11.0, WebEngine UA
6.11.2/Chromium 140. A uniquely keyed safe-mode process uses a fresh profile with auto-sync
disabled. It loads 54 preview sides and a fresh direct-back view, then runs the actual
reviewer: reveal, native Show Answer, native Again rating, next different anonymous card.
Only the temporary profile receives a review-log entry. Removing the reviewer host
cleans every owned resource. The driver explicitly closes its collection and Qt services.

Basic dynamically revealed TeX is typeset locally; ten hide/reveal cycles keep one active
formula and two total MathJax items. Content source is restored if a synchronous math call
requires an asynchronous extension. Qt input/GPU/media/MathJax warnings are retained in
logs; passing assertions do not mean warning-free operation.

## Limits to understand before testing

- No AnkiMobile, AnkiDroid physical device or real gamepad has been certified. Browser
  touch and controller API substitutes only exercise input logic. Mobile grading bridges
  are not guessed; use native app controls. Local-note navigation is capability gated.
- A matched front/back can retain expanded branches, zoom and reading position;
  every new front resets. The source/ordinal/topology match has documented limits
  in reading-layout.md. Search, temporary answers and dialogs reset on native flip.
- The iOS edge seam movement remains unresolved on hardware. Alpha.12's coordinate
  cache was withdrawn after a teardown-order counterexample and repeated user reports.
  Browser reference-height changes move the main baseline too; this does not prove
  that the same event occurs on a particular iPhone. The separate layout comparison
  APKG is for measurement, not a mobile reliability certification.
- Basic MathML/loaded TeX work in the tested Desktop. Async-only formula extensions,
  older WebViews, mobile math interfaces and arbitrary historical HTML need user testing.
  Unknown structures stay readable rather than being destructively normalized.
- No long-running heap/battery or very-large-tree performance certification is claimed.
  Controller polling sleeps when no controller is present; every resource is disposed.
- The test APKG never upgrades the production note type. Testing a real-note upgrade or
  publishing/merging a formal version remains a separate authorized operation.

GitHub Actions independently builds/tests both official backend versions and uploads an
artifact. The directly downloadable committed APKG is a verified local build; its manifest
and SHA256SUMS identify exact bytes. No formal Release, main merge or deployment is used.

## Visual restoration (alpha.2)

Baseline is main f67c932, not the preceding React page design. Identical native
front/back card inputs pass through both actual templates and official reviewer
rendering, including locally supplied MathJax. Chromium and WebKit compare 1280,
390 and 320px widths, ivory/bamboo themes and night mode. Title/body typography,
node geometry, connectors, bullet/control geometry and Cloze frosting are checked
against the original. The new visual-design sample covers heading levels, notes,
highlights, tables, images and MathML; field contents survive native round trip.

Additional scenes cover expanded trees, other-group reveal, search, diagram and
anchored annotations. Screenshots are browser evidence, not mobile device approval.
The deliberately removed personal-note control is absent. Search retains the
approved non-revealing behavior; its added step controls remain inside the search
panel. Host button margins are reset to prevent narrow-screen crowding. Diagram
closing is explicit/outside-click and night dialogs remain readable.

Original rich-content/theme values and approved compact heading rules are in
src/visual/original.css. src/style.css owns React controls, state projection and
dialogs; historical unused edge/personal-popup rules are removed. No legacy
JavaScript is imported by the application. The bundled WenKai font is unchanged and
its OFL is included. Inline CSS and font preload advertise the packaged font
before runtime startup. CSS minification stays off because it
otherwise discards Chromium's standard backdrop-filter in this toolchain.

Reproduce comparisons after building the test package:

```sh
.venv/bin/python scripts/prepare_visual_comparison.py
node tests/react/visual.cjs
```

The preparer only reads the pinned Git commit and creates disposable collections.
It does not change the checked-out branch or a personal Anki profile.
