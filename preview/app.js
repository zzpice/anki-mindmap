(() => {
  'use strict';
  const manifest = window.previewManifest;
  const $ = id => document.getElementById(id);
  const controls = Object.fromEntries(['type','scene','card','viewport','theme','compare'].map(id => [id, $(id)]));
  const sizes = {phone:[390,844],narrow:[320,700],landscape:[844,390],desktop:[1280,900]};
  const fromHash = new URLSearchParams(location.hash.slice(1));
  const state = {side:fromHash.get('side') === 'back' ? 'back' : 'front', serial:0};
  const frames = new Map();
  function option(select, value, label) { select.add(new Option(label,value)); }
  for (const type of manifest.types) option(controls.type, type.key, type.name);
  function selectValid(select, value) { if ([...select.options].some(o => o.value === value)) select.value = value; }
  selectValid(controls.type, fromHash.get('type'));
  selectValid(controls.viewport, fromHash.get('viewport') || (innerWidth < 600 ? 'fit' : 'phone'));
  selectValid(controls.theme, fromHash.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  controls.compare.checked = fromHash.get('compare') === '1';
  function updateScenes(preferred) {
    controls.scene.replaceChildren();
    for (const scene of manifest.cases.filter(c => c.type === controls.type.value)) option(controls.scene,scene.key,scene.label);
    selectValid(controls.scene,preferred);
    updateCards(fromHash.get('card'));
  }
  function updateCards(preferred) {
    const scene = controls.scene.value;
    const count = manifest.versions.find(v => v.key === 'current').counts[scene] || 0;
    controls.card.replaceChildren();
    for (let i=0;i<count;i++) option(controls.card,String(i),'第 ' + (i+1) + ' 张');
    selectValid(controls.card,preferred);
    controls.card.disabled = count < 2;
  }
  let hashTimer;
  function saveHash(immediate=false) {
    const query = new URLSearchParams({type:controls.type.value,scene:controls.scene.value,card:controls.card.value,side:state.side,viewport:controls.viewport.value,theme:controls.theme.value,compare:controls.compare.checked?'1':'0'});
    clearTimeout(hashTimer);
    const apply = () => {
      const hash = '#' + query.toString();
      if (location.hash === hash) return;
      try { history.replaceState(null,'',hash); }
      catch { /* Browser history throttling must not interrupt card rendering. */ }
    };
    if (immediate) apply(); else hashTimer=setTimeout(apply,250);
  }
  function updateDimensions() {
    for (const [key, frame] of frames) {
      const panel = $(key+'-panel');
      if (panel.hidden) continue;
      const surface = panel.querySelector('.surface');
      const available = Math.max(1, surface.clientWidth - parseFloat(getComputedStyle(surface).paddingLeft)*2);
      const [width,height] = sizes[controls.viewport.value] || [Math.floor(available),844];
      const scale = Math.min(1,available/width);
      Object.assign(frame.element.style,{width:width+'px',height:height+'px',transform:'scale('+scale+')'});
      Object.assign(panel.querySelector('.frame-space').style,{width:width*scale+'px',height:height*scale+'px'});
      panel.querySelector('.dimensions').textContent=width+' × '+height+(scale<.995?' · '+Math.round(scale*100)+'%':'');
    }
  }
  function send(key, reset=false) {
    const frame=frames.get(key);
    if(!frame.ready || $(key+'-panel').hidden) return;
    frame.pending = state.serial;
    frame.element.contentWindow.postMessage({channel:'anki-preview',event:'render',scene:controls.scene.value,card:Number(controls.card.value),side:state.side,theme:controls.theme.value,reset,serial:state.serial},location.origin);
  }
  function render(reset=false) {
    state.serial++;
    $('baseline-panel').hidden=!controls.compare.checked;
    $('panels').classList.toggle('comparing',controls.compare.checked);
    for (const side of ['front','back']) $(side).setAttribute('aria-pressed',String(state.side===side));
    saveHash();updateDimensions();
    $('status').textContent='正在渲染…';
    send('current',reset);send('baseline',reset);
  }
  window.addEventListener('message', event => {
    if(event.origin!==location.origin || event.data?.channel!=='anki-preview') return;
    const entry=[...frames].find(([,f])=>f.element.contentWindow===event.source);
    if(!entry) return;
    const [key, frame]=entry, message=event.data;
    if(message.event==='ready') { frame.ready=true;send(key,true);return; }
    if(message.serial!==state.serial) return;
    if(message.event==='error') { $('status').textContent='渲染失败：'+message.message; frame.failed=true;return; }
    if(message.event==='rendered') {
      frame.pending=null;frame.failed=false;frame.unavailable=!!message.unavailable;
      const visible=[...frames].filter(([k])=>!$(k+'-panel').hidden).map(([,f])=>f);
      if(visible.every(f=>f.ready&&f.pending===null&&!f.failed)) {
        $('status').dataset.serial=String(state.serial);
        $('status').textContent=visible.some(f=>f.unavailable)?'此示例在某个版本不可用，请查看卡片区域。':'已渲染 · '+(controls.compare.checked?'同一示例，两侧可独立操作':'可直接操作卡片中的控件');
      }
    }
  });
  controls.type.addEventListener('change',()=>{updateScenes();state.side='front';render(true);});
  controls.scene.addEventListener('change',()=>{updateCards();state.side='front';render(true);});
  controls.card.addEventListener('change',()=>{state.side='front';render(true);});
  controls.theme.addEventListener('change',()=>render());
  controls.viewport.addEventListener('change',()=>{updateDimensions();saveHash();});
  controls.compare.addEventListener('change',()=>render());
  for(const side of ['front','back']) $(side).addEventListener('click',()=>{state.side=side;render();});
  $('reset').addEventListener('click',()=>{state.side='front';render(true);});
  $('copy').addEventListener('click',async()=>{
    saveHash(true);
    try { await navigator.clipboard.writeText(location.href);$('status').textContent='已复制此视图链接。'; }
    catch { $('status').textContent='当前浏览器无法自动复制，请复制地址栏链接。'; }
  });
  for(const version of manifest.versions) {
    const link=$(version.key+'-commit');link.textContent=version.commit.slice(0,7)+(version.dirty?' · 本地未提交':'');
    link.href=manifest.repository+'/commit/'+version.commit;
    const element=$(version.key);frames.set(version.key,{element,ready:false,pending:null,failed:false});
    element.src='versions/'+version.key+'/frame.html';
  }
  $('build-info').textContent='生成于 '+new Date(manifest.generatedAt).toLocaleString()+' · Anki '+manifest.anki.version+' · 当前 '+manifest.versions[0].commit.slice(0,7)+' / 对照 '+manifest.versions[1].commit.slice(0,7);
  updateScenes(fromHash.get('scene'));
  let observedWidth = -1, resizeFrame;
  new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    if (width === observedWidth) return;
    observedWidth = width;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(updateDimensions);
  }).observe($('panels'));
  render(true);
})();
