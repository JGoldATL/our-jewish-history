// F-107: a Google Analytics "share" event on every Share tap (JewHate, Events, Movements, Archaeology, old globe, quiz). Only the page kind, the method and the page path go out.
// Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/sharetrack.js   (headless Chromium only)
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
const fs=require('fs');const H=JSON.parse(fs.readFileSync(__dirname+'/../data/history.json','utf8')).sheet;
(async()=>{const b=await chromium.launch();const errs=[];
const stub=async(p,sheet)=>p.addInitScript(sh=>{window.__ev=[];window.gtag=function(){window.__ev.push([].slice.call(arguments));};if(sh)Object.defineProperty(navigator,'share',{value:d=>Promise.resolve(),configurable:true});},sheet);
const ev=p=>p.evaluate(()=>window.__ev.filter(e=>e[0]==='event'&&e[1]==='share'));
const clean=e=>Object.keys(e[2]).every(k=>['content_type','method','page_path'].includes(k))&&!/http|drafts/.test(JSON.stringify(e));
const cases=[
 ['events',async p=>{const c=H.cards.find(x=>x.status==='approved'&&x.type==='Event');await p.goto(BASE+'events.html?card='+c.id);await p.waitForTimeout(2500);return '#shareSlot .ojj-share';},'events'],
 ['old globe',async p=>{const c=H.cards.find(x=>x.status==='approved'&&x.type==='Event');await p.goto(BASE+'index.html?card='+c.id);await p.waitForTimeout(2500);return '#shareSlot .ojj-share';},'events'],
 ['jewhate',async p=>{await p.goto(BASE+'jewhate.html');await p.waitForTimeout(2200);return '.card.cur .ojj-share';},'jewhate'],
 ['archaeology',async p=>{await p.goto(BASE+'archaeology.html');await p.waitForTimeout(2200);await p.click('#begin');return '#story .ojj-share';},'archaeology'],
 ['movements',async p=>{await p.goto(BASE+'movements.html');await p.waitForTimeout(2500);const k=await p.evaluate(()=>[...MV.events.values()].find(x=>x.card&&x.routes.length>1).key);await p.goto(BASE+'movements.html?m='+encodeURIComponent(k));await p.waitForTimeout(2500);return '#story .ojj-share';},'movements']];
for(const [nm,open,kind] of cases){for(const sheet of [true,false]){
  const c=await b.newContext({viewport:{width:1280,height:900}});const p=await c.newPage();p.on('pageerror',e=>errs.push(nm+': '+e.message));await stub(p,sheet);
  const sel=await open(p);await p.click(sel);await p.waitForTimeout(300);const e=await ev(p);
  ck(e.length===1&&e[0][2].content_type===kind&&e[0][2].method===(sheet?'share_sheet':'copy_link')&&clean(e[0]),`${nm} (${sheet?'device share sheet':'copy link'}): one share event, kind "${kind}", no title or link sent`);
  await c.close();}}
// quiz: tap Share your score
{const c=await b.newContext({viewport:{width:390,height:844}});const p=await c.newPage();p.on('pageerror',e=>errs.push('quiz: '+e.message));await stub(p,false);
 await p.route(/cdnjs/,r=>r.fulfill({contentType:'text/javascript',body:''}));   // the quiz works without the little globe
 await p.goto(BASE+'quiz.html');await p.waitForSelector('.choice, .msg');for(let n=0;n<3;n++){await p.waitForSelector('.choice:not([disabled])');const order=await p.evaluate(()=>!!document.querySelector('.hint'));if(order){const k=await p.$$eval('.choice',x=>x.length);for(let i=0;i<k;i++)await p.click(`.choice[data-k="${i}"]`);}else await p.click('.choice');await p.click('#submit');await p.click('#next');}await p.waitForSelector('#share');await p.evaluate(()=>document.getElementById('share').click());await p.waitForTimeout(300);const e=await ev(p);
 ck(e.length===1&&e[0][2].content_type==='quiz_score'&&clean(e[0]),'quiz Share your score: one share event, no score or answer sent');await c.close();}
// no gtag at all: Share still works and nothing breaks
{const c=await b.newContext({viewport:{width:1280,height:900}});const p=await c.newPage();p.on('pageerror',e=>errs.push('nogtag: '+e.message));
 await p.goto(BASE+'jewhate.html');await p.waitForTimeout(2200);await p.evaluate(()=>{delete window.gtag;});await p.click('.card.cur .ojj-share');await p.waitForTimeout(300);ck(true,'no gtag (blocked): Share tap runs without errors');await c.close();}
ck(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));console.log(bad?'FAILED '+bad:'ALL PASS');await b.close();process.exit(bad?1:0);})();
