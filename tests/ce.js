// Common Era rule: years are bare (1654, not 1654 CE); BCE stays; CE survives only inside a string that also says BCE.
// Run: NODE_PATH=$(npm root -g) node tests/ce.js   (server on :8778)
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8778/');await p.waitForTimeout(2500);await p.evaluate(()=>dismissPrompt());
const r=await p.evaluate(()=>{
  const bad=[];const walk=(o,path)=>{if(typeof o==='string'){if(/\bCE\b/.test(o)&&!/\bBCE\b/.test(o))bad.push(path+': '+o.slice(0,60));}else if(Array.isArray(o))o.forEach((x,i)=>walk(x,path+'['+i+']'));else if(o&&typeof o==='object')for(const k in o)walk(o[k],path+'.'+k);};
  walk(DATA,'DATA');
  return {bad:bad.slice(0,5),n:bad.length,y1654:yearLabel(1654),y70:yearLabel(70),ybce:yearLabel(-586),y0:yearLabel(0),
    mixed:plainCE('200 BCE to 70 CE'),plain:plainCE('1654 CE'),cent:plainCE('8th–11th century CE'),range:plainCE('1096–1099 CE'),c:plainCE('c. 800 CE onward')};});
console.log(JSON.stringify(r));
ok(r.n===0,'no stray "CE" left in loaded data ('+r.n+')');
ok(r.y1654==='1654'&&r.y70==='70'&&r.ybce==='586 BCE'&&r.y0==='1 BCE / 1 CE','yearLabel');
ok(r.mixed==='200 BCE to 70 CE','CE kept in a string that also says BCE');
ok(r.plain==='1654'&&r.cent==='8th–11th century'&&r.range==='1096–1099'&&r.c==='c. 800 onward','bare years, ranges and centuries');
// what is on screen: open the 1654 card and read the panel + arc labels
await p.evaluate(()=>setYearExact(1654));await p.waitForTimeout(1200);
const txt=await p.evaluate(()=>document.body.innerText);
ok(!/\d\s+CE\b/.test(txt),'no "CE" after a year on screen at 1654');
ok(/1654/.test(txt),'1654 still shown');
ok(await p.$eval('#year',e=>e.textContent.trim())==='1654','big year reads 1654 with no CE');
await p.evaluate(()=>setYearExact(-586));await p.waitForTimeout(800);
ok(/BCE/.test(await p.evaluate(()=>document.body.innerText)),'BCE still shown at 586 BCE');
ok((await p.$eval('#year',e=>e.textContent.trim()))==='586BCE'||/586\s*BCE/.test(await p.$eval('#year',e=>e.textContent)),'big year keeps BCE');
ok(!errs.length,'no page errors '+errs.join('|'));
await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
