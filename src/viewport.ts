import type { resources } from "./resources";

/** Publish the host's layout height, not the content-sensitive visual height.
 * On the reported AnkiMobile card, opening a sibling left clientHeight at 606
 * while innerHeight/visualViewport grew to 681/684. Percentage fixed insets
 * followed that growth. Read the live root metric; never cache card coordinates
 * or carry a size across faces. CSS alone divides the current layout height. */
export function bindReviewViewport(host: HTMLElement, scope: ReturnType<typeof resources>) {
  const doc = host.ownerDocument, view = doc.defaultView!, root = doc.documentElement;
  const property = "--mm-layout-height";
  const update = () => {
    const height = root.clientHeight;
    if (height <= 0) return;
    const value = `${height}px`;
    if (host.style.getPropertyValue(property) !== value)
      host.style.setProperty(property, value);
  };
  update();
  scope.listen(view, "resize", update);
  if (view.visualViewport) scope.listen(view.visualViewport, "resize", update);
  scope.resize(root, update);
  return () => host.style.removeProperty(property);
}
