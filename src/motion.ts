import type { resources } from "./resources";

/** Navigation feedback only: no selection/answer state and no scrolling here.
 * A single card-owned animation is replaced on another command and cancelled
 * synchronously at disposal. Opacity/transform of the content are never touched. */
export function navigationCue(scope: ReturnType<typeof resources>) {
  let stop = () => {};
  const cancel = () => { stop(); stop = () => {}; };
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (reduced) scope.listen(reduced, "change", () => { if (reduced.matches) cancel(); });
  return {
    cancel,
    show(target: HTMLElement) {
      cancel();
      if (!reduced || reduced.matches) return;
      stop = scope.animate(target, [
        { outline: "2px solid var(--marker-color)", outlineOffset: "3px" },
        { outline: "2px solid transparent", outlineOffset: "3px" },
      ], { duration: 560, easing: "ease-out" });
    },
  };
}
