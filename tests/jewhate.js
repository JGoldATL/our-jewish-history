// JewHate page: live nav pill, persecution-only routes from the existing data, no page errors.
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
(async()=>{const br=await chromium.launch();const errs=[];
for(const [vw,vh,tag] of [[390,844,'phone'],[1280,800,'desktop']]){
  const p=await (await br.newContext({viewport:{width:vw,height:vh}})).newPage();p.on('pageerror',e=>errs.push(e.message));const n=tag+': ';
  await p.goto(BASE+'movements.html');await p.waitForTimeout(2200);
  const mv=await p.evaluate(()=>document.querySelectorAll('#map path.route, #map .route').length);
  await p.goto(BASE+'jewhate.html');await p.waitForTimeout(2500);
  ck(/The History of JewHate/.test(await p.title())&&/The History of JewHate/.test(await p.$eval('.brand h1',x=>x.textContent)),n+'page title');
  const items=await p.$$eval('#gnBar .gp-btn',b=>b.map(x=>x.textContent.trim()+(x.disabled||x.getAttribute('aria-disabled')==='true'?'(off)':'')));
  ck(items.some(t=>/^JewHate$/.test(t)),n+'JewHate pill is live ('+items.join(' | ')+')');
  ck(await p.$eval('#gnBar .gp-btn[aria-current="page"],#gnBar .gp-btn.on,#gnBar .gp-btn[aria-pressed="true"]',x=>/JewHate/.test(x.textContent)).catch(()=>false),n+'JewHate is the selected page');
  const causes=await p.evaluate(()=>{const b=[...document.querySelectorAll('button,[role=button]')].find(x=>/^Cause/.test(x.textContent.trim()));return !!b;});
  ck(causes,n+'Cause pill present');
  await p.goto(BASE+'movements.html');await p.waitForTimeout(500);await p.goto(BASE+'jewhate.html');await p.waitForTimeout(1500);
  ck(await p.evaluate(()=>!!document.querySelector('.brand p')&&/^The origin of lies and stereotypes\.$/.test(document.querySelector('.brand p').textContent.trim())),n+'JewHate subtitle');
  await p.click('#pillCause,.fpill[data-k="cause"],button:has-text("Cause")').catch(()=>{});
  await p.waitForTimeout(300);
  const txt=await p.evaluate(()=>document.body.innerText);
  ck(!/Voluntary migration|Relocation/.test(txt),n+'no Voluntary migration or Relocation causes offered');
  ck(/Expulsion|Persecution|Deportation/.test(txt),n+'persecution causes offered');
  await p.click('#introPlay').catch(()=>{});await p.waitForTimeout(1200);
  await p.screenshot({path:process.env.SHOT?process.env.SHOT+'-'+tag+'.png':'/dev/null'});
}
const p2=await (await br.newContext({viewport:{width:1280,height:800}})).newPage();p2.on('pageerror',e=>errs.push(e.message));
await p2.goto(BASE+'jewhate.html?mapopts=1');await p2.waitForTimeout(2200);
ck((await p2.$$eval('.rail button',b=>b.filter(x=>x.offsetParent).length))===3,'jewhate with mapopts: bar has Map key, Routes, Reset');
ck(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
console.log(bad?'FAILED '+bad:'ALL PASS');await br.close();process.exit(bad?1:0);})();
