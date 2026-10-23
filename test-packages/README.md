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

Alpha.2 restores the original main visual design. The original WenKai font is
bundled locally with its OFL, so the package is about 19 MB. The new visual-design
sample covers heading levels, highlights and notes; there are 20 notes / 26 native
Cloze cards. See [old/new screenshots](visual-comparison/README.md).

Top deck strip opens search; left lower tab locates; right upper/middle/lower tabs
open the diagram, expand/collapse the tree and show/hide other groups. Current
Cloze can still be tapped independently. The removed personal-note popup stays
removed, with its field and content preserved.
