const {chromium,devices}=require('playwright');const S=process.argv[2]||'tests/out';require('fs').mkdirSync(S+'/reg',{recursive:true});
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const out={};
const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('requestfailed',r=>errs.push('FAIL '+r.url()));
await p.goto(''+(process.env.SITE||'http://localhost:8778/')+'');await p.waitForTimeout(2500);
out.validate=await p.evaluate(()=>{try{const r=validateHistory(DATA);return Array.isArray(r)?r.length+' issues':JSON.stringify(r).slice(0,200)}catch(e){return 'ERR '+e.message}});
// integer-year sweep, start to DATA.timeline.end: engine says visible vs drawn
out.sweep=await p.evaluate(()=>{dismissPrompt();let miss=[],years=0;for(let y=-2000;y<=DATA.timeline.end;y++){setYearExact(y);years++;const f=computeFrame(y);
 const wantM=f.movements.filter(m=>m.visible&&m.opacity>.01).length,gotM=document.querySelectorAll('#lRoute .route').length;
 const wantE=f.events.filter(e=>e.opacity>.02).length,gotE=document.querySelectorAll('#lMark .event').length;
 if(wantM!==gotM||wantE!==gotE)miss.push([y,wantM,gotM,wantE,gotE]);}return {years,mismatches:miss.length,sample:miss.slice(0,12)}});
// endpoints
out.endpoints=await p.evaluate(()=>{setPos(0);const a=Math.round(currentYear());setPos(1);const z=Math.round(currentYear());return [a,z]});
// cards: all milestone types, wording rules
out.cards=await p.evaluate(()=>{const kinds={},bad=[];for(const m of milestones){fillStory(m.record,m.type,true);const k=$('storyKicker').textContent.replace(/ · Draft$/,'');kinds[k]=(kinds[k]||0)+1;const t=$('story').innerText;if(/source|debated|related|still here/i.test(t))bad.push(m.record.id);if(!['Event','Community','Movement','Archaeology'].includes(k))bad.push('kind:'+k);}return {count:milestones.length,kinds,bad}});
// date checks + screenshots
for(const y of [-1208,-722,-586,-500,-63,200,1000,1897]){await p.evaluate(y=>{closeStory();setYearExact(y)},y);await p.waitForTimeout(300);await p.screenshot({path:`${S}/reg/d${y}.png`});}
// playback
out.play=await p.evaluate(async()=>{setPos(0);startTour();await new Promise(r=>setTimeout(r,4000));const y=currentYear();stopTour();return Math.round(y)});
// hover/select a route
out.select=await p.evaluate(()=>{setYearExact(-538);const r=document.querySelector('#lRoute .route');if(!r)return 'no route at 538 BCE';r.dispatchEvent(new MouseEvent('click',{bubbles:true}));return $('storyKicker').textContent+' | '+$('storyTitle').textContent+' | selected:'+!!document.querySelector('.route.selected')});
out.errs=errs;await p.close();
// touch viewports
for(const [name,dev] of [['iphone',devices['iPhone 13']],['ipadP',devices['iPad (gen 7)']],['ipadL',devices['iPad (gen 7) landscape']]]){const c=await b.newContext({...dev});const q=await c.newPage();const e2=[];q.on('pageerror',e=>e2.push(e.message));await q.goto(''+(process.env.SITE||'http://localhost:8778/')+'');await q.waitForTimeout(2500);
 await q.evaluate(()=>{dismissPrompt();setYearExact(-586)});await q.waitForTimeout(300);
 const box=await q.locator('#stage').boundingBox();await q.touchscreen.tap(box.x+box.width/2,box.y+box.height*0.35);
 const ov=await q.evaluate(()=>document.documentElement.scrollWidth>innerWidth);await q.screenshot({path:`${S}/reg/${name}.png`});out[name]={errs:e2,horizScroll:ov};await c.close();}
console.log(JSON.stringify(out,null,1));await b.close();})();
