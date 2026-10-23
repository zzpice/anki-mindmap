# Usage

Build `dist/anki-mindmap.apkg` or download the tested CI artifact. Import into a separate
Anki test profile first. The package contains one public mindmap note and its three native
Cloze cards. It contains no course material or personal learning records.

Keep the existing note type **思维导图**, ID **1303378414**, as native **Cloze**.
Do not create a Basic type with the same name. Fields must remain in this order:

| Field | Content |
| --- | --- |
| 填写笔记 | Personal-note HTML, shown in the retained note popup |
| 导图 | Diagram HTML/images, shown in the diagram popup |
| Text | Knowledge-tree HTML and native Cloze markup |

The template ZIP provides `mindmap/front.html`, `mindmap/back.html` and
`mindmap/style.css` with all includes already expanded, plus `media/`, the specification
and licenses. Copy the expanded templates into the existing matching model and place
local media in that test profile's media directory. Preserve the original fields and notes.
Do not paste include-bearing source files directly into Anki.

Ordinary `{{c1::answer::hint}}` and existing custom `cloze2_w` / `cloze2` content remain
supported by the original runtime. Anki decides which Cloze ordinals become cards;
multiple occurrences of c1 remain one card, and c2 is separate. Existing `.node`, `.bullet`,
`.content.mm-editor`, `.children` and `.node-list` knowledge-tree nesting is unchanged.
See `cards/samples.json` for the unchanged source example, and
`scripts/mindmap_examples.py` for anonymous test-content helpers, not a card parser.

The original controls are retained: notes, current-point positioning, diagram popup,
answer visibility, branch expansion, search navigation, annotation popups, local note
links and the 象牙笺/竹露 themes. Keyboard: G (keyup) notes, H locate, J diagram,
K branches, L other answers, C theme, Ctrl/Cmd+F search, Escape close search,
`[`/`]` hide/reveal active blanks. Inputs suppress single-letter shortcuts.
Gamepad mappings remain in the comments near the end of each card side, including
front flip and back ratings. Browser bridge stubs do not certify actual device support.

All supplied media is local. Additional images/audio in your own notes must also be
available locally and synced through Anki. Math continues to use client-native facilities;
the migration adds no remote math library. AnkiMobile and AnkiDroid require independent
device checks (see validation.md).
