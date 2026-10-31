const {chromium,devices}=require('playwright');
(async()=>{const b=await chromium.launch();let f=0;
for(const pg of ['events','movements','archaeology','index']){const c=await b.newContext({...devices['iPhone 13']});const p=await c.newPage();
await p.goto('http://localhost:8778/'+pg+'.html?qp=reset');await p.waitForTimeout(1500);
for(const st of ['','full']){const r=await p.evaluate(s=>{const e=document.querySelector('#panel');if(!e)return 'nopanel';if(s)e.classList.add('full');const d=e.querySelector(':scope>div:first-child');return d?getComputedStyle(d,'::after').content:'nodiv'},st);
const ok=r==='none'||r==='normal'||r==='""'||r==='nopanel'||r==='nodiv';console.log(ok?'PASS':'FAIL',pg,st||'half','::after =',r);if(!ok)f++}
await c.close()}
await b.close();console.log(f?f+' FAILED':'ALL PASS');process.exit(f?1:0)})();
