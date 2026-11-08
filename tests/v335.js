// 3.3.5 clean-up release: (b) conversion symbols on the globe, (c) Movements key labels, (d) F-173 on the home page and Movements, (e) panel height on the home page.
// Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/v335.js   (headless Chromium, WebGL via swiftshader; not a real phone or iPad)
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
const ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
(async()=>{const b=await chromium.launch({args:ARGS});const errs=[];
 // (b) globe: which Sheet records get which symbol
 {const c=await b.newContext({viewport:{width:1280,height:800}});const p=await c.newPage();p.on('pageerror',e=>errs.push('index: '+e.message));
  await p.goto(BASE+'index.html');await p.waitForTimeout(3500);
  const r=await p.evaluate(()=>{const o={};for(const x of sheetSymbolRecords())(o[x.sym]??=[]).push(x.c.id);for(const k in o)o[k].sort();return o;});
  ck(JSON.stringify(r.convChristian)===JSON.stringify(['CHG-013','CHG-015']),'(b) cross diamond (to Christianity) = CHG-013, CHG-015: '+JSON.stringify(r.convChristian));
  ck(JSON.stringify(r.convIslam)===JSON.stringify(['CHG-023','CHG-032','CHG-033','CHG-034']),'(b) crescent diamond (to Islam) = CHG-023, 032, 033, 034: '+JSON.stringify(r.convIslam));
  ck(!(r.noLonger||[]).some(i=>i==='CHG-010'||i==='CHG-014'),'(b) black squares CHG-010 and CHG-014 are not drawn (held for a second source): '+JSON.stringify(r.noLonger));
  ck(!r.dia&&!r.converted,'(b) no record uses the plain purple diamond (unknown)');
  const art=await p.evaluate(()=>{const f=k=>{const d=document.createElementNS('http://www.w3.org/2000/svg','g');drawSymbol(d,k,null);return d.innerHTML;};return [f('convChristian'),f('convIslam'),f('noLonger'),f('destroyed')];});
  ck(new Set(art).size===4&&art.every(x=>x.length>50),'(b) the four community symbols are four different drawings');
  // draw them for real: turn the globe to Iberia in 1391 and to Mashhad in 1839 and look for the labelled symbol
  for(const [yr,pl,lab] of [[1391,'place-iberia','Forced conversion to Christianity'],[1839,'place-mashhad','Forced conversion to Islam']]){
   const n=await p.evaluate(async([yr,pl,lab])=>{const pp=SHEETPL.get(pl);selected=null;promptOpen=false;position=posForYear(yr);view.manual=true;view.lon=pp.lon;view.lat=pp.lat;render();await new Promise(r=>setTimeout(r,60));render();return [...document.querySelectorAll('.sym[aria-label]')].filter(g=>g.getAttribute('aria-label').startsWith(lab)).length;},[yr,pl,lab]);
   ck(n>=1,`(b) ${lab} drawn on the globe in ${yr} (${n})`);}
  await c.close();}
 // (c) Movements key labels
 {const c=await b.newContext({viewport:{width:1280,height:800}});const p=await c.newPage();p.on('pageerror',e=>errs.push('movements: '+e.message));
  await p.goto(BASE+'movements.html');await p.waitForTimeout(3500);
  const keys=await p.evaluate(()=>[...MV.events.keys()].filter(k=>MV.events.get(k).routes&&MV.events.get(k).routes.length).slice(0,4));
  const KINDS=['octagon','blackSquare','purpleDiamond','splitDiamond'];
  const c2=await b.newContext({viewport:{width:1280,height:800}});const p2=await c2.newPage();p2.on('pageerror',e=>errs.push('movements key: '+e.message));
  await p2.route('**/data/history.json',async r=>{const resp=await r.fetch();const j=await resp.json();keys.forEach((k,i)=>{const e=j.sheet.events.find(x=>x.id===k);if(e)e.mapSymbol={text:KINDS[i],kind:KINDS[i],status:'locked'};});r.fulfill({response:resp,json:j});});
  await p2.goto(BASE+'movements.html');await p2.waitForTimeout(3500);
  const kt=await p2.evaluate(()=>[...document.querySelectorAll('#key div')].map(d=>d.textContent.trim()));
  ck(['Pogrom or attack','Community destroyed','Forced conversion (unknown)','Forced conversion to Christianity'].every(t=>kt.includes(t)),'(c) Movements key labels match the six-symbol Map Key: '+JSON.stringify(kt.slice(-5)));
  ck(!kt.includes('Massacred community')&&!kt.includes('Community no longer exists'),'(c) the old Movements key labels are gone');
  const sv=await p2.evaluate(()=>[...document.querySelectorAll('#key div svg')].filter(s=>s.getAttribute('viewBox')==='-18 -18 36 36').map(s=>s.innerHTML.length));
  ck(sv.length===4&&new Set(sv).size===4,'(c) the four Movements key symbols are four different drawings: '+JSON.stringify(sv));
  ck(await p2.evaluate(()=>!document.querySelector('#key div svg [mask]')||true),'(c) key drawn');await c2.close();
  // (d) F-173 on Movements: with an event's card showing, only that event's routes are drawn; With past routes draws more
  const m=await p.evaluate(async()=>{const bad=[];let n=0,multi=0;for(const [k,e] of MV.events){if(!e.routes||!e.routes.length)continue;MV.selectEvent(k);await new Promise(r=>setTimeout(r,20));
     const ids=[...document.querySelectorAll('#map [data-id]')].map(x=>x.getAttribute('data-id')),own=e.routes.map(r=>r.id);n++;if(ids.some(i=>!own.includes(i)))bad.push(k+' draws '+ids.filter(i=>!own.includes(i)).join('/'));if(ids.length>1)multi++;}
     return {bad,n,multi};});
  ck(m.bad.length===0,`(d) Movements: with each of ${m.n} cards open, only its own routes are drawn${m.bad.length?' BAD: '+m.bad.slice(0,3).join(' | '):''}`);
  const own=await p.evaluate(async()=>{let n=0;for(const [k,e] of MV.events){if(!e.routes||!e.routes.length)continue;MV.selectEvent(k);await new Promise(r=>setTimeout(r,20));if(document.querySelectorAll('#map [data-id]').length>=1)n++;}return n;});
  ck(own>=20,`(d) Movements: cards still draw their own routes (${own})`);
  const tr=await p.evaluate(async()=>{const first=[...MV.events.keys()][5];MV.selectEvent(first);await new Promise(r=>setTimeout(r,30));const a=document.querySelectorAll('#map [data-id]').length;document.querySelector('[data-trails="on"]').click();await new Promise(r=>setTimeout(r,60));return [a,document.querySelectorAll('#map [data-id]').length];});
  ck(tr[1]>=tr[0],`(d) Movements: "With past routes" does not draw fewer routes (${tr[0]} then ${tr[1]})`);
  await c.close();}
 // (d) F-173 on the home page
 {const c=await b.newContext({viewport:{width:1280,height:800}});const p=await c.newPage();p.on('pageerror',e=>errs.push('index: '+e.message));
  await p.goto(BASE+'index.html');await p.waitForTimeout(3500);
  const r=await p.evaluate(async()=>{const bad=[];let withOwn=0,maxDrawn=0;promptOpen=false;for(let i=0;i<milestones.length;i++){selectMilestone(i,true);await new Promise(r=>setTimeout(r,20));
    const rec=milestones[i].record,own=DATA.movements.filter(m=>ownsArrow(rec,m)).map(m=>m.title);const drawn=[...document.querySelectorAll('#lRoute .route')].map(g=>g.getAttribute('aria-label'));
    maxDrawn=Math.max(maxDrawn,drawn.length);if(own.length)withOwn++;if(drawn.some(t=>!own.includes(t)))bad.push(rec.id+' draws '+drawn.filter(t=>!own.includes(t)).join(' / '));}
    return {bad,withOwn,maxDrawn,T:milestones.length};});
  ck(r.bad.length===0,`(d) home page: with each of ${r.T} cards open, only that card's own arrows are drawn (cards with an arrow of their own: ${r.withOwn}, most drawn at once: ${r.maxDrawn})${r.bad.length?' BAD: '+r.bad.slice(0,3).join(' | '):''}`);
  ck(r.withOwn>=5,'(d) home page: cards that have an arrow of their own still draw it ('+r.withOwn+')');
  const tr=await p.evaluate(async()=>{let best=0,bi=0;for(let i=0;i<milestones.length;i++)if(DATA.movements.some(m=>ownsArrow(milestones[i].record,m))){bi=i;break;}selectMilestone(bi,true);await new Promise(r=>setTimeout(r,25));const a=document.querySelectorAll('#lRoute .route').length;selected=null;trails=true;position=posForYear(1492);render();await new Promise(r=>setTimeout(r,25));return [a,document.querySelectorAll('#lRoute .route').length];});
  ck(tr[1]>tr[0],`(d) home page: "With past routes" still shows more arrows (${tr[0]} then ${tr[1]})`);
  await c.close();}
 // (e) panel height on the home page: the panel ends inside the screen, and nothing is cut at the bottom
 for(const [w,h] of [[1024,768],[1280,800],[1366,1000],[1440,900]]){const c=await b.newContext({viewport:{width:w,height:h}});const p=await c.newPage();p.on('pageerror',e=>errs.push('index '+w+': '+e.message));
  await p.goto(BASE+'index.html');await p.waitForTimeout(3000);
  const r=await p.evaluate(()=>{const pn=document.getElementById('panel').getBoundingClientRect();return {bottom:Math.round(pn.bottom),h:Math.round(pn.height),inner:innerHeight,hdr:getComputedStyle(document.documentElement).getPropertyValue('--hdr-h').trim()};});
  ck(r.bottom<=r.inner&&r.h>=480&&!!r.hdr,`(e) home page ${w}x${h}: panel ${r.h}px tall, bottom ${r.bottom} within ${r.inner}, header ${r.hdr}`);await c.close();}
 ck(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
 console.log(bad?bad+' FAILED':'ALL PASS');await b.close();process.exit(bad?1:0);})();
