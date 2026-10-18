// ?mapopts=1: silver text-pill bar (Map key, Routes, Reset) centred under the main nav. Flag off = the original left rail, unchanged.
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
const drag=async(p,sel)=>{const b=await (await p.$(sel)).boundingBox();const x=b.x+b.width*.55,y=b.y+b.height*.5;await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+60,y+30,{steps:6});};
(async()=>{const br=await chromium.launch();const errs=[];
for(const [pg,stage] of [['movements','#mapWrap'],['events','#stage']]){
  for(const [vw,vh,tag] of [[390,844,'phone'],[1280,800,'desktop']]){
    const ctx=await br.newContext({viewport:{width:vw,height:vh}});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));const n=pg+' '+tag+': ';
    await p.goto(BASE+pg+'.html');await p.waitForTimeout(1800);
    ck(!(await p.evaluate(()=>document.documentElement.classList.contains('mapopts'))),n+'flag off: no mapopts class');
    ck(await p.$eval('.rail',x=>getComputedStyle(x).position==='absolute'&&x.getBoundingClientRect().width<60),n+'flag off: original left rail');
    await p.goto(BASE+pg+'.html?mapopts=1');await p.waitForTimeout(2200);
    const r=await p.$eval('.rail',x=>{const b=x.getBoundingClientRect(),g=document.getElementById('gnBar').getBoundingClientRect();return {cx:b.x+b.width/2,top:b.top,h:b.height,w:b.width,gnb:g.bottom,sw:document.documentElement.scrollWidth,vw:innerWidth};});
    ck(Math.abs(r.cx-vw/2)<2,n+'bar centred');ck(r.top>=r.gnb-1&&r.top-r.gnb<12,n+'bar sits directly under the main nav');ck(r.h<=34,n+'bar is slim (height '+Math.round(r.h)+')');ck(r.sw<=r.vw,n+'no sideways scroll');
    ck(await p.$eval('.brand',(x,t)=>x.getBoundingClientRect().top>=t,r.top+r.h),n+'header sits below the bar, no overlap');
    const labels=await p.$$eval('.rail button',b=>b.filter(x=>x.offsetParent).map(x=>x.getAttribute('aria-label')));
    if(pg==='movements')ck(labels.length===3&&/^Routes/.test(labels[1]),n+'Map key, Routes, Reset');else ck(labels.length===2&&!labels.some(l=>/^Routes/.test(l)),n+'Events: Map key and Reset only, no Routes');
    await p.click('#keyBtn');await p.waitForTimeout(250);const kb=await (await p.$('#key')).boundingBox();ck(kb&&kb.x>=0&&kb.x+kb.width<=vw+1&&kb.y>0,n+'Map key opens fully in view');await p.click('#keyBtn');
    if(pg==='movements'){await p.click('.mo-rt');await p.waitForTimeout(200);const pb=await (await p.$('.rpop')).boundingBox();ck(pb&&pb.x>=0&&pb.x+pb.width<=vw+1,n+'Routes menu opens in view');await p.click('.rpop button:nth-child(2)');await p.waitForTimeout(900);ck(await p.$eval('.mo-rt',x=>x.classList.contains('on')),n+'With past routes selected');}
    ck(await p.$eval('.mo-rs',x=>x.classList.contains('dim')),n+'Reset dim until the map moves');
    await drag(p,stage);await p.waitForTimeout(500);
    ck(+(await p.$eval('.rail',x=>getComputedStyle(x).opacity))<=.3,n+'bar fades to 25% while dragging');await p.mouse.up();await p.waitForTimeout(800);
    ck(!(await p.$eval('.mo-rs',x=>x.classList.contains('dim'))),n+'Reset lights after the map moves');
    await p.click('.mo-rs');await p.waitForTimeout(1500);ck(await p.$eval('.mo-rs',x=>x.classList.contains('dim')),n+'Reset restores position and dims again');
    if(pg==='movements')ck(await p.$eval('.mo-rt',x=>x.classList.contains('on')),n+'Reset leaves With past routes alone');
    await p.goto(BASE+pg+'.html?mapopts=1');await p.waitForTimeout(1800);const seq=[];for(let i=0;i<9;i++){await p.keyboard.press('Tab');seq.push(await p.evaluate(()=>document.activeElement.id||document.activeElement.getAttribute('aria-label')||''));}
    ck(seq.indexOf('keyBtn')>=0&&/^Reset/.test(seq[seq.indexOf('keyBtn')+(pg==='movements'?2:1)]||''),n+'keyboard order: Map key then Routes then Reset ('+seq.join(' > ').slice(0,90)+')');
    await ctx.close();
  }
}
let ctx=await br.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});let p=await ctx.newPage();await p.goto(BASE+'movements.html?mapopts=1');await p.waitForTimeout(2000);
ck((await p.$eval('.rail',x=>getComputedStyle(x).transitionDuration)).startsWith('0s'),'reduced motion: no transition on the bar');await ctx.close();
ctx=await br.newContext({viewport:{width:390,height:844}});p=await ctx.newPage();await p.goto(BASE+'movements.html?mapopts=1');await p.waitForTimeout(1200);await p.goto(BASE+'events.html');await p.waitForTimeout(1500);
ck(await p.evaluate(()=>document.documentElement.classList.contains('mapopts')),'flag persists across pages in the tab');await p.goto(BASE+'events.html?mapopts=0');await p.waitForTimeout(1500);
ck(!(await p.evaluate(()=>document.documentElement.classList.contains('mapopts'))),'?mapopts=0 turns it off');await ctx.close();
ck(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
console.log(bad?'FAILED '+bad:'ALL PASS');await br.close();process.exit(bad?1:0);})();
