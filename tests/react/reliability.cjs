const assert = require('node:assert/strict');

// Failure injection proves ownership/fallback contracts, not how often a native
// client enters those paths. Real phone certification remains separate.
module.exports = async function reliability(browser, base, renders) {
  const context = await browser.newContext({viewport:{width:390,height:780},isMobile:true,hasTouch:true});
  await context.route('**/reliability-card?*', route => {
    const p=new URL(route.request().url()).searchParams;
    return route.fulfill({contentType:'text/html; charset=utf-8',body:
      '<!doctype html><html class="mobile '+(p.has('android')?'android':p.has('desktop')?'':'iphone')+'"><head>'+
      '<meta name="viewport" content="width=device-width,initial-scale=1">'+`<base href="${base}/">`+
      '</head><body class="card">'+renders[p.get('key')||'welcome'][0][p.get('side')||'front']+'</body></html>'});
  });
  const page=await context.newPage();
  const show=async (query='') => {
    await page.goto(base+'/reliability-card?'+query);
    await page.waitForSelector('#mm-react[data-ready]');
    if(query.includes('android')) await page.waitForSelector('[data-mm-presented]');
  };
  await show();
  const front=await page.evaluate(()=>{
    const r=AnkiMindmap.current();r.dispatch({type:'toggleTree'});r.dispatch({type:'toggleTree'});
    return r.inspect().state;
  });
  await show('side=back');
  const back=await page.evaluate(()=>{
    const r=AnkiMindmap.current(),a=document.querySelector('[data-mm-content] .cloze');
    const visible=a.getClientRects().length>0;
    r.dispatch({type:'toggleNode',id:'n0'});
    return{visible,manuallyFolded:!r.inspect().state.expanded.n0,revealed:r.inspect().state.revealed};
  });
  assert.ok(Object.values(front.expanded).every(x=>!x));assert.ok(back.visible&&back.manuallyFolded);
  await show('key=outer-custom&side=back');
  assert.ok(await page.locator('.cloze').isVisible(),'an outer custom wrapper cannot hide the native current');
  await page.evaluate(()=>AnkiMindmap.current().dispatch({type:'toggleOther'}));
  assert.ok(await page.locator('.cloze').isVisible());
  assert.equal(await page.locator('cloze2_w').isVisible(),false);

  await show('android=1');
  const disposed=await page.evaluate(()=>{
    const h=document.querySelector('#mm-react'),r=AnkiMindmap.current();r.dispose();
    return{visibility:getComputedStyle(h).visibility,text:!!h.textContent.trim(),counts:r.inspect().resources};
  });
  assert.equal(disposed.visibility,'visible');assert.ok(disposed.text);
  assert.ok(Object.values(disposed.counts).every(x=>x===0));
  await show('android=1');
  const cached=await page.evaluate(async()=>{
    const old=AnkiMindmap.current();
    dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
    const readable=getComputedStyle(document.querySelector('#mm-react')).visibility==='visible';
    dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
    await new Promise(requestAnimationFrame);
    return{readable,fresh:AnkiMindmap.current()!==old,ready:!!document.querySelector('[data-ready]'),counts:old.inspect().resources};
  });
  assert.ok(cached.readable&&cached.fresh&&cached.ready);assert.ok(Object.values(cached.counts).every(x=>x===0));

  // Inject both a late registration failure and a React commit failure. The
  // next mount uses the same host and must recover without duplicated handlers.
  for(const fault of ['listener','react']) {
    await show();
    const result=await page.evaluate(fault=>{
      const h=document.querySelector('#mm-react');AnkiMindmap.dispose();
      const ui=h.querySelector('[data-mm-ui]'),content=h.querySelector('[data-mm-content]');
      const original=content.innerHTML;
      let restore;
      if(fault==='listener') {
        const add=window.addEventListener;
        window.addEventListener=function(type,...args){if(type==='gamepadconnected')throw Error('injected listener failure');return add.call(this,type,...args);};
        restore=()=>{window.addEventListener=add;};
      } else {
        const append=ui.appendChild;
        ui.appendChild=function(){throw Error('injected React commit failure');};
        restore=()=>{ui.appendChild=append;};
      }
      let caught=false;
      try{AnkiMindmap.mount(h);}catch{caught=true;}finally{restore();}
      const clean=!AnkiMindmap.current()&&!document.body.classList.contains('mm-review')&&
        !document.documentElement.classList.contains('mm-review-document')&&ui.children.length===0&&content.innerHTML===original;
      const r=AnkiMindmap.mount(h),before=r.inspect().commands;
      document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyK',key:'k',bubbles:true}));
      const once=r.inspect().commands===before+1;
      r.dispose();
      return{caught,clean,once,counts:r.inspect().resources};
    },fault);
    assert.ok(result.caught&&result.clean&&result.once,JSON.stringify({fault,result}));
    assert.ok(Object.values(result.counts).every(x=>x===0));
  }
  await show();
  const releaseFailure=await page.evaluate(()=>{
    const h=document.querySelector('#mm-react'),r=AnkiMindmap.current(),c=h.querySelector('[data-mm-content]');
    Object.defineProperty(c,'innerHTML',{configurable:true,set(){throw Error('injected content restoration failure');}});
    r.dispose();r.dispose();delete c.innerHTML;
    return{slot:!!AnkiMindmap.current(),classes:document.body.className,disposed:h.dataset.mmDisposed,counts:r.inspect().resources};
  });
  assert.equal(releaseFailure.slot,false);assert.ok(!releaseFailure.classes.includes('mm-review'));
  assert.equal(releaseFailure.disposed,'true');assert.ok(Object.values(releaseFailure.counts).every(x=>x===0));
  await show('android=1');
  const optional=await page.evaluate(()=>{
    const h=document.querySelector('#mm-react');AnkiMindmap.dispose();
    const match=window.matchMedia;
    Object.defineProperty(document,'fonts',{configurable:true,get:()=>undefined});window.matchMedia=undefined;
    try{return!!AnkiMindmap.mount(h);}finally{delete document.fonts;window.matchMedia=match;}
  });assert.ok(optional,'optional font and motion APIs cannot prevent review');

  // Empty script is a successful load without an API, unlike network onerror.
  let loads=0;
  await context.route(/_mm_react_.*\.js$/,route=>++loads===1?
    route.fulfill({contentType:'text/javascript',body:''}):route.continue());
  await page.goto(base+'/reliability-card?android=1');await page.waitForSelector('[data-mm-failed]');
  assert.equal(await page.locator('#mm-react').evaluate(e=>getComputedStyle(e).visibility),'visible');
  await page.evaluate(html=>{
    const old=document.querySelector('#mm-react'),source=document.createElement('template');source.innerHTML=html;
    // New and old hosts overlap temporarily. The loader must select this template.
    const area=document.createElement('div');area.append(source.content);document.body.append(area);
    for(const original of area.querySelectorAll('script')){const s=document.createElement('script');s.textContent=original.textContent;original.replaceWith(s);}
    old.remove();
  },renders.welcome[0].back);
  await page.waitForSelector('#mm-react[data-ready]');assert.equal(loads,2);
  assert.equal(await page.evaluate(()=>AnkiMindmap.current().inspect().side),'back');
  await context.unroute(/_mm_react_.*\.js$/);

  for(const width of [320,390]) for(const zoom of [.5,1,2]) {
    await page.setViewportSize({width,height:780});await show();
    await page.evaluate(zoom=>{const r=AnkiMindmap.current();r.dispatch({type:'zoom',value:zoom});r.dispatch({type:'openSearch'});},zoom);
    await page.waitForSelector('.search-box:not([hidden])');
    assert.ok(await page.locator('.search-box').evaluate(e=>[...e.querySelectorAll('button,input')].every(b=>{
      const r=b.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth+.5;
    })),`search fits ${width} at ${zoom}x`);
    assert.equal(await page.locator('.search-box input').evaluate(e=>getComputedStyle(e).fontSize),'16px');
    await page.evaluate(()=>{const r=AnkiMindmap.current();r.dispatch({type:'closeSearch'});r.dispatch({type:'overlay',value:{kind:'diagram'}});});
    await page.waitForSelector('dialog[open]');
    assert.ok(await page.locator('dialog').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+.5;}));
  }
  await show('key=links&desktop=1');await page.locator('[data-mm-content] [data-mm-note]').first().click();
  await page.getByRole('dialog').waitFor();assert.match(await page.getByRole('status').textContent(),/nid:1234567890123/);
  await show('key=annotations&desktop=1');await page.keyboard.press('j');assert.equal(await page.getByRole('dialog').count(),0);
  await page.evaluate(()=>{
    const h=document.querySelector('#mm-react');AnkiMindmap.dispose();
    const p=document.querySelector('a[name="_msocom_42"]').parentElement;
    p.append(' [批注互链|nid1234567890123]');AnkiMindmap.mount(h);
  });
  await page.locator('a[href="#_msocom_42"]').click();await page.getByRole('dialog').waitFor();
  assert.equal(await page.locator('.mm-rich-overlay [data-mm-note]').count(),1);
  await page.locator('.mm-rich-overlay [data-mm-note]').click();assert.match(await page.getByRole('status').textContent(),/nid:1234567890123/);
  await show('key=annotations&desktop=1');await page.locator('a[href="#_msocom_42"]').click();
  await page.locator('.mm-rich-overlay a[href="#_msoanchor_42"]').click();assert.equal(await page.getByRole('dialog').count(),0);

  await show();
  const colours=[];
  for(const theme of ['paper','bamboo']){
    await page.evaluate(theme=>{document.body.classList.add('nightMode');AnkiMindmap.current().dispatch({type:'theme',value:theme});
      const c=document.querySelector('.content');for(const name of ['red','yellow','blue','cyan','pink','olive','grey']){const e=document.createElement('span');e.className='highlight-'+name;e.textContent='高亮';c.append(e);}},theme);
    const ratios=await page.evaluate(()=>{
      const luminance=color=>{const v=color.match(/[\d.]+/g).slice(0,3).map(n=>{const x=Number(n)/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
      const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
      return{title:ratio(getComputedStyle(document.querySelector('.title')).color,getComputedStyle(document.body).backgroundColor),
        highlights:[...document.querySelectorAll('.content [class^="highlight-"]')].map(e=>{const s=getComputedStyle(e);return ratio(s.color,s.backgroundColor);})};
    });assert.ok(ratios.title>7);assert.ok(ratios.highlights.every(r=>r>4.5));colours.push({theme,...ratios});
  }
  // Block the bundle to prove shell geometry/theme already matches the mounted state.
  let release;const gate=new Promise(r=>release=r);
  await context.route(/_mm_react_.*\.js$/,async route=>{await gate;await route.continue();});
  await page.goto(base+'/reliability-card?',{waitUntil:'domcontentloaded'});
  const shell=()=>page.evaluate(()=>{const b=getComputedStyle(document.body),a=getComputedStyle(document.querySelector('.cloze')),t=getComputedStyle(document.querySelector('.title'));return{margin:b.margin,font:b.fontFamily,clozeBg:a.backgroundColor,title:t.color};});
  const pending=await shell();release();await page.waitForSelector('[data-ready]');assert.deepEqual(await shell(),pending);
  await context.close();
  return{failureRollback:'listener and React commit',throwingCleanup:'passed',emptyScriptRetry:'passed',
    overlappingHosts:'passed',androidReadableDisposeAndPersistedResume:'passed',backActivePath:'passed',outerNativeWrapper:'passed',
    zoomPanels:'320/390px at 0.5/1/2x',linksAndAnnotations:'passed incl. unsupported bridge feedback and return',
    emptyDiagram:'passed',pendingShell:'passed',nightContrast:colours};
};
