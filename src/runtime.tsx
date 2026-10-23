import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { createStore, type Command, type Side, type Theme } from "./core";
import { readContent } from "./content";
import { Interface } from "./ui";
import { nativeMath } from "./math";
import { platform } from "./platform";
import { resources } from "./resources";
import { presentCard } from "./presentation";
import { bindTap } from "./tap";

const SLOT = Symbol.for("anki-mindmap.react.runtime.v1");
const PREF = "anki_mindmap.preferences.v1";
interface Runtime {
  dispose(): void;
  dispatch(command: Command): void;
  inspect(): ReturnType<typeof createInspection>;
}
function createInspection(
  store: ReturnType<typeof createStore>,
  alive: boolean,
  effects: number,
  resourceCounts: object,
  diagnostics: string[],
  scrolls: number,
  commands: number,
) {
  return {
    alive,
    state: store.getSnapshot(),
    diagnostics,
    scrolls,
    commands,
    resources: {
      ...resourceCounts,
      subscribers: store.subscriberCount(),
      reactRoots: alive ? 1 : 0,
      effects,
    },
  };
}
type HostDocument = Document & { [SLOT]?: Runtime };
export function current() {
  return (document as HostDocument)[SLOT];
}
export function dispose() {
  current()?.dispose();
}

export function mount(host: HTMLElement): Runtime {
  const doc = host.ownerDocument as HostDocument;
  doc[SLOT]?.dispose();
  const content = host.querySelector<HTMLElement>("[data-mm-content]"),
    ui = host.querySelector<HTMLElement>("[data-mm-ui]");
  if (!content || !ui) throw Error("Anki native content container unavailable");
  const originalContent = content.innerHTML;
  const fallback = host.querySelector<HTMLElement>("[data-mm-notes-fallback]");
  const usedFallback =
    !content.querySelector(".cloze") && !!fallback?.querySelector(".cloze");
  if (usedFallback) {
    const section = document.createElement("section");
    section.className = "mm-field-fallback";
    const label = document.createElement("p");
    label.className = "mm-context-label";
    label.textContent = "补充字段中的当前考查";
    section.append(
      label,
      ...[...fallback!.childNodes].map((n) => n.cloneNode(true)),
    );
    content.append(section);
  }
  const side: Side = host.dataset.side === "back" ? "back" : "front";
  const math = nativeMath(),
    renderer = readContent(content, side, math),
    bridge = platform();
  let theme: Theme = "paper";
  try {
    const saved = JSON.parse(localStorage.getItem(PREF) ?? "null");
    if (saved?.version === 1 && saved.theme === "bamboo") theme = "bamboo";
  } catch {
    /* review remains usable */
  }
  const store = createStore(renderer.model, side, theme);
  // The skin owns these host decorations only during this card's lifetime.
  // In particular, unrelated Anki note types must never inherit our page margins.
  const body = doc.body,
    html = doc.documentElement;
  const previousTheme = body.getAttribute("data-mm-theme");
  const hadBodyClass = body.classList.contains("mm-review");
  const hadHtmlClass = html.classList.contains("mm-review-document");
  body.classList.add("mm-review");
  html.classList.add("mm-review-document");
  let alive = true,
    effects = 0,
    scrolls = 0,
    commands = 0;
  const valid = () =>
    alive &&
    host.isConnected &&
    content.isConnected &&
    ui.isConnected &&
    host.contains(content) &&
    host.contains(ui) &&
    renderer.isIntact();
  const scope = resources(valid);
  const project = () => {
    if (!valid()) return;
    renderer.project(store.getSnapshot());
    const theme = store.getSnapshot().theme;
    if (host.dataset.theme !== theme) host.dataset.theme = theme;
    if (body.dataset.mmTheme !== theme) body.dataset.mmTheme = theme;
    // Fixed-pixel node typography is part of the original design. Scale the
    // whole card so controller zoom still includes its floating controls.
    const zoom = String(store.getSnapshot().zoom);
    if (host.style.zoom !== zoom) host.style.zoom = zoom;
  };
  const unsubscribe = store.subscribe(project);
  let cancelAuto: (() => void) | undefined;
  const scroll = (target?: HTMLElement) => {
    if (valid() && target) {
      target.scrollIntoView({ block: "center", behavior: "auto" });
      scrolls++;
    }
  };
  const updateSearch = (activate: boolean) => {
    const matches = renderer.search(store.getSnapshot().query);
    store.dispatch({ type: "setMatches", matches, activate });
    renderer.highlight(store.getSnapshot().selected);
    if (activate && matches.length) scroll(renderer.matchElement(0));
  };
  const dispatch = (command: Command) => {
    if (!valid()) return;
    cancelAuto?.();
    cancelAuto = undefined;
    const before = store.getSnapshot();
    if (!store.dispatch(command)) return;
    commands++;
    if (command.type === "search") updateSearch(true);
    else if (
      [
        "toggleAnswer",
        "toggleGroup",
        "toggleOther",
        "revealNext",
        "hideLast",
      ].includes(command.type) &&
      store.getSnapshot().query
    )
      updateSearch(false);
    if (command.type === "locate") scroll(renderer.firstActive());
    if (command.type === "revealNext" || command.type === "hideLast") {
      const changed = renderer.model.active.find(
        (o) => before.revealed[o.id] !== store.getSnapshot().revealed[o.id],
      );
      if (changed) scroll(renderer.activeElement(changed.id));
    }
    if (command.type === "searchMove") {
      renderer.highlight(store.getSnapshot().selected);
      scroll(renderer.matchElement(store.getSnapshot().selected));
    }
    if (command.type === "closeSearch") renderer.search("");
    if (command.type === "theme") {
      try {
        localStorage.setItem(
          PREF,
          JSON.stringify({ version: 1, theme: command.value }),
        );
      } catch {
        /* state still updates */
      }
    }
  };
  const activateContent = (target: Element, event: Event): boolean => {
    const annotation = target.closest<HTMLAnchorElement>(
      'a[href^="#_msocom_"]',
    );
    if (annotation && renderer.annotation(annotation.hash.slice(1))) {
      event.preventDefault();
      const overlay = store.getSnapshot().overlay;
      dispatch({
        type: "overlay",
        value:
          overlay?.kind === "annotation" &&
          overlay.id === annotation.hash.slice(1)
            ? null
            : { kind: "annotation", id: annotation.hash.slice(1) },
      });
      return true;
    }
    const note = target.closest<HTMLElement>("[data-mm-note]");
    if (note) {
      event.preventDefault();
      bridge.note(note.dataset.mmNote!);
      return true;
    }
    if (target.closest('a,input,textarea,select,[contenteditable="true"]'))
      return false;
    if (target instanceof HTMLImageElement) {
      dispatch({
        type: "overlay",
        value: {
          kind: "image",
          src: target.getAttribute("src") ?? "",
          alt: target.alt,
        },
      });
      return true;
    }
    const node = renderer.targetNode(target),
      answer = renderer.targetAnswer(target),
      group = renderer.targetGroup(target);
    if (node) dispatch({ type: "toggleNode", id: node });
    else if (answer) dispatch({ type: "toggleAnswer", id: answer });
    else if (group) dispatch({ type: "toggleGroup", id: group });
    return !!(node || answer || group);
  };
  bindTap(content, scope, activateContent);
  if (html.classList.contains("android")) {
    bindTap(ui, scope, (target, event) => {
      if (event.type !== "touchend") return false;
      const button = target.closest<HTMLButtonElement>("nav button");
      if (!button || !ui.contains(button) || button.disabled) return false;
      // Reuse React's existing click handler immediately on release instead
      // of waiting for the WebView's later compatibility click.
      button.click();
      return true;
    });
  }
  scope.listen(
    doc,
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        store.getSnapshot().overlay &&
        target &&
        !target.closest('.mm-dialog,#left-floating-widget,a[href^="#_msocom_"]')
      )
        dispatch({ type: "overlay", value: null });
    },
    { capture: true },
  );
  scope.listen(doc, "keydown", (event) => {
    const e = event as KeyboardEvent;
    if (e.isComposing || e.repeat) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      dispatch({ type: "openSearch" });
      return;
    }
    if (e.key === "Escape") {
      if (store.getSnapshot().overlay)
        dispatch({ type: "overlay", value: null });
      else dispatch({ type: "closeSearch" });
      return;
    }
    const target = e.target instanceof Element ? e.target : null;
    const node = target && renderer.targetNode(target);
    if (node && (e.code === "Enter" || e.code === "Space") &&
        !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      dispatch({ type: "toggleNode", id: node });
      return;
    }
    if (
      target?.closest(
        'input,textarea,select,[contenteditable="true"],button,dialog',
      ) ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    if ((e.key === "Enter" || e.key === " ") && target) {
      const node = renderer.targetNode(target);
      if (node) {
        e.preventDefault();
        dispatch({ type: "toggleNode", id: node });
        return;
      }
    }
    const mapping: Record<string, Command> = {
      KeyH: { type: "locate" },
      KeyK: { type: "toggleTree" },
      KeyL: { type: "toggleOther" },
      BracketRight: { type: "revealNext" },
      BracketLeft: { type: "hideLast" },
      KeyC: {
        type: "theme",
        value: store.getSnapshot().theme === "paper" ? "bamboo" : "paper",
      },
      KeyJ: {
        type: "overlay",
        value:
          store.getSnapshot().overlay?.kind === "diagram"
            ? null
            : { kind: "diagram" },
      },
    };
    if (mapping[e.code]) {
      e.preventDefault();
      dispatch(mapping[e.code]);
    }
  });
  for (const name of ["wheel", "touchstart", "pointerdown", "scroll"])
    scope.listen(doc, name, () => {
      // The Android host's own load-time reset is not manual navigation.
      // Wheel/touch/pointer input still cancels our pending initial location.
      if (name === "scroll" && html.classList.contains("android") &&
          !host.dataset.mmPresented) return;
      dispatch({ type: "interrupt" });
    }, {
      passive: true,
      capture: true,
    });
  scope.listen(window, "pagehide", () => runtime.dispose());
  // Per-device button edges are seeded on every side: held flip cannot become a grade.
  const gamepads = () => {
    try {
      return navigator.getGamepads?.() ?? [];
    } catch {
      return [];
    }
  };
  const held = new Map<string, boolean[]>();
  const lastFire = new Map<string, number>();
  const keyOf = (gp: Gamepad) => `${gp.index}:${gp.id}`;
  for (const gp of gamepads())
    if (gp)
      held.set(
        keyOf(gp),
        gp.buttons.map((b) => b.pressed || b.value > 0.5),
      );
  let lastTime = performance.now(),
    waitingForHost = false,
    controllerPolling = false;
  const hostAction = (action: "flip" | "again" | "hard" | "good" | "easy") => {
    waitingForHost = true;
    if (!bridge.native(action)) waitingForHost = false;
    else
      scope.later(() => {
        waitingForHost = false;
      }, 400);
  };
  const poll = (time: number) => {
    const dt = Math.min(50, time - lastTime);
    lastTime = time;
    const connected = gamepads();
    if (!Array.from(connected).some(Boolean)) {
      controllerPolling = false;
      return;
    }
    for (const gp of connected) {
      if (!gp) continue;
      const key = keyOf(gp),
        previous =
          held.get(key) ?? gp.buttons.map((b) => b.pressed || b.value > 0.5);
      const pressed = gp.buttons.map((b) => b.pressed || b.value > 0.5);
      for (let i = 0; i < pressed.length; i++) {
        if (
          !pressed[i] ||
          previous[i] ||
          waitingForHost ||
          time - (lastFire.get(`${key}:${i}`) ?? -Infinity) < 300
        )
          continue;
        lastFire.set(`${key}:${i}`, time);
        if (side === "front" && i === 1) hostAction("flip");
        else if (side === "back" && i < 4)
          hostAction((["again", "good", "hard", "easy"] as const)[i]);
        else if (i === 4) dispatch({ type: "hideLast" });
        else if (i === 5) dispatch({ type: "revealNext" });
        else if (i === 6) dispatch({ type: "toggleTree" });
        else if (i === 7) dispatch({ type: "toggleOther" });
        else if (i === 10) dispatch({ type: "locate" });
        else if (i === 11)
          dispatch({
            type: "theme",
            value: store.getSnapshot().theme === "paper" ? "bamboo" : "paper",
          });
      }
      held.set(key, pressed);
      if (!waitingForHost && Math.abs(gp.axes[1] ?? 0) > 0.25) {
        dispatch({ type: "interrupt" });
        window.scrollBy(0, gp.axes[1] * dt * 0.6);
      }
      if (!waitingForHost && Math.abs(gp.axes[3] ?? 0) > 0.25)
        dispatch({
          type: "zoom",
          value: store.getSnapshot().zoom - gp.axes[3] * dt * 0.0003,
        });
    }
    scope.frame(poll);
  };
  const startControllers = () => {
    if (controllerPolling || !Array.from(gamepads()).some(Boolean)) return;
    controllerPolling = true;
    lastTime = performance.now();
    scope.frame(poll);
  };
  scope.listen(window, "gamepadconnected", startControllers);
  scope.listen(window, "gamepaddisconnected", () => {
    for (const [key] of held)
      if (!Array.from(gamepads()).some((gp) => gp && keyOf(gp) === key))
        held.delete(key);
  });
  startControllers();
  const react = createRoot(ui);
  const lifecycle = (delta: number) => {
    effects += delta;
  };
  flushSync(() => react.render(
    <StrictMode>
      <Interface
        store={store}
        model={renderer.model}
        side={side}
        deck={host.querySelector("[data-mm-deck]")?.textContent?.trim() ?? ""}
        diagram={host.querySelector("[data-mm-diagram]")?.innerHTML ?? ""}
        annotation={renderer.annotation}
        annotationAnchor={renderer.annotationAnchor}
        dispatch={dispatch}
        lifecycle={lifecycle}
      />
    </StrictMode>,
  ));
  project();
  // Position before the next paint rather than showing the top of the tree
  // for 100 ms on every flip. Manual input still cancels this card-owned frame.
  cancelAuto = presentCard(host, scope, () => scroll(renderer.firstActive()));
  scope.observe(doc.documentElement, () => {
    if (!valid()) runtime.dispose();
  });
  // Anki's reviewer assigns body.className in onUpdateHook AFTER executing
  // template scripts. Restore only our decorations, preserving host classes
  // such as nightMode. This observer is card-owned and disconnected on disposal.
  const restoreSkin = () => {
    if (!valid()) return;
    if (!body.classList.contains("mm-review")) body.classList.add("mm-review");
    if (!html.classList.contains("mm-review-document"))
      html.classList.add("mm-review-document");
  };
  scope.observe(body, restoreSkin, {
    attributes: true,
    attributeFilter: ["class"],
  });
  scope.observe(html, restoreSkin, {
    attributes: true,
    attributeFilter: ["class"],
  });
  const runtime: Runtime = {
    dispatch,
    inspect: () => ({
      ...createInspection(
        store,
        alive,
        effects,
        scope.inspect(),
        [...renderer.diagnostics, ...math.warnings],
        scrolls,
        commands,
      ),
      side,
      math: math.inspect(),
    }),
    dispose() {
      if (!alive) return;
      alive = false;
      scope.dispose();
      unsubscribe();
      react.unmount();
      store.dispose();
      const intact = renderer.isIntact();
      renderer.restore();
      if (usedFallback && intact) content.innerHTML = originalContent;
      host.style.removeProperty("zoom");
      if (!hadBodyClass) body.classList.remove("mm-review");
      if (!hadHtmlClass) html.classList.remove("mm-review-document");
      if (previousTheme === null) delete body.dataset.mmTheme;
      else body.setAttribute("data-mm-theme", previousTheme);
      delete host.dataset.theme;
      delete host.dataset.ready;
      delete host.dataset.mmPresented;
      if (doc[SLOT] === runtime) delete doc[SLOT];
    },
  };
  doc[SLOT] = runtime;
  host.dataset.ready = "true";
  return runtime;
}
