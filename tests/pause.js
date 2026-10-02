const {chromium,devices}=require('playwright');(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
for(const d of ['iPhone 13','iPad (gen 7)','Desktop Chrome']){const c=await b.newContext({...devices[d]});const p=await c.newPage();await p.goto(''+(process.env.SITE||'http://localhost:8778/')+'');await p.waitForTimeout(2000);
const tap=async s=>d.startsWith('Desk')?p.locator(s).click():p.locator(s).tap();
await tap('#introPlay');await p.waitForTimeout(1500);const t1=await p.evaluate(()=>[$('play').textContent,tour!=null]);
await tap('#play');await p.waitForTimeout(500);const y1=await p.evaluate(()=>currentYear());await p.waitForTimeout(1000);const y2=await p.evaluate(()=>currentYear());
console.log(d,JSON.stringify(t1),JSON.stringify(await p.evaluate(()=>[$('play').textContent,tour!=null])),'stopped:',y1===y2);await c.close();}
await b.close();})();
