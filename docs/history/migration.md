# Extraction record

> 历史阶段记录；当前状态以[验证结果](../validation.md)为准，过期方案不再作为实现要求。

Source: [zzpice/anki-cards main, aaea69d147f2fb39723b827b40086e4bcb2fa056](https://github.com/zzpice/anki-cards/tree/aaea69d147f2fb39723b827b40086e4bcb2fa056).
The source was fetched and cloned separately; its tracked files and remote were not changed.
The new public repository starts its own history on main.

## Retained unchanged

All seven files in `cards/templates/mindmap/`, three necessary local media files, both
third-party license texts and the MIT license are copied byte for byte. Model specification
and the mindmap sample (including its GUID, fields and tags) are preserved. The build still
uses the same stock Cloze model, field IDs (`130337841401`–`130337841403`), template ID
`130337841400`, and native ordinal generation. `tests/migration-baseline.json` records the
exact source specification/sample and raw/expanded SHA-256 hashes. It is evidence of this
extraction; it is not a fetch instruction or a build dependency on the old repository.

## Adapted infrastructure

The existing include expansion, APKG creation, template ZIP assembly, public preview,
applicable native/browser tests and optional isolated Qt preview are kept. Build configuration,
package names and tests now handle only the mindmap. The local preview baseline defaults
to HEAD, so the first commit builds independently. Development version starts at 1.0.0;
the note type identity is independent of the repository version.

## Excluded

The four unrelated template families, their shared review runtime, common styles, their
samples/screenshots, choice/occlusion/general-review tests, historical migration tooling,
multi-template documentation and automatic Pages/Release publishing jobs are excluded.
No framework, architecture rewrite, performance change or visual redesign is introduced.
The original layout's limitations are retained, including any deep/narrow content overflow.
The personal-note field and popup remain intact.

## Compatibility boundary

Existing notes using model 1303378414 and the specified field order can use the expanded
templates without recreating their HTML or Cloze groups. The APKG contains the original
public sample, not user notes. It deliberately retains the sample GUID and example deck
identity to avoid duplicating that sample during an update. Import may update that sample
and the shared model; back up and inspect a separate profile before applying any future
update to real data. This migration never imports into a personal collection.

Older historical mindmap model IDs are not silently converted. Physical mobile clients,
actual controller hardware, native review grading and client-specific math processing require
separate acceptance. See [current validation](../validation.md) for measured results and remaining gaps.
