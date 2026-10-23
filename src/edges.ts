import type { resources } from "./resources";

export interface EdgeGeometry {
  width: number;
  bounds: { key: string; top: number; height: number }[];
}
const controls = [".floating-button", "#left-floating-widget", ".custom2-button", ".custom-button"];

/** Presentation geometry only. iOS can change its fixed-position reference
 * between native sides. Reuse this card's measured front bounds, not another
 * viewport-unit estimate; core.ts still owns every business command/state.
 * Width changes invalidate the handoff. No resize polling or shared UI wrapper.
 */
export function edgePosition(
  root: HTMLElement,
  scope: ReturnType<typeof resources>,
  enabled: boolean,
  zoom: () => number,
) {
  let pinned: EdgeGeometry | undefined;
  let last: EdgeGeometry | undefined;
  let width = innerWidth;
  const button = (key: string) => root.querySelector<HTMLElement>(key);
  const capture = (): EdgeGeometry | undefined => {
    if (!enabled) return;
    if (!root.isConnected) return last;
    const bounds = controls.flatMap(key => {
      const rect = button(key)?.getBoundingClientRect();
      return rect && rect.height > 0 ? [{ key, top: rect.top, height: rect.height }] : [];
    });
    if (bounds.length) last = { width: innerWidth, bounds };
    return last;
  };
  const style = (element: HTMLElement, key: string, value: string) => {
    const before = element.style.getPropertyValue(key);
    // WebKit normalises subpixel strings. Avoid rewriting the same geometry
    // on every interrupt/scroll solely due to serialisation rounding.
    if (before === value || (before.endsWith("px") && value.endsWith("px") &&
        Math.abs(parseFloat(before) - parseFloat(value)) < .01)) return;
    element.style.setProperty(key, value);
  };
  const project = () => {
    if (!pinned) return;
    for (const rect of pinned.bounds) {
      const element = button(rect.key);
      if (!element) continue;
      // Pixel lengths scale under the card's CSS zoom. Keep physical bounds
      // steady while preserving the existing zoom of tab width and label text.
      const lower = rect.key === ".floating-button" || rect.key === ".custom-button";
      const properties = { top: `${rect.top / zoom()}px`,
        height: lower ? "auto" : `${rect.height / zoom()}px`, bottom: lower ? "0px" : "auto" };
      for (const [key, value] of Object.entries(properties)) style(element, key, value);
      // If the host really exposes extra bottom space, extend the hit surface
      // into it without moving the seam or the label. No blank strip is added.
      const label = element.querySelector<HTMLElement>(".mm-edge-label");
      if (lower && label) {
        const height = `${rect.height / zoom()}px`;
        style(label, "height", height);
        style(label, "bottom", "auto");
      }
    }
  };
  const release = () => {
    if (!pinned) return;
    pinned = undefined;
    for (const key of controls) {
      const element = button(key);
      for (const property of ["top", "height", "bottom"]) element?.style.removeProperty(property);
      const label = element?.querySelector<HTMLElement>(".mm-edge-label");
      label?.style.removeProperty("height");
      label?.style.removeProperty("bottom");
    }
  };
  if (enabled) scope.listen(window, "resize", () => {
    if (Math.abs(innerWidth - width) < 1) return;
    // Genuine width/orientation changes use current CSS, not portrait geometry.
    width = innerWidth;
    release();
  });
  return {
    capture,
    project,
    restore(value: EdgeGeometry | undefined) {
      if (!enabled || !value || !Number.isFinite(value.width) ||
          Math.abs(value.width - innerWidth) >= 1 || !Array.isArray(value.bounds) ||
          value.bounds.length !== controls.filter(key => button(key)).length ||
          new Set(value.bounds.map(b => b?.key)).size !== value.bounds.length ||
          value.bounds.some(b => !b || !controls.includes(b.key) || !button(b.key) ||
            !Number.isFinite(b.top) || !Number.isFinite(b.height) ||
            b.top < 0 || b.top > 10000 || b.height <= 0 || b.height > 10000)) return;
      pinned = value;
      project();
    },
    reset() {
      release();
      last = undefined;
    },
    inspect: () => ({ enabled, pinned: !!pinned, width: innerWidth, height: innerHeight }),
  };
}
