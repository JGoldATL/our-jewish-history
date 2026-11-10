// Slice 1 (modern cards 1898 to 1932, data v5.0.0): the 15 new Events cards load, the arc reaches 1932, each modern card has its own spot on the arc, the 1898 era marker shows, and no page errors.
// Run: NODE_PATH=$(npm root -g) node tests/slice1.js   (needs python3 -m http.server 8778 in the repo root)
const {chromium}=require('playwright');const BASE=process.env.SITE||'http://localhost:8778/';
let fail=0;const ck=(n,ok,x)=>{console.log((ok?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)fail++;};
(async()=>{const b=await chromium.launch();const errs=[];
 for(const w of [390,1280]){const p=await b.newPage({viewport:{width:w,height:820}});p.on('pageerror',e=>errs.push(w+': '+e.message));await p.goto(BASE+'events.html');await p.waitForTimeout(2500);
  const r=await p.evaluate(()=>{const ids=[];for(let i=138;i<=152;i++)ids.push('EVT-0'+i);const ms=milestones.map(m=>m.record.id);const modern=milestones.filter(m=>m.date>=1898);
   const pos=modern.map(m=>posForYear(m.date));const uniqYears=[...new Set(modern.map(m=>m.date))];const gaps=[];for(let i=1;i<uniqYears.length;i++)gaps.push(posForYear(uniqYears[i])-posForYear(uniqYears[i-1]));
   const tickText=[...document.querySelectorAll('#arc text.tick, #arc .tick')].map(t=>t.textContent);
   return {has:ids.filter(i=>ms.includes(i)).length,modernCount:modern.length,end:DATA.timeline.end,minGap:Math.min(...gaps),tickText,pos1898:posForYear(1898),pos1932:posForYear(1932),ver:document.getElementById('version').textContent};});
  ck(w+'px: all 15 new Events cards are in the card list',r.has===15,r.has);
  ck(w+'px: timeline ends at 1932',r.end===1932,r.end);
  ck(w+'px: modern card years move forward along the arc (every gap above zero)',r.minGap>0,r.minGap);
  ck(w+'px: the arc gives 1898 to 1932 a visible stretch',r.pos1932-r.pos1898>0.02,{from:r.pos1898,to:r.pos1932});
  ck(w+'px: 1898 era marker is drawn',r.tickText.some(t=>/1898/.test(t)),r.tickText);
  ck(w+'px: footer reads v3.6.0, dv5.0.0',r.ver==='v3.6.0, dv5.0.0',r.ver);
  const sy=await p.evaluate(async()=>{SHEETSYMS??=sheetSymbolRecords();const oct=SHEETSYMS.filter(r=>r.sym==='destroyed').map(r=>r.c.id).sort();const seen={};for(const [id,place] of [['EVT-0138','Kishinev'],['EVT-0147','Ukraine'],['EVT-0152','Hebron']]){selectMilestone(milestones.findIndex(m=>m.record.id===id));await new Promise(r=>setTimeout(r,3200));seen[place]=[...document.querySelectorAll('g.sym')].map(g=>g.getAttribute('aria-label')||'').filter(t=>t.startsWith('Pogrom or attack: '+place)).length;}return {oct,seen};});
  ck(w+'px: five octagons, one per place and year (CHG-029 1881, EVT-0138, 0139, 0147, 0152; the linked CHG-030 and CHG-031 do not double up)',JSON.stringify(sy.oct)===JSON.stringify(['CHG-029','EVT-0138','EVT-0139','EVT-0147','EVT-0152']),sy.oct);
  ck(w+'px: the Era 8 camera stops put Kishinev, Ukraine and Hebron on screen, each with its octagon',sy.seen.Kishinev===1&&sy.seen.Ukraine===1&&sy.seen.Hebron===1,sy.seen);
  await p.close();}
 ck('no page errors',errs.length===0,errs);await b.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);})();
