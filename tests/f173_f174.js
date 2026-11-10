// F-173 (arrows follow the card showing) and F-174 (Next runs to the last card, EVT-0152) on the Events page; F-171 (panel height) at 950 to 1300 px.
// Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/f173_f174.js   (headless Chromium, WebGL via swiftshader; not a real phone or iPad)
const {chromium,devices}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
const ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
const SIZES=[['desktop 1280',{viewport:{width:1280,height:800}}],['iPad upright 820',{viewport:{width:820,height:1180},hasTouch:true}],['iPad landscape 1024',{viewport:{width:1024,height:768},hasTouch:true}],['phone 390',{viewport:{width:390,height:844},hasTouch:true,isMobile:true}]];
const routeTitles=p=>p.evaluate(()=>[...document.querySelectorAll('#lRoute .route')].map(g=>g.getAttribute('aria-label')));
(async()=>{const b=await chromium.launch({args:ARGS});const errs=[];
for(const [nm,opts] of SIZES){const n=nm+': ';const c=await b.newContext(opts);const p=await c.newPage();await p.addInitScript(()=>{window.OJJ_FASTCAM=true;});p.on('pageerror',e=>errs.push(n+e.message));
  await p.goto(BASE+'events.html');await p.waitForTimeout(4200);
  const T=await p.evaluate(()=>milestones.length);
  // F-173: with each card open, every arrow drawn belongs to that card
  const r=await p.evaluate(async()=>{const bad=[];let withOwn=0,maxDrawn=0;for(let i=0;i<milestones.length;i++){selectMilestone(i,true);await new Promise(r=>setTimeout(r,25));
    const rec=milestones[i].record,own=DATA.movements.filter(m=>ownsArrow(rec,m)).map(m=>m.title);const drawn=[...document.querySelectorAll('#lRoute .route')].map(g=>g.getAttribute('aria-label'));
    maxDrawn=Math.max(maxDrawn,drawn.length);if(own.length)withOwn++;if(drawn.some(t=>!own.includes(t)))bad.push(rec.id+' draws '+drawn.filter(t=>!own.includes(t)).join(' / '));}
    return {bad,withOwn,maxDrawn};});
  ck(r.bad.length===0,n+`F-173: with each of ${T} cards open, only that card's own arrows are drawn (cards with an arrow of their own: ${r.withOwn}, most drawn at once: ${r.maxDrawn})${r.bad.length?' BAD: '+r.bad.slice(0,3).join(' | '):''}`);
  // an own arrow still draws for its card (1881 Russia card: at least one card with arrows draws them)
  const own=await p.evaluate(async()=>{let n=0;for(let i=0;i<milestones.length;i++){selectMilestone(i,true);await new Promise(r=>setTimeout(r,25));const rec=milestones[i].record;if(DATA.movements.some(m=>ownsArrow(rec,m))&&document.querySelectorAll('#lRoute .route').length>0)n++;}return n;});
  ck(own>=5,n+`F-173: cards that have an arrow of their own still draw it (${own})`);
  // dragging the year (no card open): the card auto-shown draws only its own arrows
  const dr=await p.evaluate(async()=>{const o=[];for(const y of [1492,1881,1898,1920]){selected=null;pagerOff=false;lastAutoIdx=-1;position=posForYear(y);render();await new Promise(r=>setTimeout(r,25));const rec=activeCardRecord(y),ownT=DATA.movements.filter(m=>ownsArrow(rec,m)).map(m=>m.title),drawn=[...document.querySelectorAll('#lRoute .route')].map(g=>g.getAttribute('aria-label'));o.push(drawn.every(t=>ownT.includes(t)));}return o;});
  ck(dr.every(Boolean),n+'F-173: dragging the year draws only the auto-shown card\'s arrows');
  // View all routes (trails) stays and draws more than one card's arrows
  const tr=await p.evaluate(async()=>{selectMilestone(195,true);await new Promise(r=>setTimeout(r,25));const a=document.querySelectorAll('#lRoute .route').length;trails=true;render();await new Promise(r=>setTimeout(r,25));const b2=document.querySelectorAll('#lRoute .route').length;trails=false;render();return [a,b2];});
  ck(tr[1]>tr[0],n+`F-173: "View all routes" still shows more arrows (${tr[0]} then ${tr[1]})`);
  // F-174: Next from card 1 runs to EVT-0152 and stops there
  await p.evaluate(()=>selectMilestone(0));await p.waitForTimeout(400);let stuck=null;
  for(let k=0;k<T+2;k++){const before=await p.evaluate(()=>milestones.findIndex(m=>selected&&m.record===selected.record));if(before>=T-1)break;
    const btn=p.locator('#pgHost [data-step="1"]');if(opts.hasTouch)await btn.tap({timeout:3000}).catch(()=>{});else await btn.click({timeout:3000}).catch(()=>{});await p.waitForTimeout(90);
    const after=await p.evaluate(()=>milestones.findIndex(m=>selected&&m.record===selected.record));if(after!==before+1){stuck={before,after};break;}}
  let s=await p.evaluate(()=>({id:selected&&selected.record.id,dis:document.querySelector('#pgHost [data-step="1"]').getAttribute('aria-disabled'),txt:document.querySelector('#pgHost .pgn').firstChild.textContent}));
  ck(!stuck&&s.id==='EVT-0152'&&s.dis==='true'&&s.txt===`${T} of ${T}`,n+`F-174: Next ran card by card to ${s.id} (${s.txt}), Next now disabled${stuck?' STUCK '+JSON.stringify(stuck):''}`);
  // F-174: after dragging the year to 1898 and past it (no card open) Next is there and runs on to the last card
  for(const y of [1890,1898,1903,1925]){
    await p.evaluate(y=>{selected=null;pagerOff=false;lastAutoIdx=-1;position=posForYear(y);render();},y);await p.waitForTimeout(250);
    const v=await p.evaluate(()=>{const e=document.querySelector('#pgHost .ojjpg');return {hidden:e.hidden,txt:e.querySelector('.pgn').firstChild.textContent};});
    ck(!v.hidden,n+`F-174: Next is visible with the year dragged to ${y} (${v.txt})`);}
  await p.evaluate(()=>{selected=null;pagerOff=false;lastAutoIdx=-1;position=posForYear(1925);render();});await p.waitForTimeout(250);
  let ids=[];for(let k=0;k<6;k++){const btn=p.locator('#pgHost [data-step="1"]');if(await btn.getAttribute('aria-disabled')==='true')break;if(opts.hasTouch)await btn.tap().catch(()=>{});else await btn.click().catch(()=>{});await p.waitForTimeout(150);ids.push(await p.evaluate(()=>selected&&selected.record.id));}
  ck(ids.at(-1)==='EVT-0152',n+'F-174: Next from a dragged year runs on to EVT-0152 ('+ids.join(', ')+')');
  // Previous from the last card, and the X closes the pager (F-147)
  await p.click('#pgHost [data-step="-1"]').catch(()=>p.locator('#pgHost [data-step="-1"]').tap().catch(()=>{}));await p.waitForTimeout(200);
  s=await p.evaluate(()=>document.querySelector('#pgHost .pgn').firstChild.textContent);ck(s===`${T-1} of ${T}`,n+'Previous steps back from the last card ('+s+')');
  await p.evaluate(()=>closeStory());await p.waitForTimeout(300);s=await p.evaluate(()=>document.querySelector('#pgHost .ojjpg').hidden);ck(s===true,n+'the X still hides the pager (F-147)');
  await c.close();}
// F-171: the page does not scroll at 950 to 1300 px wide on screens 768 px tall or more; the panel is under 610 px at 1024 x 768
for(const pg of ['events','movements'])for(const [w,h] of [[950,768],[1024,768],[1100,800],[1180,820],[1300,900]]){const c=await b.newContext({viewport:{width:w,height:h}});const p=await c.newPage();await p.goto(BASE+pg+'.html');await p.waitForTimeout(2800);
  const r=await p.evaluate(()=>({doc:document.documentElement.scrollHeight,vh:innerHeight,panel:Math.round(document.getElementById('panel').getBoundingClientRect().height)}));
  ck(r.doc<=r.vh+1&&(w!==1024||r.panel<610),`F-171 ${pg} ${w}x${h}: page ${r.doc} px in a ${r.vh} px window, panel ${r.panel} px`);await c.close();}
ck(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));console.log(bad?'FAILED '+bad:'ALL PASS');await b.close();process.exit(bad?1:0);})();
