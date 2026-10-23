import type { resources } from "./resources";

/** Layout readiness only. Does not own or change any answer/tree state. */
export function presentCard(
  host: HTMLElement,
  scope: ReturnType<typeof resources>,
  locate: () => void,
) {
  const doc = host.ownerDocument;
  if (!doc.documentElement.classList.contains("android"))
    return scope.frame(locate);

  // AnkiDroid loads a new document on each side and its window.onload resets
  // scroll position. A same-document code cache cannot fix that navigation.
  let autoLocate = true, presented = false, queued = false;
  let cancelDeadline = () => {};
  const show = () => {
    if (presented) return;
    presented = true;
    cancelDeadline();
    if (autoLocate) locate();
    host.dataset.mmPresented = "true";
  };
  const ready = () => {
    if (doc.readyState !== "complete") return false;
    // Resolve current font usage before reading FontFaceSet.status.
    host.getBoundingClientRect();
    return doc.fonts.status === "loaded" &&
      !doc.querySelector(".card.mathjax-needs-to-render");
  };
  const check = () => {
    if (presented || queued || !ready()) return;
    queued = true;
    scope.frame(() => {
      queued = false;
      if (ready()) show();
    });
  };
  scope.listen(doc.defaultView!, "load", check);
  scope.listen(doc.fonts, "loadingdone", check);
  scope.listen(doc.fonts, "loadingerror", check);
  scope.observe(doc.body, check, { attributes: true, attributeFilter: ["class"] });
  // A broken media/font/host callback must not leave the source hidden forever.
  cancelDeadline = scope.later(show, 2000);
  check();
  return () => { autoLocate = false; };
}
