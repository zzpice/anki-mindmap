export type Side = "front" | "back";
export type Theme = "paper" | "bamboo";
export interface ContentModel {
  branches: readonly string[];
  active: readonly {
    id: string;
    ancestors: readonly string[];
    canReveal: boolean;
  }[];
  groups: readonly string[];
}
export interface Match {
  id: string;
  ancestors: readonly string[];
}
export type Overlay =
  | { kind: "diagram" }
  | { kind: "annotation"; id: string }
  | { kind: "image"; src: string; alt: string }
  | null;
export interface State {
  expanded: Readonly<Record<string, boolean>>;
  revealed: Readonly<Record<string, boolean>>;
  groups: Readonly<Record<string, boolean>>;
  theme: Theme;
  intent: number;
  searchOpen: boolean;
  query: string;
  matches: readonly Match[];
  selected: number;
  searchExpanded: Readonly<Record<string, boolean>>;
  overlay: Overlay;
  zoom: number;
}
export type Command =
  | { type: "toggleNode"; id: string }
  | { type: "toggleAnswer"; id: string }
  | { type: "toggleGroup"; id: string }
  | {
      type:
        | "toggleOther"
        | "toggleTree"
        | "revealNext"
        | "hideLast"
        | "locate"
        | "interrupt"
        | "openSearch"
        | "closeSearch";
    }
  | { type: "search"; query: string }
  | { type: "setMatches"; matches: readonly Match[]; activate: boolean }
  | { type: "searchMove"; direction: number }
  | { type: "theme"; value: Theme }
  | { type: "overlay"; value: Overlay }
  | { type: "zoom"; value: number };

export function initialState(
  model: ContentModel,
  side: Side,
  theme: Theme,
): State {
  const expanded = Object.fromEntries(model.branches.map((id) => [id, false]));
  for (const o of model.active)
    for (const id of o.ancestors) expanded[id] = true;
  return {
    expanded,
    revealed: Object.fromEntries(
      model.active.map((o) => [o.id, side === "back"]),
    ),
    groups: Object.fromEntries(model.groups.map((id) => [id, false])),
    theme,
    intent: 0,
    searchOpen: false,
    query: "",
    matches: [],
    selected: 0,
    searchExpanded: {},
    overlay: null,
    zoom: 1,
  };
}
export const isExpanded = (state: State, id: string) =>
  !!(state.searchExpanded[id] || state.expanded[id]);
function openPath(state: State, ancestors: readonly string[]): State {
  return {
    ...state,
    expanded: {
      ...state.expanded,
      ...Object.fromEntries(ancestors.map((id) => [id, true])),
    },
  };
}
function selectMatch(state: State, selected: number): State {
  return {
    ...state,
    selected,
    searchExpanded: Object.fromEntries(
      (state.matches[selected]?.ancestors ?? []).map((id) => [id, true]),
    ),
  };
}

// Sole business authority. No DOM, framework, storage or host API calls here.
export function reduce(
  state: State,
  command: Command,
  model: ContentModel,
): State {
  const next = {
    ...state,
    intent: state.intent + (command.type === "setMatches" ? 0 : 1),
  };
  switch (command.type) {
    case "toggleNode": {
      if (!model.branches.includes(command.id)) return state;
      const searchExpanded = { ...state.searchExpanded };
      delete searchExpanded[command.id];
      return {
        ...next,
        searchExpanded,
        expanded: {
          ...state.expanded,
          [command.id]: !isExpanded(state, command.id),
        },
      };
    }
    case "toggleTree": {
      const value = model.branches.some((id) => !isExpanded(state, id));
      return {
        ...next,
        searchExpanded: {},
        expanded: Object.fromEntries(model.branches.map((id) => [id, value])),
      };
    }
    case "toggleAnswer":
      if (!model.active.find((o) => o.id === command.id)?.canReveal)
        return state;
      return {
        ...next,
        revealed: {
          ...state.revealed,
          [command.id]: !state.revealed[command.id],
        },
      };
    case "toggleGroup":
      if (!model.groups.includes(command.id)) return state;
      return {
        ...next,
        groups: { ...state.groups, [command.id]: !state.groups[command.id] },
      };
    case "toggleOther": {
      const value = model.groups.some((id) => !state.groups[id]);
      return {
        ...next,
        groups: Object.fromEntries(model.groups.map((id) => [id, value])),
      };
    }
    case "revealNext":
    case "hideLast": {
      const reveal = command.type === "revealNext";
      const order = reveal ? model.active : [...model.active].reverse();
      const target = order.find(
        (o) => o.canReveal && state.revealed[o.id] !== reveal,
      );
      if (!target) return state;
      return openPath(
        { ...next, revealed: { ...state.revealed, [target.id]: reveal } },
        target.ancestors,
      );
    }
    case "locate":
      return openPath(next, model.active[0]?.ancestors ?? []);
    case "interrupt":
      return next;
    case "theme":
      return { ...next, theme: command.value };
    case "overlay":
      return { ...next, overlay: command.value };
    case "zoom":
      return { ...next, zoom: Math.max(0.5, Math.min(2, command.value)) };
    case "openSearch":
      return { ...next, searchOpen: true };
    case "closeSearch":
      return {
        ...next,
        searchOpen: false,
        query: "",
        matches: [],
        selected: 0,
        searchExpanded: {},
      };
    case "search":
      return {
        ...next,
        query: command.query,
        matches: [],
        selected: 0,
        searchExpanded: {},
      };
    case "setMatches": {
      const selected = Math.min(
        state.selected,
        Math.max(0, command.matches.length - 1),
      );
      const updated = { ...next, matches: command.matches, selected };
      return command.activate ? selectMatch(updated, 0) : updated;
    }
    case "searchMove": {
      if (!state.matches.length) return state;
      return selectMatch(
        next,
        (state.selected + command.direction + state.matches.length) %
          state.matches.length,
      );
    }
  }
}

export function createStore(model: ContentModel, side: Side, theme: Theme) {
  let state = initialState(model, side, theme),
    alive = true;
  const subscribers = new Set<() => void>();
  return {
    getSnapshot: () => state,
    dispatch(command: Command) {
      if (!alive) return false;
      const next = reduce(state, command, model);
      if (next === state) return false;
      state = next;
      for (const notify of subscribers) notify();
      return true;
    },
    subscribe(notify: () => void) {
      if (!alive) return () => {};
      subscribers.add(notify);
      return () => {
        subscribers.delete(notify);
      };
    },
    subscriberCount: () => subscribers.size,
    dispose() {
      alive = false;
      subscribers.clear();
    },
  };
}
export type Store = ReturnType<typeof createStore>;
