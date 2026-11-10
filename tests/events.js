// Events page (events.html): the globe with events and shading only. Arrows only for the Sheet's Voluntary migration (charcoal) routes. Old globe (index.html) unchanged.
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
// The qualifying routes are not a fixed list: they are every Sheet movement whose character is Voluntary migration and whose arrow treatment is exactly Charcoal (rule in app.js addSheetMovements).
const fs=require('fs');const WANT=JSON.parse(fs.readFileSync(__dirname+'/../data/history.json','utf8')).sheet.movements.filter(m=>String(m.character||'').trim().toLowerCase()==='voluntary migration'&&String(m.arrowTreatment||'').trim().toLowerCase()==='charcoal').map(m=>m.id).sort();
(async()=>{const b=await chromium.launch();
async function open(url,w=1194,h=834){const p=await b.newPage({viewport:{width:w,height:h}});await p.addInitScript(()=>{window.OJJ_FASTCAM=true;});p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await p.goto(BASE+url);await p.waitForTimeout(2000);return p;}
let p=await open('events.html');
ck((await p.title())==='Our Jewish Journey: Events','page title says Events');
// 3.3.6 (Jeffrey 8 Nov): the 15 Oct rule "arrows only for the Voluntary migration + Charcoal routes" is removed. Events draws any route; F-173 still limits the map to the showing card's own arrows.
{const n=await p.evaluate(()=>EV_VOL.size);ck(n===0,'the voluntary-migration-only rule is gone (EV_VOL empty, '+n+')');}
// F-173: open every card; each shows only arrows it owns, and now every kind of route can appear (red, blue, dotted, charcoal)
const seen=new Set();
{const r=await p.evaluate(async()=>{const t=new Set(),bad=[];promptOpen=false;for(let i=0;i<milestones.length;i++){selectMilestone(i,true);await new Promise(r=>setTimeout(r,25));const rec=milestones[i].record,own=DATA.movements.filter(m=>ownsArrow(rec,m)).map(m=>m.title);for(const g of document.querySelectorAll('#ov g.route')){const a=g.getAttribute('aria-label');t.add(a);if(!own.includes(a))bad.push(rec.id+' '+a);}}selectMilestone(0,true);return {seen:[...t],bad,kinds:new Set(DATA.movements.filter(m=>t.has(m.title)).map(m=>m.arrowTreatment||m.rendering||'')).size};});
 for(const t of r.seen)seen.add(t);ck(r.bad.length===0,'each open card draws only its own arrows ('+r.bad.slice(0,2).join(' | ')+')');
 ck(r.seen.length>=25,'Events now draws far more than the old 11 routes when the cards are opened ('+r.seen.length+' distinct arrows)');}
{const r=await p.evaluate(async()=>{const id=milestones.findIndex(m=>m.record.id==='EVT-0001');selectMilestone(id,true);await new Promise(r=>setTimeout(r,300));return document.querySelectorAll('#ov g.route').length;});ck(r>=1,'Abraham (EVT-0001, dotted traditional route) now draws its arrow on Events ('+r+')');}
ck(seen.size>=6,'arrows do draw ('+seen.size+' seen, by opening the cards that own them)');
await p.evaluate(()=>setYearExact(1500));await p.waitForTimeout(400);
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
