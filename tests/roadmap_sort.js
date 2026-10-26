// F-131: Roadmap opens sorted A to Z by the first column (ID) and hides Built/Live until "Show all". Needs a seed CSV (SEED=...).
const {chromium}=require('playwright');const SITE=process.env.SITE||'http://localhost:8778/';const MW=require('./mockworker');
(async()=>{const mw=await MW.start(process.env.SEED||'/tmp/claude-0/rm/seed.csv');const b=await chromium.launch();let fail=0;const ck=(n,ok,x)=>{console.log((ok?'ok   ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)fail++;};
const ctx=await b.newContext({viewport:{width:1000,height:800}});await mw.attach(ctx);const p=await ctx.newPage();
await p.goto(SITE+'roadmap.html');await p.fill('#gatePw',MW.CODE);await p.keyboard.press('Enter');await p.waitForSelector('#tbody tr');
const ids=async()=>p.$$eval('#tbody tr td:first-child',t=>t.map(x=>x.textContent.trim()));
let a=await ids();ck('default: IDs run A to Z',JSON.stringify(a)===JSON.stringify([...a].sort()),a);
ck('default: the Live item is hidden',!a.includes('F-009'));
ck('default: first column header says ascending',await p.$eval('#thead th:first-child',t=>t.getAttribute('aria-sort'))==='ascending');
await p.click('#showAll');a=await ids();ck('Show all: Live item appears and order stays A to Z',a.includes('F-009')&&JSON.stringify(a)===JSON.stringify([...a].sort()),a);
await b.close();process.exit(fail?1:0);})();
