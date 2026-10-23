// Layout regression checks complement functional tests; screenshots remain local.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async function checkVisual(page, showCard, scenes, engine) {
  const previousViewport = page.viewportSize();
  const root = process.env.ANKI_VISUAL_OUTPUT || path.join(__dirname, '../build/uiux-visual');
  const screenshots = process.env.ANKI_VISUAL_SCREENSHOTS === '1';
  const recordOnly = process.env.ANKI_VISUAL_RECORD_ONLY === '1';
  const metrics = [];
  for (const [device, viewport] of Object.entries({desktop:{width:1280,height:900},phone:{width:390,height:844},narrow:{width:320,height:700},landscape:{width:844,height:390}})) {
    await page.setViewportSize(viewport);
    for (const theme of ['light','dark']) {
      await page.emulateMedia({colorScheme:theme});
      for (const scene of scenes) {
        for (const side of ['front','back']) {
          await showCard(page, scene.cards[0][side]);
          await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
          const metric = await page.evaluate(()=>{
            const tokens=[];
            const walk=document.createTreeWalker(document.querySelector('#qa'), NodeFilter.SHOW_TEXT);
            let text;
            while((text=walk.nextNode())) {
              const token='example.cn', offset=text.data.indexOf(token);
              if(offset<0||!text.parentElement.closest('td,th'))continue;
              const range=document.createRange();range.setStart(text,offset);range.setEnd(text,offset+token.length);
              const ys=[...range.getClientRects()].filter(r=>r.height>0).map(r=>Math.round(r.y));
              if(ys.length)tokens.push({token,lines:new Set(ys).size});
            }
            return {pageWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,tokens,
              tables:[...document.querySelectorAll('table')].filter(t=>t.getBoundingClientRect().width).map(t=>({width:t.scrollWidth,viewport:t.parentElement.clientWidth})),
              personalVisible:[...document.querySelectorAll('#popup')].some(el=>el.getBoundingClientRect().height>0)};
          });
          if(scene.key==='mindmap') metric.personalVisible = await page.locator('#popup').isVisible();
          metrics.push({device,theme,key:scene.key,side,...metric});
          if(!recordOnly) {
            // Preserve, and record, original deep-table overflow during migration.
            metric.originalLayoutOverflow = metric.scrollWidth > viewport.width;
            assert.equal(await page.locator('.linkRender').isVisible(), true);
            if(side==='front'&&scene.key==='mindmap')assert.equal(metric.personalVisible,false,'personal notes stay closed on a fresh prompt');
          }
          if(screenshots) {
            const directory=path.join(root,engine,device,theme);fs.mkdirSync(directory,{recursive:true});
            await page.screenshot({path:path.join(directory,scene.key+'-'+side+'.png')});
          }
        }
      }
    }
  }
  const mindmap = scenes.find(scene=>scene.key==='mindmap');
  for (const [device,width] of [['desktop',1280],['phone',390],['narrow',320]]) {
    await page.setViewportSize({width,height:844});
    for (const theme of ['light','dark']) {
      await page.emulateMedia({colorScheme:theme});
      await showCard(page,mindmap.cards[1].back);
      if (!recordOnly) {
        assert.equal(await page.locator('.linkRender .cloze').first().isVisible(),true);
        assert.match(await page.locator('.linkRender .cloze').first().innerText(),/深层答案先理解定义/);
        assert.equal(await page.locator('#popup').isVisible(),false);
        assert.equal(await page.locator('#popup2').isVisible(),false);
      }
      if (screenshots) await page.screenshot({path:path.join(root,engine+'-mindmap-'+device+'-'+theme+'.png')});
    }
  }
  fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,engine+'-metrics.json'),JSON.stringify(metrics,null,2));
  await page.setViewportSize(previousViewport);await page.emulateMedia({colorScheme:'light'});
  console.log(engine+': '+metrics.length+' complex visual layouts checked'+(screenshots?' and captured':''));
};
