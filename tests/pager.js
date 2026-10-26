// Shared card pager (pager.js, Creative Design comp P1, counter W1; CEO 10/22). Reference page: archaeology.html.
// Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/pager.js   (headless Chromium only)
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
(async()=>{const b=await chromium.launch();const errs=[];
for(const [vw,vh,tag] of [[1280,800,'desktop'],[390,844,'phone'],[320,640,'small phone']]){
  const n=tag+': ';const ctx=await b.newContext({viewport:{width:vw,height:vh},hasTouch:vw<500});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(n+e.message));
  await p.goto(BASE+'archaeology.html?drafts=1');await p.waitForTimeout(2000);await p.click('#begin');
  const g=()=>p.evaluate(()=>{const e=document.querySelector('#card .ojjpg');return {hidden:e.hidden,dots:e.querySelectorAll('.dotb').length,cur:e.querySelectorAll('.dotb[aria-current=true]').length,txt:e.querySelector('.pgn').childNodes[0].textContent,live:e.querySelector('.pgn').getAttribute('aria-live'),prev:e.querySelector('[data-step="-1"]').getAttribute('aria-disabled'),next:e.querySelector('[data-step="1"]').getAttribute('aria-disabled'),w:e.clientWidth,aria:[...e.querySelectorAll('button')].every(x=>x.getAttribute('aria-label')),};});
  let s=await g();
  ck(!s.hidden&&/^\d+ of \d+$/.test(s.txt),n+'counter reads "9 of 11" (W1, no "entries"): "'+s.txt+'"');
  ck(s.cur===1&&s.live==='polite'&&s.aria,n+'one current dot, counter is a polite live region, every control has an aria-label');
  const want=await p.evaluate(w=>OJJPager.windowFor(w),s.w);ck(s.dots===Math.min(want,+s.txt.split(' of ')[1])&&[3,5,7].includes(s.dots),n+'window is '+s.dots+' dots for a strip '+s.w+' px wide (7, 5 or 3, whichever fits without overlap)');
  const box=await p.evaluate(()=>{const e=document.querySelector('#card .ojjpg');const r=x=>{const q=x.getBoundingClientRect();return [q.width,q.height];};return {a:[...e.querySelectorAll('.pgb')].map(r),d:[...e.querySelectorAll('.dotb')].map(r),div:getComputedStyle(e).borderTopWidth};});
  ck(box.a.every(x=>x[0]>=43.5&&x[1]>=43.5)&&box.d.every(x=>x[1]>=43.5&&x[0]>=23.5),n+'arrows are 44 x 44 and dots have a 44 px tall hit area (24 px wide)');
  ck(await p.evaluate(()=>{const e=document.querySelector('#card .ojjpg'),c=[...e.children].map(x=>x.getBoundingClientRect());return c.every((r,i)=>i===0||r.left>=c[i-1].right-.5)&&c[c.length-1].right<=e.getBoundingClientRect().right+.5;}),n+'arrows, dots and counter do not overlap');
  ck(box.div==='1px',n+'thin divider line above the strip');
  // ends
  await p.evaluate(()=>{const l=ARC.carousel();ARC.select(l[0].id);});await p.waitForTimeout(900);s=await g();
  ck(s.prev==='true'&&s.next!=='true'&&/^1 of /.test(s.txt),n+'first item: Previous is aria-disabled');
  const before=await p.evaluate(()=>ARC.state().SEL);await p.click('#card .ojjpg [data-step="-1"]',{force:true});await p.waitForTimeout(300);
  ck(await p.evaluate(b=>ARC.state().SEL===b,before),n+'Previous does nothing at the first item (no wrap-around)');
  await p.evaluate(()=>{const l=ARC.carousel();ARC.select(l[l.length-1].id);});await p.waitForTimeout(900);s=await g();
  ck(s.next==='true'&&s.prev!=='true',n+'last item: Next is aria-disabled');
  // keys
  await p.evaluate(()=>{const l=ARC.carousel();ARC.select(l[2].id);});await p.waitForTimeout(900);const a0=await p.evaluate(()=>ARC.state().SEL);
  await p.keyboard.press('ArrowRight');await p.waitForTimeout(900);const a1=await p.evaluate(()=>ARC.state().SEL);await p.keyboard.press('ArrowLeft');await p.waitForTimeout(900);
  ck(a1!==a0&&await p.evaluate(a=>ARC.state().SEL===a,a0),n+'right and left arrow keys step and return');
  // focus ring
  await p.focus('#card .ojjpg [data-step="1"]');await p.keyboard.press('Shift+Tab');await p.keyboard.press('Tab');
  ck(await p.evaluate(()=>{const f=document.activeElement;return f&&f.classList.contains('pgb')&&parseFloat(getComputedStyle(f).outlineWidth)>=3;}),n+'keyboard focus shows a 3 px ring');
  // one item: hidden
  await p.evaluate(()=>{ARC.setView({lon:35.2,lat:31.8,degW:40},0);ARC.setYear(1830);});await p.waitForTimeout(500);
  ck(await p.evaluate(()=>{const l=ARC.carousel();const e=document.querySelector('#card .ojjpg');return l.length<2?e.hidden:!e.hidden;}),n+'pager is hidden when there is one item or none');
  await ctx.close();}
ck(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));console.log(bad?'FAILED '+bad:'ALL PASS');await b.close();process.exit(bad?1:0);})();
