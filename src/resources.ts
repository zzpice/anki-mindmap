/** Every cancellable resource belongs to one card render, including controller polling. */
export function resources(valid: () => boolean) {
  let alive = true;
  const listeners = new Set<() => void>(),
    timers = new Set<number>(),
    frames = new Set<number>(),
    observers = new Set<MutationObserver | ResizeObserver>();
  return {
    listen(
      target: EventTarget,
      type: string,
      callback: EventListener,
      options?: AddEventListenerOptions,
    ) {
      if (!alive) return;
      const guarded: EventListener = (event) => {
        if (alive && valid()) callback(event);
      };
      target.addEventListener(type, guarded, options);
      listeners.add(() => target.removeEventListener(type, guarded, options));
    },
    later(callback: () => void, delay: number) {
      if (!alive || !valid()) return () => {};
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (alive && valid()) callback();
      }, delay);
      timers.add(id);
      return () => {
        window.clearTimeout(id);
        timers.delete(id);
      };
    },
    frame(callback: (time: number) => void) {
      if (!alive || !valid()) return () => {};
      const id = requestAnimationFrame((time) => {
        frames.delete(id);
        if (alive && valid()) callback(time);
      });
      frames.add(id);
      return () => {
        cancelAnimationFrame(id);
        frames.delete(id);
      };
    },
    observe(
      target: Node,
      callback: () => void,
      options: MutationObserverInit = { childList: true, subtree: true },
    ) {
      if (!alive) return;
      // Removal detection must run even after valid() becomes false.
      const observer = new MutationObserver(() => {
        if (alive) callback();
      });
      observer.observe(target, options);
      observers.add(observer);
    },
    resize(target: Element, callback: () => void) {
      if (!alive || typeof ResizeObserver === "undefined") return () => {};
      const observer = new ResizeObserver(() => {
        if (alive && valid()) callback();
      });
      observer.observe(target);
      observers.add(observer);
      return () => { observer.disconnect(); observers.delete(observer); };
    },
    inspect: () => ({
      listeners: listeners.size,
      timers: timers.size,
      frames: frames.size,
      observers: observers.size,
    }),
    dispose() {
      if (!alive) return;
      alive = false;
      for (const remove of listeners) remove();
      listeners.clear();
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const id of frames) cancelAnimationFrame(id);
      frames.clear();
      for (const observer of observers) observer.disconnect();
      observers.clear();
    },
  };
}
