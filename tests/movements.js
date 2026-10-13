// Movements page smoke test: no page errors, 68 routes, MOV-059 branch card, no horizontal scroll.
const {chromium,devices}=require('playwright');
(async()=>{const b=await chromium.launch();let fail=0;const ck=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}else console.log('ok  ',m);};
for(const [n,c] of [['ipad',{viewport:{width:1194,height:698}}],['phone',{...devices['iPhone 13']}]]){
const ctx=await b.newContext(c);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8778/movements.html?drafts=1');await p.waitForTimeout(1500);
ck(errs.length===0,n+' no page errors '+errs.join('|'));
ck(await p.evaluate(()=>MV.routes.length)===92,n+' 92 routes');
await p.evaluate(()=>{MV.setYear(1492);MV.selectRoute('MOV-059');});await p.waitForTimeout(300);
const t=await p.evaluate(()=>({h:document.querySelector('#card h2')?.textContent,s:document.querySelector('#card .sub')?.textContent,back:!!document.querySelector('#card .back'),sw:document.documentElement.scrollWidth,iw:innerWidth}));
ck(t.h==='Spain expels its Jews',n+' title');ck(t.s==='To the Ottoman lands',n+' subhead');ck(t.back,n+' back link');ck(t.sw<=t.iw,n+' no horizontal scroll');
await p.evaluate(()=>{MV.setYear(1654);MV.selectEvent('EVT-0071');});await p.waitForTimeout(200);
await p.click('#card .chips [data-par="MOV-055"]');await p.waitForTimeout(400);
const q=await p.evaluate(()=>({sub:document.querySelector('#card .sub')?.textContent,flow:document.querySelectorAll('path.flow').length,h:document.querySelector('#card h2').textContent}));
ck(q.sub==='To New Amsterdam'&&q.flow===3&&q.h==='The Jews of Recife are scattered',n+' parent chip MOV-055 lights 3 legs, keeps event title');
await p.evaluate(()=>MV.selectParent('MOV-054'));await p.waitForTimeout(200);
ck(await p.evaluate(()=>document.querySelectorAll('path.flow').length)===2&&await p.evaluate(()=>document.querySelector('#card .sub').textContent)==='To Barbados',n+' parent chip MOV-054 lights 2 legs');
await ctx.close();}
await b.close();process.exit(fail?1:0);})();
