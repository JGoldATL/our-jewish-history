// Movements page: no page errors, route set (79; no returns; starts at the first exile), real taps on arrows, Play stops on touch / Previous / Next / slider,
// the camera never zooms in past MIN_DEG, parent chips light their legs, no horizontal scroll, controls match the globe's.
const {chromium,devices}=require('playwright');
(async()=>{const b=await chromium.launch();let fail=0;const ck=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}else console.log('ok  ',m);};
const cfgs=[['ipad',{viewport:{width:1194,height:834},hasTouch:false}],['phone',{...devices['iPhone 13']}]];
for(const [n,c] of cfgs){
const ctx=await b.newContext(c);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8778/movements.html?drafts=1');await p.waitForTimeout(1500);
ck(errs.length===0,n+' no page errors '+errs.join('|'));
const base=await p.evaluate(()=>({n:MV.routes.length,min:MV.minY,ret:MV.routes.filter(r=>r.m.character==='return/aliyah').length,causes:[...new Set(MV.routes.map(r=>r.cause))].sort()}));
ck(base.n===79,n+' 79 routes ('+base.n+')');ck(base.min===-722,n+' starts at the first exile (722 BCE)');ck(base.ret===0,n+' no return routes');
ck(JSON.stringify(base.causes)===JSON.stringify(['','Deportation','Expulsion','Persecution','Voluntary migration'])||JSON.stringify(base.causes)===JSON.stringify(['Deportation','Expulsion','Persecution','Voluntary migration']),n+' four cause headings '+base.causes);
const ids=await p.evaluate(()=>[...document.querySelectorAll('#sel .pill')].map(x=>x.textContent.replace(/\s+/g,' ').trim()));
ck(ids.length===2&&/^Era/.test(ids[0])&&/^Cause/.test(ids[1]),n+' only Era and Cause filters '+ids);
ck(await p.evaluate(()=>!!document.querySelector('#prev.pill')&&!!document.querySelector('#play.pill.primary')&&!!document.querySelector('#next.pill')&&!!document.querySelector('#reset')&&!!document.querySelector('#keyBtn')&&!!document.querySelector('#options')&&!!document.querySelector('#quizLink')),n+' globe controls present (Previous, Play, Next, Reset, Map key, This moment toggle, Take a Quiz)');
// tap an arrow for real
await p.evaluate(()=>{MV.setYear(1492);MV.follow();});await p.waitForTimeout(900);
const pt=await p.evaluate(()=>{const e=document.querySelector('#map path[data-id="MOV-059"]');if(!e)return null;const L=e.getTotalLength(),q=e.getPointAtLength(L*.5),r=document.getElementById('map').getBoundingClientRect();return {x:r.left+q.x,y:r.top+q.y};});
ck(!!pt,n+' MOV-059 arrow is on the map at 1492');
if(pt){if(c.hasTouch)await p.touchscreen.tap(pt.x,pt.y);else await p.mouse.click(pt.x,pt.y);await p.waitForTimeout(500);
 const t=await p.evaluate(()=>({id:MV.state().SEL?.id,h:document.querySelector('#story h2')?.textContent,s:document.querySelector('#story .sub')?.textContent}));
 ck(t.id==='MOV-059'||!!t.id,n+' tapping an arrow opens its journey ('+t.id+')');ck(t.h==='Spain expels its Jews',n+' event title stays');}
await p.evaluate(()=>{MV.selectRoute('MOV-059');});await p.waitForTimeout(300);
const q=await p.evaluate(()=>({sub:document.querySelector('#story .sub')?.textContent,back:!!document.querySelector('#cardBack'),sw:document.documentElement.scrollWidth,iw:innerWidth}));
ck(q.sub==='To the Ottoman lands'&&q.back,n+' branch card: subhead and back link');ck(q.sw<=q.iw,n+' no horizontal scroll');
// parent chips
await p.evaluate(()=>{MV.setYear(1654);MV.selectEvent('EVT-0071');});await p.waitForTimeout(200);
await p.evaluate(()=>MV.selectParent('MOV-055'));await p.waitForTimeout(600);
const pr=await p.evaluate(()=>({sub:document.querySelector('#story .sub')?.textContent,flow:document.querySelectorAll('path.flow').length}));
ck(pr.sub==='To New Amsterdam'&&pr.flow===3,n+' parent chip MOV-055 lights 3 legs');
await p.evaluate(()=>MV.selectParent('MOV-054'));await p.waitForTimeout(300);
ck(await p.evaluate(()=>document.querySelectorAll('path.flow').length)===2,n+' parent chip MOV-054 lights 2 legs');
// Play stops on touch, Next, Previous, slider; camera stays recognisable
await p.evaluate(()=>{document.getElementById('reset').click();});await p.waitForTimeout(300);
const minDeg=n==='phone'?46:34;
await p.evaluate(()=>{MV.setYear(1400);MV.follow();MV.togglePlay();});let minSeen=999,moves=new Set();
for(let i=0;i<14;i++){await p.waitForTimeout(250);const s=await p.evaluate(()=>MV.state());minSeen=Math.min(minSeen,s.V.degW);moves.add(Math.round(s.V.lon)+','+Math.round(s.V.lat));}
const st=await p.evaluate(()=>MV.state());
ck(st.playing,n+' Play is running');ck(minSeen>=minDeg-0.01,n+' camera never tighter than '+minDeg+' degrees (min seen '+minSeen.toFixed(1)+')');ck(moves.size>2,n+' camera moves as arrows are drawn ('+moves.size+' positions)');
const box=await p.evaluate(()=>{const r=document.getElementById('mapWrap').getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+r.height*.75};});
if(c.hasTouch)await p.touchscreen.tap(box.x,box.y);else await p.mouse.click(box.x,box.y);await p.waitForTimeout(200);
ck(!(await p.evaluate(()=>MV.state().playing)),n+' touching the map stops Play');
for(const [lbl,act] of [['Next',()=>document.getElementById('next').click()],['Previous',()=>document.getElementById('prev').click()]]){
 await p.evaluate(()=>MV.togglePlay());await p.waitForTimeout(200);const was=await p.evaluate(()=>MV.state().playing);await p.evaluate(act);await p.waitForTimeout(200);
 ck(was&&!(await p.evaluate(()=>MV.state().playing)),n+' '+lbl+' stops Play');}
await p.evaluate(()=>MV.togglePlay());await p.waitForTimeout(200);
await p.evaluate(()=>{const s=document.getElementById('slider');s.value=300;s.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(150);
ck(!(await p.evaluate(()=>MV.state().playing)),n+' dragging the slider stops Play');
await ctx.close();}
await b.close();process.exit(fail?1:0);})();
