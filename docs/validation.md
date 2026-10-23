# Validation record

Date: 2026-10-23. Source baseline: `aaea69d147f2fb39723b827b40086e4bcb2fa056`
of zzpice/anki-cards. This is an extraction, with no card runtime edits.

| Evidence | Result |
| --- | --- |
| Clean dependency installation | New Python 3.12 environment, official Anki/aqt 26.9.3; `npm ci` with locked Playwright 1.62.1 passed |
| Static scope/offline/reference checks | `npm run check` passed; only mindmap is configured |
| Source parity | Seven template/fragment files, three media files and three license texts match source bytes; expanded front/back/CSS hashes match |
| Native automated suite | 13 tests passed on macOS with Anki 26.9.3 |
| APKG inspection | `collection.anki21` contains exactly one model: 1303378414, native Cloze, fields 填写笔记 / 导图 / Text; one example note, three cards |
| Media manifest | Exactly `_jquery.mark.es6.js`, `_guoqijihua_lxgwgbr.ttf`, `_rule-build.svg`; imported bytes match the sources |
| Native grouping | Same-group blanks, nonconsecutive c1/c30, nested Cloze, images, MathML and native math notation checked using official Anki renders |
| Repeat import / model update | Sample GUID, existing fields/tags, card IDs and test scheduling preserved in temporary collections |
| Chromium and WebKit | Both passed interaction, storage failure, touch, annotation, local-link, search, popup, keyboard and mocked controller checks |
| Layout | Both engines checked 16 complex front/back layouts across four viewport sizes and light/dark; additional deep-answer checks passed |
| Offline | File-based cards with all HTTP(S) blocked passed; no HTTP(S) requests attempted; browser/preview runs also reported no external requests or failed resource responses |
| Local preview | Standalone preview built; both browser engines passed same-data comparison, pane isolation, scene/card/side controls, viewport changes and deep-link reload |
| Anki Desktop | Anki/aqt 26.9.3, QtWebEngine on macOS: 36 normal front/back previews passed in a new safe-mode profile, light/dark; includes source-shaped complex, nested and formula notes |
| Template distribution | Fully expanded `anki-mindmap-templates.zip`, APKG, build-info and SHA256SUMS generated; no official Release created |
| GitHub CI | The workflow checks Anki/aqt 25.9.2 and 26.9.3 on Linux, with native tests and Chromium/WebKit/preview tests; consult the Actions run for the exact pushed revision |

## Actual old-package to new-package check

Separately built the complete original package from the pinned source, imported it into a
new temporary collection, and added 13 anonymous source-shaped mindmap cases. After
importing the new APKG, all 23 notes and 32 cards retained their IDs, fields, tags and
scheduling. The mindmap model (including field/template IDs, CSS and both card sides)
was identical. All 20 mindmap cards had identical front/back HTML before and after.
The original and extracted public-sample render JSON were also identical. No old package
or source checkout is required by the new repository's tests/build.

## Evidence limits and retained risks

- Desktop result is the actual aqt normal previewer, not a completed review/grading session.
  No personal profile, AnkiConnect or synchronization was used.
- AnkiMobile and AnkiDroid physical devices were not available. Their media sync, native
  links, touch/rotation/safe areas, storage restrictions and client-specific native math
  rendering remain pending. WebKit/Chromium and mobile API stubs do not establish this.
- Gamepad tests use `navigator.getGamepads` and client-bridge doubles. Physical controllers,
  native flip/rating dispatch and repeated real review transitions remain pending.
- MathML rendering was exercised in browsers and formula-containing cards in Desktop;
  comprehensive native TeX/MathJax rendering across all clients remains pending.
- The source's deep/narrow table overflow and existing interaction behavior are retained.
  Migration does not claim to fix inherited defects or certify every historical note.
- Source MIT declaration and owner-supplied template provenance are retained. mark.js MIT,
  unmodified font OFL and separate preview reviewer AGPL notices/source are preserved;
  earlier template authorship is not independently re-established by this extraction.

Generated screenshots, fixtures and isolated profile results stay in ignored `build/`.
CI artifacts include the tested package/ZIP/checksums and a self-contained local preview;
there is no Pages deployment or automatic formal-release publishing.
