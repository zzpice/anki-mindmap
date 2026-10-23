# React test package

Download `anki-mindmap-react-test.apkg` from this branch. This is a standalone offline
Anki import, not a browser preview. Use a new profile with sync disabled.

It uses model **1792748414** named **思维导图 · React 测试版**, its own sample GUID namespace
and deck, plus hashed local assets. It does not update production model **1303378414**.
The native import test verifies existing production model, note and scheduling rows remain
unchanged. The original three fields and native Cloze semantics are retained.

Open the welcome lesson to try folding, locating, per-occurrence reveal, other-group
reveal, search, diagram, annotations and images. Show Answer and ratings remain native.
Desktop 26.9.3 is exercised in an isolated profile. Physical phones/gamepad are unverified.
Consult `react-test-manifest.json` and `SHA256SUMS` for the exact build. No formal release.

Alpha.5 adds short readable edge labels without widening the tabs or reducing
content width. Android edge buttons act on stationary touch release and ignore
the later compatibility click; unchanged tree/answer projections no longer
rewrite DOM on navigation interruption. Knowledge titles, theme palette and
animations are unchanged. See [edge control details](../docs/edge-controls.md).

Alpha.4 restores touch-only node expansion on mobile, deduplicates compatibility
clicks, and waits for AnkiDroid's full-page load/font/layout before presenting
and locating the tree. The iOS presentation path stays as in alpha.3. These new
paths have automated browser/isolated Desktop coverage; physical-device retest
is pending.

Alpha.3 addresses transient image/layout flashes during flips. CSS is inline
before native content; the exact loaded runtime is reused as code only, every
card still gets fresh state. Diagram source images stay inert until opened.
Mobile-size Chromium/WebKit checks pass; Android/iOS device confirmation is
pending. See [flip rendering evidence](../docs/flip-rendering.md).

Alpha.2 restores the original main visual design. The original WenKai font is
bundled locally with its OFL, so the package is about 19 MB. The new visual-design
sample covers heading levels, highlights and notes; there are 20 notes / 26 native
Cloze cards. See [old/new screenshots](visual-comparison/README.md).

Top deck strip opens search; left upper/lower tabs open the diagram and locate;
right upper/lower tabs expand/collapse the tree and show/hide other groups. Current
Cloze can still be tapped independently. The removed personal-note popup stays
removed, with its field and content preserved.

Alpha.9 adds immediate press feedback, local panel fade-in and a short navigation
outline, respecting reduced motion. Inline images use the client's own gestures;
there is no second template image viewer. Four edge controls now share a stable
viewport frame, including review zoom. Both engines pass scroll/flip/resize tests;
AnkiMobile rubber-band scrolling and native image zoom need physical retest.
[Changes and limits](../docs/motion-and-images.md).

Alpha.10 corrects edge proportions and label centring using fixed insets and a
centred text container, rather than viewport-unit/transform estimates. Mobile
regressions check actual text centres during scroll, flip, review zoom and rotation.

Alpha.11 removes the shared edge frame and keeps the same visible-width tabs fully
on screen. Labels use explicit horizontal lines with text autosizing disabled.
This targets clipping visible in iOS screenshots; native scroll/flip stability still
needs physical retesting. Motion and native image gestures remain.

Alpha.12 adds card-scoped iOS front-to-back edge geometry continuity, including
native viewport height changes. Lower surfaces extend without moving labels.
[Tests and remaining real-device limits](../docs/ios-edge-continuity.md).
