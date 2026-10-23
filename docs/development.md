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
restored over the host's new content. No cross-note preference is keyed by deck
name or node index alone.
An optional single-use source/ordinal/topology match carries only expanded paths,
zoom and reading position from front to back. Missing/mismatched metadata starts
fresh; every new front invalidates the prior handoff. Answers/search/dialogs never
carry across a flip. See reading-layout.md for identity limits. Theme alone is a
long-lived local preference. Edge-control coordinates are not stored or restored.
`viewport.ts` projects only the live root clientHeight into a card-owned CSS
variable. CSS owns the four half-height controls and cancels the card's own zoom.
Visual-viewport growth caused by expanded content does not redefine that frame;
real root resizing still updates it. Scope disposal removes observers/listeners
and the projection. See ios-layout-viewport.md for measured inputs and limits.

Production identity is unchanged in cards/note-types.json. Packaging defaults ONLY to the
separate test model. Future production installation/export is a separate explicit step.
Do not change field IDs/order, native ordinals, GUIDs or data as part of a UI repair.

The visual skin lives separately in src/visual/original.css and src/style.css.
Historical HTML classes retain their original visual meaning. The first file
preserves rich-content/theme values and approved heading sizing; the second owns
the actual React controls. Historical edge-control rules are removed from the skin
instead of being overridden repeatedly. Page decorations are owned by the mounted runtime and removed on dispose.
New note types cannot inherit our page margins, themes or tree selectors. The pure
business core is unchanged by the visual restoration.

Anki executes the template before its reviewer resets body.className. The runtime
therefore observes the two owned page class decorations and restores them after a
host reset, preserving host classes such as nightMode. Those observers share the
same resource scope as other card work and are removed on disposal. Tests cover
this order explicitly; merely checking a standalone browser page would miss it.

Navigation interruption is a lifecycle action: it cancels pending location and
queues at most one reading snapshot per frame. It does not mutate the business
store or notify React. Do not introduce an unused scroll/intent counter into state.

tests/react/layout-probe.html is diagnostic-package code only, never an application
import. It records numeric layout/viewport measurements without answer text, does
not apply styles to the application or dispatch commands, and cleans its own
listeners/observer/frame on replacement. The pinned main runtime is a test fixture.
