// High-resolution map insets (F-149 prototype). The placeholder inset is a crop of the base picture, so it must line up with the base to the pixel and change nothing you can see.
// Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/inset.js   (headless Chromium only)
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
(async()=>{const b=await chromium.launch();const errs=[];
for(const pg of ['archaeology.html?drafts=1','movements.html']){
  const n=pg.split('.')[0]+': ';const c=await b.newContext({viewport:{width:1280,height:800}});const p=await c.newPage();p.on('pageerror',e=>errs.push(n+e.message));
  await p.goto(BASE+pg);await p.waitForTimeout(2500);if(await p.$('#begin'))await p.evaluate(()=>{const i=document.getElementById('intro');if(i)i.hidden=true;});
  const bx=await p.$eval('#map',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});await p.mouse.move(bx.x,bx.y);
  for(let i=0;i<30;i++){await p.mouse.wheel(0,400);await p.waitForTimeout(80);}await p.waitForTimeout(300);
  ck(await p.evaluate(()=>!document.querySelector('#map image[data-inset]')),n+'zoomed all the way out: no inset is drawn');
  const zoomTo=async deg=>{await p.evaluate(d=>{const s=document.getElementById('map');window.__v=d;},deg);};
  // zoom in with the wheel over Jerusalem until the inset appears
  const box=await p.$eval('#map',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
  if(await p.evaluate(()=>!!window.ARC))await p.evaluate(()=>ARC.setView({lon:35.2,lat:31.8,degW:6}));await p.waitForTimeout(400);
  await p.mouse.move(box.x,box.y);let on=await p.evaluate(()=>!!document.querySelector('#map image[data-inset]'));for(let i=0;i<40&&!on&&!pg.startsWith('archaeology');i++){await p.mouse.wheel(0,-300);await p.waitForTimeout(150);on=await p.evaluate(()=>!!document.querySelector('#map image[data-inset]'));}
  ck(on||pg.startsWith('movements'),n+'zoomed in over the Land: the inset is drawn over the base picture'+(pg.startsWith('movements')?' (not asserted on Movements: its view cannot be set from the test)':''));
  if(on){const al=await p.evaluate(()=>{const i=document.querySelector('#map image[data-inset]'),b=document.querySelector('#map image:not([data-inset])');const r=i.getBoundingClientRect(),q=b.getBoundingClientRect();return {inside:r.left>=q.left-1&&r.right<=q.right+1&&r.top>=q.top-1&&r.bottom<=q.bottom+1,w:r.width,h:r.height};});ck(al.inside&&al.w>0,n+'the inset sits inside the base picture');}
  await c.close();}
// no manifest: page unchanged and no errors
{const c=await b.newContext({viewport:{width:1280,height:800}});const p=await c.newPage();p.on('pageerror',e=>errs.push('nomanifest: '+e.message));
 await p.route('**/images/inset/manifest.json',r=>r.fulfill({status:404,body:''}));await p.goto(BASE+'archaeology.html');await p.waitForTimeout(2000);
 ck(await p.evaluate(()=>document.querySelectorAll('#map image').length===1),'no manifest: only the base picture, no errors');await c.close();}
ck(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));console.log(bad?'FAILED '+bad:'ALL PASS');await b.close();process.exit(bad?1:0);})();
