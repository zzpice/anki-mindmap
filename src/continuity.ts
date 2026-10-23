import type { ContentModel, Side, State } from "./core";
import type { ReadingPoint } from "./reading";

const KEY = "anki_mindmap.front-layout.v1";
interface Handoff {
  version: 1;
  owner: string;
  phase: Side;
  key: string;
  time: number;
  expanded: State["expanded"];
  zoom: number;
  point?: ReadingPoint;
}
function signature(text: string) {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `${text.length}:${a >>> 0}:${b >>> 0}`;
}

/** One front-to-back handoff, never a cross-note preference cache. Standard
 * Anki templates have no universal card-ID field, so match inert source plus
 * native ordinal and topology. Every new front invalidates even identical text.
 * Store geometry only, never field text, answers, search or popup state. */
export function reviewContinuity(host: HTMLElement, side: Side, model: ContentModel) {
  const source = host.querySelector<HTMLTemplateElement>("[data-mm-review-source]");
  const ordinal = host.querySelector(".cloze[data-ordinal]")?.getAttribute("data-ordinal");
  const key = source && ordinal !== null && ordinal !== undefined
    ? signature(source.innerHTML + "\u0000" + host.querySelector("[data-mm-deck]")?.textContent +
      "\u0000" + ordinal + "\u0000" + JSON.stringify([model.branches, model.active.map(a => a.ancestors)]))
    : "";
  const owner = `${Date.now()}:${Math.random()}`;
  const read = (): Handoff | undefined => {
    try { return JSON.parse(sessionStorage.getItem(KEY) ?? "null") ?? undefined; }
    catch { return undefined; }
  };
  const write = (value: Handoff) => {
    try { sessionStorage.setItem(KEY, JSON.stringify(value)); } catch { /* optional */ }
  };
  const previous = read();
  const restored = side === "back" && key && previous?.version === 1 &&
    previous.phase === "front" && previous.key === key &&
    Date.now() - previous.time >= 0 && Date.now() - previous.time < 30 * 60_000
    ? previous : undefined;
  if (restored?.point && (!Array.isArray(restored.point.path) ||
      restored.point.path.some(i => !Number.isInteger(i) || i < 0) ||
      restored.point.path.length > 100 || !Number.isFinite(restored.point.top)))
    restored.point = undefined;
  // Consuming a back invalidates the old front's pagehide/dispose callbacks.
  write({ version: 1, owner, phase: side, key, time: Date.now(), expanded: {}, zoom: 1 });
  return {
    restored,
    save(state: State, point?: ReadingPoint) {
      if (side !== "front" || !key || read()?.owner !== owner) return;
      write({ version: 1, owner, phase: side, key, time: Date.now(),
        expanded: state.expanded, zoom: state.zoom, point });
    },
  };
}
