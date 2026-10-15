// F-085 subnav: flag off = original controls; flag on = Map key + collapsing routes pill (+ Reset for map position) and the Movements era pill.
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
(async()=>{const b=await chromium.launch();const errs=[];
let p=await b.newPage();p.on('pageerror',e=>errs.push(e.message));
for(const pg of ['index','movements']){await p.goto(BASE+pg+'.html?nav=old');await p.waitForTimeout(1500);ck(!(await p.$('.subdock'))&&(await p.$eval('#reset',x=>getComputedStyle(x).display))!=='none',pg+' flag off: original Map key, toggle and Reset, no subnav');}
await p.goto(BASE+'movements.html?nav=glass');await p.waitForTimeout(1800);
const cur=()=>p.evaluate(()=>document.querySelector('.gc-cur')?.textContent||null);
await p.click('.subdock .gp-btn[data-value=past]');await p.waitForTimeout(400);
ck(await p.$eval('[data-trails=on]',x=>x.getAttribute('aria-pressed'))==='true','past routes switch works through the page control');
await p.waitForTimeout(2400);ck(await cur()==='With past routes','pill collapses to the chosen value about 2 s after a pick');
await p.click('.gc-col');await p.waitForTimeout(300);ck(await cur()===null,'tap reopens it');
ck(!(await p.$eval('.subdock .gp-btn[data-value=reset]',x=>x.offsetParent!==null)),'Reset hidden while the map is at its default position');
await p.evaluate(()=>document.getElementById('mapWrap').dispatchEvent(new WheelEvent('wheel',{deltaY:-300,clientX:300,clientY:300,bubbles:true})));await p.waitForTimeout(700);
ck(await p.$eval('.subdock .gp-btn[data-value=reset]',x=>x.offsetParent!==null),'Reset appears after the map is moved');
await p.click('.subdock .gp-btn[data-value=reset]');await p.waitForTimeout(800);
ck(await p.evaluate(()=>MV.state().auto===true)&&await p.$eval('[data-trails=on]',x=>x.getAttribute('aria-pressed'))==='true','Reset restores the map position only (routes setting untouched)');
await p.click('.sd-era .gp-btn:nth-child(3)');await p.waitForTimeout(500);ck(await p.evaluate(()=>Math.round(MV.state().Y))<0,'era pill jumps to the era start');
await p.click('#keyBtn');ck(await p.$eval('#key',x=>!x.hidden),'Map key opens');
ck(errs.length===0,'no page errors '+errs.join('|'));
await b.close();console.log(bad?'FAILURES: '+bad:'ALL PASS');process.exit(bad?1:0);})();
