// One interaction model for both sides. Back answers come from native rendered HTML,
// while front answers come from Anki's data-cloze; neither changes card generation.
var mindmapClozeStates = new WeakMap();
function toggle(element) {
    if (!element || !element.matches || !element.matches('.linkRender .cloze')) return;
    var state = mindmapClozeStates.get(element);
    if (!state) {
        var payload = element.getAttribute('data-cloze');
        var placeholder = element.querySelector('.cloze-placeholder');
        var answer = element.innerHTML;
        if (payload !== null) {
            var container = document.createElement('div');
            container.innerHTML = payload;
            var custom = container.querySelector('cloze2');
            answer = custom ? custom.innerHTML : payload;
        }
        state = { answer: answer, prompt: placeholder ? placeholder.innerHTML : '[...]', revealed: !placeholder };
        mindmapClozeStates.set(element, state);
    }
    state.revealed = !state.revealed;
    if (state.revealed) {
        element.innerHTML = state.answer;
        if (typeof renderMindmapLinks === 'function') renderMindmapLinks(element);
    } else {
        element.innerHTML = '';
        var placeholder = document.createElement('span');
        placeholder.className = 'cloze-placeholder';
        placeholder.innerHTML = state.prompt;
        element.appendChild(placeholder);
        if (element.hasAttribute('data-cloze')) {
            var frosted = document.createElement('span');
            frosted.className = 'cloze-frosted';
            element.appendChild(frosted);
        }
    }
}
(function () {
    (window.ankiMindmapClozeListeners || []).forEach(function (entry) {
        document.removeEventListener(entry[0], entry[1], true);
    });
    var listeners = window.ankiMindmapClozeListeners = [];
    var root = document.querySelector('.linkRender');
    var touch = null;
    function control(target) {
        if (!root || !root.isConnected || !target) return null;
        target = target.nodeType === 1 ? target : target.parentElement;
        if (!target || !root.contains(target) || target.closest('a[href]')) return null;
        return target.closest('.cloze') || target.closest('cloze2_w, cloze2');
    }
    function activate(element, event) {
        event.preventDefault();
        event.stopPropagation();
        if (element.matches('.cloze')) toggle(element);
        else toggleReveal(element);
    }
    function listen(type, handler) {
        document.addEventListener(type, handler, {capture: true, passive: false});
        listeners.push([type, handler]);
    }
    listen('click', function (event) {
        var element = control(event.target);
        if (element) activate(element, event);
    });
    // Touch is handled directly: some WebViews do not synthesize click for these
    // custom controls. Cancelling only a completed tap prevents a second click;
    // scrolling, multi-touch and links keep their native behavior on every UA.
    listen('touchstart', function (event) {
        var element = control(event.target);
        var point = event.touches[0];
        touch = element && event.touches.length === 1
            ? {element: element, id: point.identifier, x: point.clientX, y: point.clientY} : null;
    });
    listen('touchmove', function (event) {
        var point = event.touches[0];
        if (touch && (event.touches.length !== 1 || point.identifier !== touch.id ||
            Math.abs(point.clientX - touch.x) >= 10 || Math.abs(point.clientY - touch.y) >= 10)) touch = null;
    });
    listen('touchcancel', function () { touch = null; });
    listen('touchend', function (event) {
        var started = touch;
        touch = null;
        if (!started || event.touches.length || event.changedTouches.length !== 1) return;
        var point = event.changedTouches[0];
        if (point.identifier !== started.id || control(started.element) !== started.element ||
            Math.abs(point.clientX - started.x) >= 10 || Math.abs(point.clientY - started.y) >= 10) return;
        activate(started.element, event);
    });
})();
