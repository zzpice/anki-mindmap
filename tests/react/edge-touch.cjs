const assert = require("node:assert/strict");

module.exports = async function edgeTouch(page) {
  const result = await page.evaluate(() => {
    const runtime = AnkiMindmap.current();
    const touch = (element, type, y = 5) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const point = { identifier: 1, target: element, clientX: 5, clientY: y };
      Object.defineProperties(event, { touches: { value: type === "touchend" ? [] : [point] },
        changedTouches: { value: [point] } });
      element.dispatchEvent(event);
    };
    const rows = [];
    for (const selector of [".floating-button", ".custom2-button", ".custom-button", "#left-floating-widget"]) {
      const button = document.querySelector(selector);
      touch(button, "touchstart");
      const before = runtime.inspect().commands;
      const start = performance.now();
      touch(button, "touchend");
      const after = runtime.inspect().commands;
      const elapsed = performance.now() - start;
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      rows.push({ selector, onRelease: after - before, afterClick: runtime.inspect().commands - after,
        releaseHandlerMs: elapsed });
    }
    runtime.dispatch({ type: "overlay", value: null });
    const button = document.querySelector(".custom2-button");
    touch(button, "touchstart");
    const beforeDrag = runtime.inspect().commands;
    touch(button, "touchmove", 50);
    touch(button, "touchend", 50);
    const dragCommands = runtime.inspect().commands - beforeDrag;
    // Interrupting auto-location must not dirty every node on a large tree.
    const content = document.querySelector("[data-mm-content]");
    const observer = new MutationObserver(() => {});
    observer.observe(content, { attributes: true, childList: true, subtree: true });
    for (let i = 0; i < 50; i++) runtime.dispatch({ type: "interrupt" });
    const redundantMutations = observer.takeRecords().length;
    observer.disconnect();
    return { rows, dragCommands, redundantMutations };
  });
  for (const row of result.rows) {
    assert.equal(row.onRelease, 1, `${row.selector} must act before a compatibility click`);
    assert.equal(row.afterClick, 0, `${row.selector} compatibility click must not repeat`);
  }
  assert.equal(result.dragCommands, 0);
  assert.equal(result.redundantMutations, 0);
  return result;
};
