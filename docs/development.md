# Development

The rewrite uses React 19, TypeScript and Vite, with native CSS. All runtime libraries are
bundled into one classic IIFE; Vite is never needed by an Anki client. The builder assigns
content-addressed `_mm_react_<hash>` names and packages every local asset. JS/CSS filenames
do not collide with the legacy runtime or a different build.

Use the commands in the root README. `npm run check` validates types and static scope;
`npm run build` emits `build/runtime`; the official-backend builder emits dist/APKG and
native browser fixtures; `npm test` runs the current core/browser acceptance suites.

Business state has one authority. `core` knows no DOM. The content module owns native
HTML, React owns sibling UI. Search reads public text (including folded prose), excludes
unrevealed custom/native answers, and only temporarily expands navigation paths. Closing
search removes its own expansion; later manual operations survive. Highlighting uses the
CSS Highlight API or a non-destructive element outline, never rewrites formula/link text.

All inputs call the runtime command dispatcher. Tree and answer state are independent;
other custom groups are identified by explicit cz-number/data identifiers, not class order.
Ordered reveal and reverse-text hide retain the old useful semantics. Native host actions
are capability gated; unsupported mobile grading bridges are not guessed.

Each render has a private store and resource scope. Replacement, same-root remount and
pagehide dispose listeners, timers, observers, RAF, subscriptions and React root. Native
content snapshots restore on owned-root remount; an externally replaced subtree is never
restored over the host's new content. No state is restored by deck name or node index.
Without a trustworthy cross-side identity, layout resets on a new side; this intentionally
prioritizes no cross-card contamination. Theme alone is a long-lived local preference.

Production identity is unchanged in cards/note-types.json. Packaging defaults ONLY to the
separate test model. Future production installation/export is a separate explicit step.
Do not change field IDs/order, native ordinals, GUIDs or data as part of a UI repair.

The visual skin lives separately in src/visual/original.css and src/style.css.
Historical HTML classes retain their original visual meaning. The first file
preserves original appearance values; the second handles the React/semantic-button
adapters. Page decorations are owned by the mounted runtime and removed on dispose.
New note types cannot inherit our page margins, themes or tree selectors. The pure
business core is unchanged by the visual restoration.

Anki executes the template before its reviewer resets body.className. The runtime
therefore observes the two owned page class decorations and restores them after a
host reset, preserving host classes such as nightMode. Those observers share the
same resource scope as other card work and are removed on disposal. Tests cover
this order explicitly; merely checking a standalone browser page would miss it.
