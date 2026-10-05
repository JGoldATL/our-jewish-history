// Clicking an engine map object that has a Sheet card (data.cardLinks) opens that card, and every link points at a real card.
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();await p.goto(process.env.SITE||'http://localhost:8778/');await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{dismissPrompt();const bad=[],ok=[];const find=id=>[['movement',DATA.movements],['population',DATA.populations],['event',DATA.historicalEvents],['destruction',DATA.communityDestructions],['change',DATA.populationChanges]].map(([t,c])=>[t,c.find(r=>r.id===id)]).find(x=>x[1]);
 for(const [eid,cid] of Object.entries(DATA.cardLinks)){const f=find(eid);if(!f){bad.push('no engine object '+eid);continue;}if(!milestones.some(m=>m.record.id===cid)){bad.push('no card '+cid);continue;}openStory(f[1],f[0]);if(selected.type==='sheet'&&selected.record.id===cid&&$('storyTitle').textContent===selected.record.title)ok.push(eid);else bad.push('wrong card for '+eid);}
 // an object with no link still opens its own text
 const unlinked=DATA.populations.find(p=>!DATA.cardLinks[p.id]);openStory(unlinked,'population');const own=selected.type==='population';
 return {linked:Object.keys(DATA.cardLinks).length,ok:ok.length,bad,unlinkedOpensOwnText:own};});
console.log(JSON.stringify(r),r.bad.length===0&&r.ok===r.linked&&r.unlinkedOpensOwnText?'PASS':'FAIL');await b.close();})();
