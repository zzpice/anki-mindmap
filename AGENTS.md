# Maintenance instructions

- Maintain only the mindmap template. Start from the latest remote `main`; report the starting SHA. Work directly on `main` unless explicitly requested otherwise. Preserve uncommitted work.
- This repository was extracted without a runtime rewrite. Keep native HTML/CSS/JavaScript; React/TypeScript/Vite evaluation belongs to a separate, explicitly authorized stage.
- `cards/note-types.json` is the identity contract: model `1303378414`, native Cloze, fields `填写笔记`, `导图`, `Text` in that order. Preserve field IDs, template ID, native card ordinals and existing HTML/custom Cloze formats. Do not remove the personal-note popup or field incidentally.
- Runtime assets must be local. Anki supplies jQuery and native math support. Do not add CDN, remote services, a custom card-generation parser or a dependency on the source repository.
- `scripts/sources.py` expands build-time includes. Ship fully expanded HTML/CSS in APKG and template ZIP, with local media and all required copyright/license files.
- After template, media, build or fixture changes, run the commands in README and docs/development.md. Always use temporary collections/profiles; never access personal Anki data, AnkiConnect, sync or learning records.
- Record backend, browser, Qt Desktop preview, actual review and physical mobile device evidence separately. API stubs are not device tests. Preserve known original limitations during migration.
- `tests/migration-baseline.json` records the extraction source and byte-level runtime baseline. Do not silently update it to hide migration differences. Future intentional runtime changes require explicit scope and updated compatibility evidence.
- GitHub Actions only checks and uploads artifacts. Do not create a formal Release, deploy a website, modify the source repository or delete it without explicit authorization.
- Keep documentation primarily English. Keep generated packages, renders, screenshots, dependencies and profiles out of Git.
