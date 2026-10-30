// Merchandise page (v2.3.0): 11 cards, verbatim wording, pills, detail view, no explanations, More-menu entry, fit at phone to desktop widths.
// Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/merch.js   (headless Chromium only)
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
const WORDS=['Billy Ray Sheit','Shofar So Good','Next Year in Boca?','Shema Yisrael. We Ain’t Going Nowhere.','You’ve Been Trying for 3,000 Years.','The Chosen People. No Opt-Outs.','Dayenu. But We Keep On Going.','We’ve Been Evicted From Better Countries.','3,000 YEARS OF EVICTIONS. WE KNOW THE MARKET.','L’Dor V’Dor','I Hope You Like My BaSHERT.'];
(async()=>{const b=await chromium.launch();const errs=[];
for(const w of [320,390,768,1280]){const c=await b.newContext({viewport:{width:w,height:800}});const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(BASE+'merch.html');await p.waitForTimeout(900);
 if(w===1280){
  ck(await p.$$eval('#grid .card',a=>a.length)===11,'11 cards, one flat grid');
  const lab=await p.$$eval('#grid .card .tile',a=>a.map(t=>t.getAttribute('aria-label')));ck(JSON.stringify(lab)===JSON.stringify(WORDS),'wording is verbatim on every tile');
  const pills=await p.$$eval('#grid .card>.pillS',a=>a.map(t=>t.textContent));ck(pills.filter(x=>x==='Approved working concept').length===8&&pills.includes('Approved, wording open')&&pills.filter(x=>x==='Selected for exploration').length===2,'status pills as drawn: 8 approved, 1 wording open, 2 exploring');
  const txt=await p.evaluate(()=>document.body.innerText);ck(!/\b(CE|\$|buy|cart|price|notify|filter)\b/i.test(txt.replace(/3,000 YEARS/,'')),'no CE, price, buy, cart, notify or filter text');
  const ev=await p.$eval('#grid li:nth-child(9) .tile',t=>{const a=[...t.querySelectorAll('.l')].map(x=>x.textContent);const s=getComputedStyle(t.querySelector('.l'));return {a,al:s.textAlign,flex:getComputedStyle(t).alignItems};});
  ck(ev.a.length===2&&ev.a[0]==='3,000 YEARS OF EVICTIONS.'&&ev.a[1]==='WE KNOW THE MARKET.'&&/left|start/.test(ev.al)&&ev.flex==='flex-start','concept 9: two lines, left aligned, line 2 separate');
  await p.click('#grid li:nth-child(3) .card');await p.waitForTimeout(200);
  ck(await p.$eval('#detail',d=>d.open),'tap opens the detail view');
  ck(await p.$eval('#detail',d=>d.querySelectorAll('button,a').length)===1,'detail view has only a Close button (no purchase, no capture)');
  await p.keyboard.press('Escape');await p.waitForTimeout(150);ck(!(await p.$eval('#detail',d=>d.open)),'Escape closes it');
  ck(await p.evaluate(()=>document.activeElement&&document.activeElement.classList.contains('card')),'focus returns to the card');
  await p.click('#siteNavBtn');ck(await p.$$eval('#siteNavMenu a',a=>a.some(x=>x.textContent==='Merchandise'&&/merch\.html$/.test(x.href))),'More menu lists Merchandise');
  ck(await p.evaluate(()=>/^v3\.0\.0/.test((document.getElementById('siteVer')||{}).textContent||'')),'footer version reads v3.0.0');
 }
 ck(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),w+' px: no sideways scroll');
 await c.close();}
ck(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));console.log(bad?'FAILED '+bad:'ALL PASS');await b.close();process.exit(bad?1:0);})();
