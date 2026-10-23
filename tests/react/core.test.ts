import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStore,
  initialState,
  reduce,
  type ContentModel,
} from "../../src/core";

const model: ContentModel = {
  branches: ["n0", "n1", "n2"],
  groups: ["cz-2", "cz-3"],
  active: [
    { id: "a0", ancestors: ["n0", "n1"], canReveal: true },
    { id: "a1", ancestors: ["n0"], canReveal: true },
  ],
};

test("folding cannot change any answer; reveal cannot change branch preferences", () => {
  const start = initialState(model, "front", "paper");
  const revealed = reduce(start, { type: "toggleAnswer", id: "a0" }, model);
  assert.strictEqual(revealed.expanded, start.expanded);
  const folded = reduce(revealed, { type: "toggleNode", id: "n0" }, model);
  assert.strictEqual(folded.revealed, revealed.revealed);
  assert.equal(folded.expanded.n0, false);
  const located = reduce(folded, { type: "locate" }, model);
  assert.equal(located.expanded.n0, true);
  assert.strictEqual(located.revealed, folded.revealed);
});

test("native back defaults visible, every front starts hidden, no shared object state", () => {
  const a = createStore(model, "front", "paper");
  a.dispatch({ type: "toggleAnswer", id: "a0" });
  const b = createStore(model, "front", "paper");
  assert.equal(b.getSnapshot().revealed.a0, false);
  assert.equal(
    createStore(model, "back", "paper").getSnapshot().revealed.a0,
    true,
  );
});

test("disposed store rejects stale commands and removes subscribers", () => {
  const store = createStore(model, "front", "paper");
  let count = 0;
  store.subscribe(() => count++);
  store.dispatch({ type: "toggleAnswer", id: "a0" });
  const before = store.getSnapshot();
  store.dispose();
  store.dispose();
  assert.equal(store.dispatch({ type: "toggleAnswer", id: "a0" }), false);
  assert.strictEqual(store.getSnapshot(), before);
  assert.equal(store.subscriberCount(), 0);
  assert.equal(count, 1);
});

test("unknown target and unavailable native payload never guess an answer", () => {
  const empty: ContentModel = {
    branches: [],
    groups: [],
    active: [{ id: "a0", ancestors: [], canReveal: false }],
  };
  const state = initialState(empty, "front", "paper");
  assert.strictEqual(
    reduce(state, { type: "toggleAnswer", id: "a0" }, empty),
    state,
  );
  assert.strictEqual(
    reduce(state, { type: "toggleNode", id: "missing" }, empty),
    state,
  );
});

test("1000 pure command sequences keep cross-domain invariants", () => {
  let state = initialState(model, "front", "paper");
  for (let i = 0; i < 1000; i++) {
    const before = state;
    state = reduce(
      state,
      { type: "toggleNode", id: model.branches[i % 3] },
      model,
    );
    assert.strictEqual(state.revealed, before.revealed);
    const folded = state;
    state = reduce(state, { type: "toggleAnswer", id: `a${i % 2}` }, model);
    assert.strictEqual(state.expanded, folded.expanded);
  }
});

test("other-group bulk command excludes native answers and derives mixed state", () => {
  let s = initialState(model, "front", "paper");
  s = reduce(s, { type: "toggleGroup", id: "cz-2" }, model);
  assert.equal(s.groups["cz-2"], true);
  assert.equal(s.groups["cz-3"], false);
  const revealed = s.revealed;
  s = reduce(s, { type: "toggleOther" }, model);
  assert.deepEqual(s.groups, { "cz-2": true, "cz-3": true });
  assert.strictEqual(s.revealed, revealed);
  s = reduce(s, { type: "toggleOther" }, model);
  assert.ok(Object.values(s.groups).every((x) => !x));
});
test("ordered reveal and reverse-text hide do not use click history", () => {
  let s = initialState(model, "front", "paper");
  s = reduce(s, { type: "toggleAnswer", id: "a1" }, model);
  s = reduce(s, { type: "revealNext" }, model);
  assert.ok(s.revealed.a0 && s.revealed.a1);
  s = reduce(s, { type: "hideLast" }, model);
  assert.equal(s.revealed.a1, false);
  assert.equal(s.revealed.a0, true);
});
test("search expansion never overrides later manual layout on close", () => {
  let s = initialState(model, "front", "paper");
  s = reduce(s, { type: "toggleNode", id: "n0" }, model);
  assert.equal(s.expanded.n0, false);
  const reveal = s.revealed;
  s = reduce(s, { type: "search", query: "x" }, model);
  s = reduce(
    s,
    {
      type: "setMatches",
      activate: true,
      matches: [{ id: "m0", ancestors: ["n0", "n2"] }],
    },
    model,
  );
  assert.equal(s.searchExpanded.n0, true);
  assert.strictEqual(s.revealed, reveal);
  s = reduce(s, { type: "toggleNode", id: "n2" }, model);
  assert.equal(s.expanded.n2, false);
  s = reduce(s, { type: "closeSearch" }, model);
  assert.equal(s.expanded.n2, false);
  assert.equal(s.expanded.n0, false);
});
