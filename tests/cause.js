// Cause menu after the 10/19 Sheet change: Relocation and Voluntary migration are one heading; labels may carry a capital.
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
(async()=>{const br=await chromium.launch();const errs=[];
for(const [vw,vh,tag] of [[1280,800,'desktop'],[390,844,'phone']]){
  const p=await (await br.newContext({viewport:{width:vw,height:vh}})).newPage();p.on('pageerror',e=>errs.push(e.message));const n=tag+': ';
  await p.goto(BASE+'movements.html');await p.waitForTimeout(2500);
  ck(await p.evaluate(()=>window.SITE_VERSION==='0.9.1'&&/0\.9\.1/.test(document.getElementById('version').textContent)),n+'version reads 0.9.1');
  await p.click('button:has-text("Cause")');await p.waitForTimeout(400);
  const items=await p.evaluate(()=>[...document.querySelectorAll('[role=menuitemradio],[role=option],.pill-menu button,.gp-menu button,.fmenu button')].map(b=>b.textContent.trim()).filter(Boolean));
  const txt=await p.evaluate(()=>document.body.innerText);
  ck(!/\bRelocation\b/.test(txt),n+'no Relocation heading anywhere');
  ck(/Voluntary migration/.test(txt),n+'Voluntary migration is offered');
  ck(/Deportation/.test(txt)&&/Expulsion/.test(txt)&&/Persecution/.test(txt),n+'Deportation, Expulsion and Persecution still offered');
}
// a Sheet that writes the label with capitals must behave the same
const p2=await (await br.newContext({viewport:{width:1280,height:800}})).newPage();p2.on('pageerror',e=>errs.push(e.message));
await p2.route('**/data/history.json',async r=>{const res=await r.fetch();const j=await res.json();for(const m of j.sheet.movements){if(m.character==='relocation')m.character='Voluntary migration';else if(m.character==='expulsion')m.character='Expulsion';else if(m.character==='voluntary migration')m.character='Voluntary migration';}await r.fulfill({response:res,json:j});});
await p2.goto(BASE+'movements.html');await p2.waitForTimeout(2500);await p2.click('button:has-text("Cause")');await p2.waitForTimeout(400);
const t2=await p2.evaluate(()=>document.body.innerText);ck(/Expulsion/.test(t2)&&/Voluntary migration/.test(t2)&&!/Relocation/.test(t2),'capitalised labels in the data still produce the same four headings');
ck(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));console.log(bad?'FAILED '+bad:'ALL PASS');await br.close();process.exit(bad?1:0);})();
