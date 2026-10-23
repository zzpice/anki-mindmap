# Maintenance instructions

- The authorized React rewrite is developed on `feat/react-rewrite`, starting from latest remote main f67c932. Do not change/merge main or publish a formal Release. Preserve unrelated work.
- `src/core.ts` is the only business-state authority. React owns its UI root; content.ts owns only the sibling native-content region. Inputs dispatch commands. Never duplicate answer/tree/search state inside components or DOM handlers.
- Production compatibility contract remains native Cloze model 1303378414, fields 填写笔记 / 导图 / Text in that order, stable field/template IDs. Keep every field and its content. The independent personal-note popup is intentionally removed. A field-only current Cloze remains usable inline.
- Public test APKGs MUST use the independent test model 1792748414, distinct name, GUID namespace, deck and content-addressed media. Never ship a test APKG that updates production identity 1303378414. Committing a downloadable test package on this branch is explicitly authorized.
- Runtime assets are completely local. Anki generates native Cloze cards, flips and grades. No CDN, online service, custom card-generation parser, personal collection, AnkiConnect or sync.
- Run `npm run check`, `npm run build`, official-backend `scripts/build_react_package.py`, `npm test`; use `tests/react/desktop.py` for a fresh isolated graphical profile. Record backend, browser, Qt preview, actual reviewer, physical phones and controller evidence separately.
- Every mount owns its listeners, timers, observers, animation frames, subscriptions and React root. Disposal is idempotent; stale closures cannot touch the next card. Unknown content stays readable and diagnosed.
- `tests/migration-baseline.json` remains the historical extraction record, unchanged. tests/legacy documents the old runtime behavior; it is not the acceptance suite for intentional new product rules.
- Keep code/module names straightforward. Document reasons for ownership, identity and lifecycle decisions. Keep generated profiles, node_modules, logs and screenshots out of Git. A named test APKG and concise verification records are allowed under test-packages/.
