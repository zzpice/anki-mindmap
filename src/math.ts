interface NativeMath {
  typeset?: (elements: HTMLElement[]) => void;
  typesetClear?: (elements: HTMLElement[]) => void;
}

// Capability-based, synchronous bridge to the host's LOCAL MathJax runtime.
// Do not enqueue uncancellable promises or copy Desktop paths to mobile clients.
// Basic loaded TeX is supported; async-only extensions retain readable source for now.
export function nativeMath() {
  const warnings: string[] = [];
  let calls = 0;
  const get = () => (window as Window & { MathJax?: NativeMath }).MathJax;
  return {
    warnings,
    inspect: () => ({ calls, warnings: [...warnings] }),
    clear(element: HTMLElement) {
      try {
        get()?.typesetClear?.([element]);
      } catch {
        warnings.push("Host math cleanup unavailable; source remains readable");
      }
    },
    reveal(element: HTMLElement) {
      const math = get();
      if (!math?.typeset || !math.typesetClear) return;
      const source = Array.from(element.childNodes, (node) =>
        node.cloneNode(true),
      );
      try {
        math.typeset([element]);
        calls++;
      } catch {
        try {
          math.typesetClear([element]);
        } catch {
          /* preserve source even if host cleanup rejects */
        }
        element.replaceChildren(...source);
        warnings.push(
          "This formula needs async host typesetting; retained source requires further client validation",
        );
      }
    },
  };
}
