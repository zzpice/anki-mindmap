const assert = require("node:assert/strict");

module.exports = async function touchWithoutClick(page) {
  const result = await page.evaluate(() => {
    const runtime = AnkiMindmap.current();
    const bullet = [...document.querySelectorAll('.bullet[aria-expanded="false"]')]
      .find((element) => element.getClientRects().length > 0);
    if (!bullet) throw Error("need a visible, closed branch");
    const initial = runtime.inspect().state;
    const send = (type, x, y, count = 1, target = bullet) => {
      const point = { identifier: 1, target, clientX: x, clientY: y };
      const points = count === 2 ? [point, { identifier: 2, target, clientX: x + 20, clientY: y }] : [point];
      // WebKit disallows constructing Touch; feed the same event payload
      // without relying on a browser's automatic compatibility click.
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        touches: { value: type === "touchend" || type === "touchcancel" ? [] : points },
        changedTouches: { value: points },
      });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    send("touchstart", 5, 5);
    const prevented = send("touchend", 5, 5);
    const expanded = bullet.getAttribute("aria-expanded");
    const answers = runtime.inspect().state.revealed;
    bullet.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    const afterCompatibilityClick = bullet.getAttribute("aria-expanded");
    send("touchstart", 5, 5);
    send("touchmove", 5, 55);
    send("touchend", 5, 5); // returning to the start must still count as a scroll
    const afterScroll = bullet.getAttribute("aria-expanded");
    send("touchstart", 5, 5, 2);
    send("touchend", 5, 5);
    const afterPinch = bullet.getAttribute("aria-expanded");
    send("touchstart", 5, 5);
    send("touchcancel", 5, 5);
    send("touchend", 5, 5);
    const afterCancel = bullet.getAttribute("aria-expanded");
    bullet.focus();
    bullet.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, code: "Enter", key: "Enter" }));
    const afterKeyboard = bullet.getAttribute("aria-expanded");
    const active = document.querySelector(".cloze"), placeholder = active.querySelector(".cloze-placeholder");
    send("touchstart", 5, 5, 1, placeholder);
    send("touchend", 5, 5, 1, placeholder);
    const afterReveal = runtime.inspect().state.revealed.a0;
    active.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    const afterRevealClick = runtime.inspect().state.revealed.a0;
    return { initial: initial.revealed, answers, prevented, expanded,
      afterCompatibilityClick, afterScroll, afterPinch, afterCancel, afterKeyboard, afterReveal, afterRevealClick };
  });
  assert.equal(result.prevented, true);
  for (const key of ["expanded", "afterCompatibilityClick", "afterScroll", "afterPinch", "afterCancel"])
    assert.equal(result[key], "true", key);
  assert.equal(result.afterKeyboard, "false");
  assert.equal(result.afterReveal, true);
  assert.equal(result.afterRevealClick, true);
  assert.deepEqual(result.answers, result.initial);
};
