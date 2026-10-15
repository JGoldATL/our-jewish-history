// F-097 / F-082: Map Key + contested rule. Preview only (?nav=glass); flag off must be the old behaviour. Run: NODE_PATH=$(npm root -g) node tests/mapkey.js
const {chromium}=require('playwright');const BASE=process.env.SITE||'http://localhost:8778/';let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
async function page(url,inject){const c=await b.newContext({viewport:{width:1280,height:800}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 if(inject)await p.route('**/data/history.json',async r=>{const resp=await r.fetch();const j=await resp.json();inject(j);r.fulfill({response:resp,json:j});});
 await p.goto(url);await p.waitForTimeout(2400);p.errs=errs;return p;}
const keyText=async p=>{await p.click('#keyBtn');await p.waitForTimeout(200);return p.evaluate(()=>[...document.querySelectorAll('#key div')].map(d=>d.textContent));};
// globe
let p=await page(BASE+'index.html');let k=await keyText(p);
ok(k.includes('Contested route')&&k.includes('Murdered community'),'globe, flag off: old Key (Contested route, Murdered community)');
p=await page(BASE+'index.html?nav=old');k=await keyText(p);ok(k.includes('Contested route'),'globe, ?nav=old: old Key');
p=await page(BASE+'index.html?nav=glass');k=await keyText(p);
ok(JSON.stringify(k)===JSON.stringify(['Return to the Land','Forced expulsion','Voluntary migration','Biblical/Traditional Account','Jewish population. Darker means larger, not a census.','Massacred community','Community no longer exists','Forced conversion, other or unknown faith','Forced conversion to Christianity']),'globe, preview: Key in the CEO order, no Contested entry');
ok(p.errs.length===0,'globe preview: no page errors');
// movements
p=await page(BASE+'movements.html');k=await keyText(p);ok(k.includes('Forced or persecution-driven movement')&&k.includes('Other documented movement'),'movements, flag off: old Key');
const off=await p.evaluate(()=>MV.routes.filter(r=>/contested/i.test(r.m.arrowTreatment||'')).map(r=>[r.id,r.cname,r.dotted]));
ok(off.length>0&&off.every(r=>r[1]==='Charcoal'),'movements, flag off: contested routes unchanged (charcoal): '+JSON.stringify(off));
p=await page(BASE+'movements.html?nav=glass');k=await keyText(p);ok(k[0]==='Forced expulsion'&&k.includes('Voluntary migration')&&!k.some(x=>/Contested/.test(x)),'movements, preview: new labels, no Contested entry');
const on=await p.evaluate(()=>MV.routes.filter(r=>/contested/i.test(r.m.arrowTreatment||'')).map(r=>[r.id,r.cname,r.dotted]));
ok(on.length>0&&on.every(r=>r[1]==='Red'&&r[2]===false),'movements, preview: contested routes are solid red (cause colour): '+JSON.stringify(on));
// card icon (simulated symbol on an event that has routes)
p=await page(BASE+'movements.html?nav=glass',j=>{j.sheet.events.find(e=>e.id==='EVT-0071').mapSymbol={text:'Red octagon',kind:'octagon',status:'locked'};});
await p.evaluate(()=>{MV.setYear(1654);MV.selectEvent('EVT-0071')});await p.waitForTimeout(400);
ok(await p.evaluate(()=>{const i=document.querySelector('#story .kicker .kicon');return !!i&&i.getAttribute('aria-label')==='Massacred community'&&!!i.querySelector('svg')}),'movements card: map key icon shown for an event with a map symbol');
ok(p.errs.length===0,'movements preview: no page errors');
console.log(f?f+' FAILED':'ALL PASS');await b.close();process.exit(f?1:0);})();
