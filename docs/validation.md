# Validation and remaining limits

This branch is a usable rewrite, not a replacement installed in a personal collection.
The production contract file, original sample field content and historical extraction
baseline are unchanged. The old runtime's duplicated scripts are replaced by shared React
UI, pure business rules and a bounded native-content module. Legacy tests are retained as
historical evidence, not silently changed to bless old defects.

## Current automated checks

- Eight core tests, including 1000 invariant sequences: folding never changes answers,
  reveal never changes layout, native occurrences stay independent, other groups exclude
  current, ordered reveal/reverse hide and search/manual-layout precedence.
- Official Anki backend: 19 anonymous notes, 24 cards, same-number occurrences, c1/c30,
  nested/native/custom Cloze, field-only questions, empty Text, HTML/image/table/MathML.
- Collision-safe test import into a collection already containing model 1303378414 and a
  synthetic scheduled note: original model JSON, complete note/card rows unchanged.
  Repeated import does not duplicate test notes; fields, ordinals and media round-trip.
- Chromium and WebKit each load 48 native sides and run 100 front/back/next lifecycle
  sequences, including duplicate bundle execution, same-root remount, externally removed
  hosts, rejected stale commands and zero owned resources after disposal.
- Search excludes hidden answers, navigates folded prose, does not change reveal and does
  not undo later manual folding. Diagram, annotations and image dialogs work. Mouse,
  browser touch and keyboard use shared commands; editable fields protect shortcuts.
- Twenty React updates preserve rich-content DOM identities. Detached local file assets
  run in Chromium offline emulation; WebKit uses HTTP(S) blocking because its local-file
  offline emulator fails on this host. Neither browser is a mobile-device certification.

## Actual Desktop evidence

Official Anki/aqt 26.9.3 on macOS 27.0.1 arm64, PyQt/Qt compiled 6.11.0, WebEngine UA
6.11.2/Chromium 140. A uniquely keyed safe-mode process uses a fresh profile with auto-sync
disabled. It loads 48 preview sides and a fresh direct-back view, then runs the actual
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
- Tree layout resets on each new side/render because there is no proven universal card
  identity. This prevents cross-note contamination; theme persists locally. Search,
  temporary answers and dialogs reset on native flip.
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
