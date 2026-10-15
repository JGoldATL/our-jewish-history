// F-085 subnav, Layout 3: flag off = original controls; flag on = floating left rail (Map key, routes, Reset) + Movements era pill.
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
(async()=>{const b=await chromium.launch();const errs=[];
let p=await b.newPage({viewport:{width:1194,height:834}});p.on('pageerror',e=>errs.push(e.message));
for(const pg of ['index','movements']){await p.goto(BASE+pg+'.html?nav=old');await p.waitForTimeout(1500);ck(!(await p.$('.rail'))&&(await p.$eval('#reset',x=>getComputedStyle(x).display))!=='none',pg+' flag off: original Map key, toggle and Reset, no rail');}
await p.goto(BASE+'movements.html?nav=glass');await p.waitForTimeout(1800);
ck(!!(await p.$('#mapWrap .rail #keyBtn')),'Movements: rail holds Map key');
const box=await p.$eval('.rail',x=>{const r=x.getBoundingClientRect(),m=document.getElementById('mapWrap').getBoundingClientRect();return {l:r.left-m.left,t:r.top-m.top,h:r.height,mh:m.height};});
ck(box.l<30&&box.t>40&&box.t+box.h<box.mh,'rail floats at the map left edge, inside the map');
ck(!(await p.$('.sd-row')),'no separate control row (rail takes no layout height)');
await p.click('.rail .rb[aria-label^=Routes]');await p.waitForTimeout(250);
ck(await p.$eval('.rpop',x=>!x.hidden),'routes button opens its panel');
await p.click('.rpop button:nth-child(2)');await p.waitForTimeout(300);
ck(await p.$eval('[data-trails=on]',x=>x.getAttribute('aria-pressed'))==='true','With past routes works through the page control');
await p.waitForTimeout(900);ck(await p.$eval('.rpop',x=>x.hidden),'panel closes after a pick');
ck(await p.$eval('.rail .rb.on',x=>!!x),'routes button shows it is on');
ck(await p.$eval('.rail .rb[aria-label^=Reset]',x=>x.classList.contains('dim')),'Reset dim while map at default');
await p.evaluate(()=>document.getElementById('mapWrap').dispatchEvent(new WheelEvent('wheel',{deltaY:-300,clientX:500,clientY:300,bubbles:true})));await p.waitForTimeout(700);
ck(await p.$eval('.rail .rb[aria-label^=Reset]',x=>!x.classList.contains('dim')),'Reset lights after the map is moved');
await p.click('.rail .rb[aria-label^=Reset]');await p.waitForTimeout(800);
ck(await p.evaluate(()=>MV.state().auto===true)&&await p.$eval('[data-trails=on]',x=>x.getAttribute('aria-pressed'))==='true','Reset restores the map position only (routes setting untouched)');
await p.click('.sd-era .gp-btn:nth-child(3)');await p.waitForTimeout(500);ck(await p.evaluate(()=>Math.round(MV.state().Y))<0,'era pill jumps to the era start');
await p.click('#keyBtn');await p.waitForTimeout(200);ck(await p.$eval('#key',x=>!x.hidden),'Map key opens');
const kb=await p.$eval('#key',x=>{const r=x.getBoundingClientRect();return r.left>40&&r.right<innerWidth;});ck(kb,'key panel sits beside the rail, on screen');
await p.screenshot({path:process.env.SHOT||'/tmp/rail-desk.png'});
// phone
const ph=await b.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});ph.on('pageerror',e=>errs.push(e.message));
await ph.goto(BASE+'movements.html?nav=glass');await ph.waitForTimeout(1800);
const pb=await ph.$eval('.rail',x=>{const r=x.getBoundingClientRect();return r.left>=0&&r.right<390;});ck(pb,'phone: rail on screen');
await ph.click('#keyBtn');await ph.waitForTimeout(200);
ck(await ph.$eval('#key',x=>{const r=x.getBoundingClientRect();return !x.hidden&&r.left>=0&&r.right<=390;}),'phone: key panel fits');
await ph.screenshot({path:process.env.SHOT2||'/tmp/rail-phone.png'});
// globe
await p.goto(BASE+'index.html?nav=glass');await p.waitForTimeout(1800);
ck(!!(await p.$('#stage .rail')),'globe: rail present');
await p.goto(BASE+'events.html?nav=glass');await p.waitForTimeout(1800);
ck(!!(await p.$('#stage .rail')),'events: rail present');
ck(errs.length===0,'no page errors '+errs.join('|'));
await b.close();console.log(bad?'FAILURES: '+bad:'ALL PASS');process.exit(bad?1:0);})();
