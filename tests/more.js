// The More menu (bottom left) and the page controls, as they are today (replaces the retired tests/nav.js, tests/header.js and tests/subnav.js, F-132).
// Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/more.js   (headless Chromium only; no real iPad or phone)
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
const WANT=['Roadmap>roadmap.html','Strategy>strategy.html','Feedback>feedback.html','Sources>events.html?sources=1'];
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
for(const [dn,vp] of [['iPhone',{width:390,height:844}],['iPad',{width:820,height:1180}],['desktop',{width:1280,height:800}]]){
 for(const pg of ['events.html','movements.html','jewhate.html','archaeology.html','quiz.html','roadmap.html','feedback.html']){
  const ctx=await b.newContext({viewport:vp,hasTouch:dn!=='desktop'});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(dn+' '+pg+': '+e.message));
  await p.route(/cdnjs/,r=>r.fulfill({contentType:'text/javascript',body:''}));
  await p.goto(BASE+pg);await p.waitForTimeout(1800);const t=dn+' '+pg+': ';
  if(/^(roadmap|strategy)/.test(pg)&&await p.$('#gatePw')){ck(true,t+'gated page shows its password box (More not checked behind the gate)');await ctx.close();continue;}
  const btn=p.locator('#siteNavBtn');ck(await btn.isVisible(),t+'More button visible');
  const box=await btn.boundingBox();ck(!!box&&box.x<120&&box.y>vp.height-140&&box.y<vp.height,t+'More is bottom left and its top is on screen');
  {const over=await p.evaluate(()=>document.documentElement.scrollHeight-innerHeight);if(over>2)console.log('INFO '+t+'the page is '+over+' px taller than the window (it scrolls; On Events and Movements that pushes the bottom of the More button and footer below the fold)');}
  ck(await p.locator('#siteNavMenu').isHidden()&&(await btn.getAttribute('aria-expanded'))==='false',t+'menu starts closed');
  await btn.click();ck(await p.locator('#siteNavMenu').isVisible()&&(await btn.getAttribute('aria-expanded'))==='true',t+'tap opens');
  ck(JSON.stringify(await p.$$eval('#siteNavMenu a',a=>a.map(x=>x.textContent+'>'+x.getAttribute('href'))))===JSON.stringify(WANT),t+'menu lists '+WANT.map(x=>x.split('>')[0]).join(', '));
  const mb=await p.locator('#siteNavMenu').boundingBox();ck(!!mb&&mb.x>=0&&mb.y>=0&&mb.x+mb.width<=vp.width,t+'menu on screen');
  await p.keyboard.press('Escape');ck(await p.locator('#siteNavMenu').isHidden(),t+'Escape closes');
  await btn.click();await p.mouse.click(vp.width-20,60);ck(await p.locator('#siteNavMenu').isHidden(),t+'tap outside closes');
  ck(!(await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)),t+'no sideways scroll');
  const ver=await p.evaluate(()=>(document.getElementById('version')||document.getElementById('siteVer')||{}).textContent||'');ck(/^v\d+\.\d+\.\d+/.test(ver),t+'version shown ('+ver.trim()+')');
  await ctx.close();}}
// the globe pages keep Map key and Reset on screen at every width (replaces the retired header test)
for(const w of [1440,1180,1024,961,834,768,621,430,390,360]){
 for(const pg of ['index.html','events.html']){const p=await (await b.newContext({viewport:{width:w,height:w>900?900:844}})).newPage();p.on('pageerror',e=>errs.push(w+' '+pg+': '+e.message));
  await p.goto(BASE+pg);await p.waitForTimeout(1800);await p.evaluate(()=>{try{dismissPrompt();}catch(e){}});await p.waitForTimeout(250);
  const r=await p.evaluate(()=>{const R=e=>{if(!e)return null;const q=e.getBoundingClientRect();return {l:q.left,r:q.right,w:q.width,h:q.height};};return {key:R(document.getElementById('keyBtn')),reset:R(document.querySelector('.mo-rs')),vw:innerWidth,sw:document.documentElement.scrollWidth,tag:(()=>{const e=document.querySelector('.brand p');return e&&e.getBoundingClientRect().height>0&&getComputedStyle(e).display!=='none';})()};});
  ck(!!r.key&&r.key.w>0&&r.key.l>=0&&r.key.r<=r.vw,`${w} ${pg}: Map key is on screen`);if(pg==='events.html')ck(!!r.reset&&r.reset.w>0&&r.reset.l>=0&&r.reset.r<=r.vw,`${w} ${pg}: Reset is on screen`);ck(r.sw<=r.vw,`${w} ${pg}: no sideways scroll`);
  if(pg==='events.html')ck(r.tag,`${w} events.html: the title sentence shows under the title (F-130)`);
  await p.context().close();}}
ck(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));console.log(bad?'FAILED '+bad:'ALL PASS');await b.close();process.exit(bad?1:0);})();
