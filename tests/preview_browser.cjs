// Test the generated site under a project subpath, with real iframe interactions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium,webkit} = require('playwright');
const root=path.resolve(__dirname,'../build/preview-site');
const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(req.url.split('?')[0]).replace(/^\/anki-mindmap\//,'');
  const file=path.resolve(root,relative||'index.html');
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
  for(const engine of [chromium,webkit]) {
   if(process.env.ANKI_PREVIEW_BROWSER && engine.name()!==process.env.ANKI_PREVIEW_BROWSER) continue;
   const browser=await engine.launch();
   try {
    const page=await browser.newPage({viewport:{width:1440,height:1100},colorScheme:'dark'});
    const errors=[],failures=[],external=[];
    const mindmapGeometry=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)failures.push(r.url());});
    page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
    await page.goto('http://127.0.0.1:'+server.address().port+'/anki-mindmap/');
    const ready=()=>page.locator('#status').filter({hasText:/已渲染|某个版本不可用/}).waitFor();
    const change=async action=>{
      const before=await page.locator('#status').getAttribute('data-serial');
      await action();
      await page.waitForFunction(before=>{const el=document.querySelector('#status');return el.dataset.serial!==before&&/已渲染|某个版本不可用/.test(el.textContent);},before);
    };
    const frame=()=>page.frames().find(f=>f.url().includes('/versions/current/frame.html'));
    const baseline=()=>page.frames().find(f=>f.url().includes('/versions/baseline/frame.html'));
    await ready();
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
    // Every public/complex scene, both sides; alternate themes under a dark OS.
    for(const scene of manifest.cases) {
      if(await page.locator('#type').inputValue()!==scene.type){await change(()=>page.selectOption('#type',scene.type));}
      await change(()=>page.selectOption('#scene',scene.key));
      for(const theme of ['light','dark']) {
        await change(()=>page.selectOption('#theme',theme));
        const colors=await frame().evaluate(()=>({bg:getComputedStyle(document.body).backgroundColor,width:innerWidth}));
        assert.equal(colors.width,390);
        for(const side of ['front','back']) {
          await change(()=>page.locator('#'+side).click());
          const geometry=await frame().evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
          if(scene.type==='mindmap') {
            mindmapGeometry.push({scene:scene.key,theme,side,...geometry});
            assert.equal(await frame().locator('.linkRender').isVisible(),true);
          } else assert.ok(geometry.scrollWidth<=geometry.width,scene.key+' '+theme+' '+side);
        }
      }
    }
    await change(()=>page.locator('#compare').check());
    await frame().locator('#left-floating-widget').click();
    assert.equal(await frame().locator('#popup').isVisible(), true);
    assert.equal(await baseline().locator('#popup').isVisible(), false);
    await frame().locator('#left-floating-widget').click();
    assert.equal(await frame().locator('#popup').isVisible(), false);
    for(const [preset,width,height] of [['narrow',320,700],['landscape',844,390],['desktop',1280,900]]) {
      await page.selectOption('#viewport',preset);
      await page.waitForFunction(width=>document.querySelector('#current').contentWindow.innerWidth===width,width);
      assert.deepEqual(await frame().evaluate(()=>[innerWidth,innerHeight]),[width,height]);
    }
    await change(()=>page.selectOption('#type','mindmap'));
    await change(()=>page.selectOption('#scene','complex-mindmap'));
    assert.equal(await frame().locator('#popup').isVisible(),false);
    assert.equal(await frame().locator('.custom2-button').isVisible(),true);
    await change(()=>page.locator('#back').click());
    assert.equal(await frame().locator('#popup').isVisible(),false);
    assert.equal(await frame().locator('#popup2 img').count(),1);
    assert.match(await frame().locator('#popup').textContent(),/个人错因/);
    await change(()=>page.selectOption('#card','1'));await change(()=>page.locator('#back').click());
    assert.equal(await frame().locator('.linkRender .cloze').count()>0,true);
    // Deep links restore scene, side, card, dimensions and both panes on reload.
    await change(()=>page.selectOption('#type','mindmap'));await change(()=>page.selectOption('#scene','complex-mindmap'));
    await change(()=>page.selectOption('#card','1'));await change(()=>page.locator('#back').click());
    await page.waitForFunction(()=>{const h=new URLSearchParams(location.hash.slice(1));return h.get('scene')==='complex-mindmap'&&h.get('card')==='1'&&h.get('side')==='back';});
    const hash=await page.evaluate(()=>location.hash);await page.reload();await ready();
    assert.equal(await page.evaluate(()=>location.hash),hash);
    assert.equal(await page.locator('#card').inputValue(),'1');
    assert.equal(await frame().locator('.linkRender .cloze').count()>0,true);
    await page.setViewportSize({width:390,height:844});
    await page.selectOption('#viewport','fit');await change(()=>page.selectOption('#theme','light'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.ok(await frame().evaluate(()=>innerWidth>=300&&innerWidth<=390));
    const out=path.resolve(__dirname,'../build/preview-screenshots');fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(path.join(out,engine.name()+'-mindmap-geometry.json'),JSON.stringify(mindmapGeometry,null,2));
    await page.setViewportSize({width:1440,height:1100});
    await page.selectOption('#viewport','phone');
    await page.waitForFunction(()=>document.querySelector('#current').contentWindow.innerWidth===390);
    await change(()=>page.locator('#front').click());
    await page.screenshot({path:path.join(out,engine.name()+'-mindmap-front-compare-phone.png'),fullPage:true});
    await change(()=>page.locator('#back').click());
    await page.screenshot({path:path.join(out,engine.name()+'-mindmap-back-compare-phone.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await change(()=>page.locator('#compare').uncheck());
    await page.screenshot({path:path.join(out,engine.name()+'-phone.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1100});await page.selectOption('#viewport','phone');await change(()=>page.locator('#compare').check());
    await page.screenshot({path:path.join(out,engine.name()+'-compare.png'),fullPage:true});
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);assert.deepEqual(external,[]);
    console.log(engine.name()+': mindmap preview scenes, theme override, independent panes, viewport sizes and deep links passed');
   } finally { await browser.close(); }
  }
 } finally {server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
