// Preview adapter only. The card HTML, CSS and media scripts remain unmodified.
(() => {
  'use strict';
  const origin = location.origin;
  const qa = document.getElementById('qa');
  // Each pane owns ephemeral memory, including when browser storage is blocked.
  // Flips replace #qa within this document; changing/reloading a scene resets it.
  const memory = new Map();
  Object.defineProperty(window, 'sessionStorage', {value: {
    getItem: key => memory.get(String(key)) ?? null,
    setItem: (key, value) => memory.set(String(key), String(value)),
    removeItem: key => memory.delete(String(key)),
    clear: () => memory.clear(),
    key: index => [...memory.keys()][index] ?? null,
    get length() { return memory.size; },
  }});
  const localMemory = new Map();
  Object.defineProperty(window, 'localStorage', {value: {
    getItem: key => localMemory.get(String(key)) ?? null,
    setItem: (key, value) => localMemory.set(String(key), String(value)),
    removeItem: key => localMemory.delete(String(key)),
    clear: () => localMemory.clear(),
    key: index => [...localMemory.keys()][index] ?? null,
    get length() { return localMemory.size; },
  }});
  let scene = '', queue = Promise.resolve();
  const mediaConditions = new WeakMap();
  function emulateTheme(theme) {
    function visit(rules) {
      for (const rule of rules) {
        if (rule.media && /prefers-color-scheme/.test(mediaConditions.get(rule) || rule.media.mediaText)) {
          if (!mediaConditions.has(rule)) mediaConditions.set(rule, rule.media.mediaText);
          rule.media.mediaText = mediaConditions.get(rule).replace(/\(prefers-color-scheme:\s*(dark|light)\)/g, (_, scheme) => scheme === theme ? '(min-width: 0px)' : '(max-width: -1px)');
        }
        if (rule.cssRules) visit(rule.cssRules);
      }
    }
    for (const sheet of document.styleSheets) visit(sheet.cssRules);
  }
  function notify(data) { parent.postMessage({channel:'anki-preview', ...data}, origin); }
  async function render(state) {
    document.body.dataset.previewSide = state.side;
    document.body.dataset.previewScene = state.scene;
    const record = window.previewCards[state.scene];
    if (!record) throw new Error('示例不存在');
    document.documentElement.style.colorScheme = state.theme;
    document.body.classList.toggle('nightMode', state.theme === 'dark');
    document.body.classList.toggle('night_mode', state.theme === 'dark');
    if (scene !== state.scene || state.reset) { window.sessionStorage.clear(); window.localStorage.clear(); }
    scene = state.scene;
    const card = record.cards?.[state.card];
    if (!card) {
      qa.textContent = record.unavailable || '此版本没有对应卡片。';
      notify({event:'rendered', serial:state.serial, unavailable:true});
      return;
    }
    // Match reviewer's DOM replacement and sequential execution of card scripts.
    qa.innerHTML = card[state.side];
    for (const old of Array.from(qa.querySelectorAll('script'))) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        for (const attr of old.attributes) script.setAttribute(attr.name, attr.value);
        script.textContent = old.textContent;
        if (old.src) { script.onload = resolve; script.onerror = () => reject(new Error('模板脚本加载失败')); }
        old.replaceWith(script);
        if (!script.src) resolve();
      });
    }
    emulateTheme(state.theme);
    await Promise.all([...qa.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (state.side === 'front') scrollTo(0, 0);
    // Back starts at the same native answer anchor as the reviewer.
    else {
      const answer = document.getElementById('answer');
      if (answer) answer.scrollIntoView();
    }
    notify({event:'rendered', serial:state.serial, width:innerWidth, height:innerHeight});
  }
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== origin || event.data?.channel !== 'anki-preview' || event.data.event !== 'render') return;
    const state = event.data;
    queue = queue.then(() => render(state)).catch(error => notify({event:'error', serial:state.serial, message:error.message}));
  });
  // Example source links open separately instead of replacing the preview frame.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (link && /^https?:/.test(link.href) && !link.getAttribute('href').startsWith('#')) {
      link.target = '_blank'; link.rel = 'noopener noreferrer';
    }
  });
  notify({event:'ready'});
})();
