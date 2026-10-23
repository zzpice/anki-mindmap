import type { resources } from "./resources";

export interface ReadingPoint {
  path: number[];
  top: number;
}

/** Geometry only: no answer or tree state. A short, cancellable hold covers
 * late image/math layout; any new input immediately returns control to the reader. */
export function readingPosition(root: HTMLElement, scope: ReturnType<typeof resources>) {
  let last: ReadingPoint | undefined;
  let release = () => {};
  const elementAt = (point: ReadingPoint): HTMLElement | undefined => {
    let element: Element | undefined = root;
    for (const index of point.path) element = element?.children[index];
    return element instanceof HTMLElement ? element : undefined;
  };
  const capture = (preferred?: HTMLElement): ReadingPoint | undefined => {
    if (!root.isConnected) return last;
    const element = preferred ?? [...root.querySelectorAll<HTMLElement>(".node > .content,.title")]
      .find((e) => {
        const r = e.getBoundingClientRect();
        return r.height > 0 && r.bottom > 16 && r.top < innerHeight - 16;
      }) ?? root;
    if (!root.contains(element) || !element.getClientRects().length) return last;
    const path: number[] = [];
    for (let current = element; current !== root;) {
      const parent = current.parentElement;
      if (!parent) return last;
      path.unshift([...parent.children].indexOf(current));
      current = parent;
    }
    return last = { path, top: element.getBoundingClientRect().top };
  };
  const restore = (point: ReadingPoint) => {
    const element = elementAt(point);
    if (!root.isConnected || !element?.getClientRects().length ||
        !Number.isFinite(point.top)) return false;
    const offset = element.getBoundingClientRect().top - point.top;
    if (Math.abs(offset) > 0.5) window.scrollBy(0, offset);
    last = point;
    return true;
  };
  const cancel = () => { release(); release = () => {}; };
  return {
    capture,
    cancel,
    hold(point?: ReadingPoint) {
      cancel();
      if (!point || !restore(point)) return false;
      // Disable competing browser anchoring only while we own this adjustment.
      const previous = root.style.overflowAnchor;
      root.style.overflowAnchor = "none";
      const stopResize = scope.resize(root, () => restore(point));
      const stopTimer = scope.later(cancel, 2000);
      release = () => {
        stopResize(); stopTimer();
        root.style.overflowAnchor = previous;
      };
      return true;
    },
  };
}
