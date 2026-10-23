import type { resources } from "./resources";

/** Translate a stationary touch and its compatibility click into one action.
 * The callback owns hit testing and commands; this module owns gestures only.
 * Register before React's delegated listeners when sharing its UI root.
 */
export function bindTap(
  root: HTMLElement,
  scope: ReturnType<typeof resources>,
  activate: (target: Element, event: Event) => boolean,
) {
  let touch: { id: number; x: number; y: number; target: Element } | undefined;
  let lastTap: { target: Element; time: number } | undefined;
  scope.listen(root, "touchstart", (event) => {
    const e = event as TouchEvent, point = e.touches[0];
    touch = e.touches.length === 1 && e.target instanceof Element
      ? { id: point.identifier, x: point.clientX, y: point.clientY, target: e.target }
      : undefined;
  }, { passive: true });
  scope.listen(root, "touchmove", (event) => {
    const e = event as TouchEvent, point = e.touches[0];
    if (!touch || e.touches.length !== 1 || point.identifier !== touch.id ||
        Math.abs(point.clientX - touch.x) >= 10 || Math.abs(point.clientY - touch.y) >= 10)
      touch = undefined;
  }, { passive: true });
  scope.listen(root, "touchcancel", () => { touch = undefined; });
  scope.listen(root, "touchend", (event) => {
    const e = event as TouchEvent, start = touch, point = e.changedTouches[0];
    touch = undefined;
    if (!start || e.touches.length || e.changedTouches.length !== 1 ||
        point.identifier !== start.id || Math.abs(point.clientX - start.x) >= 10 ||
        Math.abs(point.clientY - start.y) >= 10) return;
    // Capture before activation replaces an answer's placeholder children.
    const stableTarget = start.target.closest("button,.bullet,.cloze") ?? start.target;
    if (activate(start.target, e)) {
      e.preventDefault();
      lastTap = { target: stableTarget, time: e.timeStamp };
    }
  }, { passive: false });
  scope.listen(root, "click", (event) => {
    const e = event as MouseEvent;
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    if (lastTap && e.detail > 0 && e.timeStamp >= lastTap.time &&
        e.timeStamp - lastTap.time < 600 &&
        (lastTap.target === target || lastTap.target.contains(target) || target.contains(lastTap.target))) {
      e.preventDefault();
      e.stopImmediatePropagation();
      lastTap = undefined;
      return;
    }
    activate(target, e);
  });
}
