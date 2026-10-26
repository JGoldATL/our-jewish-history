// Events page (events.html): the globe with events and shading only. Arrows only for the Sheet's Voluntary migration (charcoal) routes. Old globe (index.html) unchanged.
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
// The qualifying routes are not a fixed list: they are every Sheet movement whose character is Voluntary migration and whose arrow treatment is exactly Charcoal (rule in app.js addSheetMovements).
const fs=require('fs');const WANT=JSON.parse(fs.readFileSync(__dirname+'/../data/history.json','utf8')).sheet.movements.filter(m=>String(m.character||'').trim().toLowerCase()==='voluntary migration'&&String(m.arrowTreatment||'').trim().toLowerCase()==='charcoal').map(m=>m.id).sort();
(async()=>{const b=await chromium.launch();
async function open(url,w=1194,h=834){const p=await b.newPage({viewport:{width:w,height:h}});p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await p.goto(BASE+url);await p.waitForTimeout(2000);return p;}
let p=await open('events.html');
ck((await p.title())==='Our Jewish Journey: Events','page title says Events');
{const got=await p.evaluate(()=>[...EV_VOL].sort());ck(got.length>=10&&got.every(id=>WANT.includes(id)),'every route Events draws is a Voluntary migration + Charcoal row in the Sheet ('+got.length+' of the '+WANT.length+' Sheet rows are ready to draw: '+got.join(' ')+')');}
// at every year no arrow outside the set is drawn, and old globe draws more
let ok=true,seen=new Set();
for(const y of [-1900,-586,-200,70,900,1290,1492,1500,1590,1630,1800,1845,1881,1889]){await p.evaluate(yy=>setYearExact(yy),y);await p.waitForTimeout(250);
  const n=await p.evaluate(()=>[...document.querySelectorAll('#ov g.route')].map(g=>g.getAttribute('aria-label')));const all=await p.evaluate(()=>DATA.movements.filter(m=>EV_VOL.has(m.id)).map(m=>m.title));
  for(const t of n){if(!all.includes(t)){ok=false;console.log('  unexpected route',y,t);}else seen.add(t);}}
ck(ok,'no route other than the voluntary-migration set is drawn on Events');ck(seen.size>=6,'voluntary-migration arrows do draw ('+seen.size+' seen)');
await p.evaluate(()=>setYearExact(1500));await p.waitForTimeout(400);
ck(await p.evaluate(()=>{const ok=new Set(DATA.movements.filter(m=>EV_VOL.has(m.id)).map(m=>m.title));const r=[...document.querySelectorAll('#ov g.route')].map(g=>g.getAttribute('aria-label'));return r.length>0&&r.every(t=>ok.has(t));}),'1500: every arrow drawn is one of the charcoal routes');
ck(await p.$('#pgHost .ojjpg')&&await p.$('#play')&&await p.$('#story'),'cards, the pager, Play present');
await p.click('#pgHost [data-step="1"]');await p.waitForTimeout(500);ck(await p.evaluate(()=>document.querySelector('#story h2')?.textContent.length>0),'Next opens a card');
ck(p.errs.length===0,'events: no page errors '+p.errs.join('|'));await p.close();
p=await open('index.html');await p.evaluate(()=>setYearExact(1500));await p.waitForTimeout(500);
ck(await p.evaluate(()=>typeof EVENTS_ONLY!=='undefined'&&EVENTS_ONLY===false)&&await p.evaluate(()=>document.querySelectorAll('#ov g.route').length)>10,'old globe (index.html) unchanged: all arrows still drawn');ck(p.errs.length===0,'old globe: no page errors');await p.close();
// nav: Events present, Globe absent, original nav links
for(const [w,h,n] of [[1194,834,'desktop'],[820,1180,'ipad'],[390,780,'phone']]){
  p=await open('events.html?nav=glass',w,h);const l=await p.evaluate(()=>[...document.querySelectorAll('.gn .gp-btn')].map(x=>x.textContent.replace(/\s*soon$/,'')));ck(l.includes('Events')&&!l.includes('Globe'),n+' glass nav: Events present, Globe absent ('+l.join(',')+')');await p.close();}
for(const [pg,sel] of [['movements.html','#globeLink'],['feedback.html','#backGlobe'],['roadmap.html','#backGlobe'],['strategy.html','#backGlobe'],['quiz.html','#backLink']]){p=await open(pg+'?nav=old');const t=await p.$eval(sel,x=>[x.textContent,x.getAttribute('href')]);ck(/Events/.test(t[0])&&t[1]==='events.html',pg+' link says Events and goes to events.html');await p.close();}
await b.close();console.log(bad?'FAILURES: '+bad:'ALL PASS');process.exit(bad?1:0);})();
