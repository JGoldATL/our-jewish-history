// Play holds for 2 seconds on each card and moves on. Run: NODE_PATH=$(npm root -g) node tests/dwell.js  (server on :8778)
const {chromium}=require('playwright');const SITE=process.env.SITE||'http://localhost:8778/';
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});let fail=0;const ck=(n,ok,x)=>{console.log((ok?'ok   ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)fail++;};
const ctx=await b.newContext({viewport:{width:1180,height:820}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(SITE+'index.html');await p.waitForTimeout(2500);await p.evaluate(()=>{try{dismissPrompt()}catch(e){}});
const DWELL=await p.evaluate(()=>DATA.presentation?.cardDwellMs??2000);ck('dwell is 2000 ms',DWELL===2000,DWELL);
await p.evaluate(()=>{window.__log=[];const t0=performance.now();setInterval(()=>window.__log.push([Math.round(performance.now()-t0),document.getElementById('storyTitle').textContent,Math.round(currentYear()*10)/10]),50);});
await p.click('#play');await p.waitForTimeout(45000);
const log=await p.evaluate(()=>window.__log);
// group into runs of the same card title
const runs=[];for(const [t,title,y] of log){const r=runs.at(-1);if(r&&r.title===title){r.end=t;r.y1=y;}else runs.push({title,start:t,end:t,y0:y,y1:y});}
const done=runs.slice(0,-1).filter(r=>r.title);
ck('at least 5 cards came up in 45 seconds',done.length>=5,done.length);
ck('every card stayed on screen for about 2 seconds or more',done.every(r=>r.end-r.start>=1800),done.map(r=>[r.title.slice(0,24),r.end-r.start]));
ck('the year does not move while a card is held (first 1.8 s)',done.every(r=>{const pts=log.filter(x=>x[0]>=r.start&&x[0]<=r.start+1800&&x[1]===r.title);return Math.max(...pts.map(x=>x[2]))-Math.min(...pts.map(x=>x[2]))<=0.6;}));
const gaps=done.slice(1).map((r,i)=>r.start-done[i].end);ck('between cards the globe keeps moving (no card change is instant stalls beyond the hold)',gaps.every(g=>g<=400),gaps);
ck('no page errors',errs.length===0,errs);
console.log(fail?'FAIL '+fail:'PASS');await b.close();process.exit(fail?1:0);})();
