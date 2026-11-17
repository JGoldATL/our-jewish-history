// Share on every card: JewHate (see jewhate.js test), Events, Movements, old globe. Deep links open the item. Never a drafts link.
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
const fs=require('fs');const H=JSON.parse(fs.readFileSync(__dirname+'/../data/history.json','utf8')).sheet;
(async()=>{const b=await chromium.launch();
for(const vw of [1280,390]){const n=(vw>700?'desktop: ':'phone: ');
 const ctx=await b.newContext({viewport:{width:vw,height:vw>700?900:800},hasTouch:vw<=700});await ctx.addInitScript(()=>{window.__shared=null;Object.defineProperty(navigator,'share',{value:d=>{window.__shared=d;return Promise.resolve();},configurable:true});});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 // Events + old globe
 for(const pg of ['events.html','index.html']){
  const card=H.cards.find(c=>c.status==='approved'&&c.type==='Event');
  await p.goto(BASE+pg+'?card='+card.id+'&drafts=1');await p.waitForTimeout(2500);
  ck((await p.$eval('#storyTitle',x=>x.textContent))===card.title.replace(/ CE\b/g,''),n+pg+': ?card= opens that card ('+card.id+')');
  ck(await p.$eval('#shareSlot',x=>!x.hidden),n+pg+': Share visible on the card');
  const sz=await p.$eval('#shareSlot .ojj-share',x=>{const r=x.getBoundingClientRect();return Math.min(r.width,r.height);});ck(sz>=33.5,n+pg+': Share is 34 px (comp v3b; was 44) ('+sz.toFixed(0)+')');
  {const g=await p.evaluate(()=>{const b=document.querySelector('#shareSlot .ojj-share').getBoundingClientRect(),row=document.querySelector('#panel>div:first-child').getBoundingClientRect(),t=document.getElementById('storyTitle').getBoundingClientRect(),pl=document.getElementById('play'),pr=pl&&pl.offsetParent?pl.getBoundingClientRect():null,hit=(a,c)=>!(a.right<=c.left||a.left>=c.right||a.bottom<=c.top||a.top>=c.bottom);return {onYearRow:b.top>=row.top-14&&b.bottom<=row.bottom+14,noTitleOverlap:!hit(b,t),noPlayOverlap:!pr||!hit(b,pr),playLeftOfShare:!pr||pr.right<=b.left+1,noX:!document.getElementById('closeStory')};});ck(g.onYearRow&&g.noTitleOverlap&&g.noPlayOverlap&&g.noX,n+pg+': Share sits on the year row, clear of Play and the title, and there is no X ('+JSON.stringify(g)+')');}
  ck(!!(await p.$eval('#shareSlot .ojj-share',x=>x.getAttribute('aria-label')).then(a=>/^Share: /.test(a))),n+pg+': Share has an accessible name');
  await p.click('#shareSlot .ojj-share');await p.waitForTimeout(200);const s=await p.evaluate(()=>window.__shared);
  ck(s&&s.url.includes('?card='+card.id)&&!/drafts/.test(s.url)&&s.text==='Take a peek at this event from Jewish history\u2026',n+pg+': shares the card link with the Events opening line, no drafts flag');
 }
 // Movements
 const ev=await (async()=>{await p.goto(BASE+'movements.html');await p.waitForTimeout(2500);return p.evaluate(()=>{const e=[...MV.events.values()].find(x=>x.card&&x.routes.length>1);return {k:e.key,r:e.routes[1].id,t:e.title};});})();
 await p.goto(BASE+'movements.html?m='+encodeURIComponent(ev.k)+'&drafts=1');await p.waitForTimeout(2500);
 ck(await p.evaluate(k=>MV.state().SEL&&MV.state().SEL.ev===k,ev.k),n+'movements: ?m= opens that movement');
 ck((await p.$$eval('#shareSlot .ojj-share',x=>x.length))===1,n+'movements: exactly one Share on the card');
 const sz=await p.$eval('#shareSlot .ojj-share',x=>{const r=x.getBoundingClientRect();return Math.min(r.width,r.height);});ck(sz>=33.5,n+'movements: Share 34 px ('+sz.toFixed(0)+')');
 {const g=await p.evaluate(()=>{const b=document.querySelector('#shareSlot .ojj-share').getBoundingClientRect(),t=document.querySelector('#story h2').getBoundingClientRect(),hit=!(b.right<=t.left||b.left>=t.right||b.bottom<=t.top||b.top>=t.bottom);return {overlapTitle:hit,noX:!document.getElementById('closeStory')};});ck(!g.overlapTitle&&g.noX,n+'movements: Share on the year row, clear of the title, no X ('+JSON.stringify(g)+')');}
 await p.click('#shareSlot .ojj-share');await p.waitForTimeout(200);let s=await p.evaluate(()=>window.__shared);
 ck(s&&s.url.includes('?m=')&&!/drafts/.test(s.url)&&s.text==='Follow the Jewish journey with me\u2026'&&/Our Jewish Journey/.test(s.title),n+'movements: shares link with the Movements opening line');
 await p.goto(BASE+'movements.html?m='+encodeURIComponent(ev.k)+'&r='+encodeURIComponent(ev.r));await p.waitForTimeout(2500);
 ck(await p.evaluate(r=>MV.state().SEL&&MV.state().SEL.id===r,ev.r),n+'movements: ?m=&r= opens that route');
 await p.click('#shareSlot .ojj-share');await p.waitForTimeout(200);s=await p.evaluate(()=>window.__shared);ck(s&&s.url.includes('&r='),n+'movements: route share keeps the route');
 // no share on the intro (no card open)
 await p.goto(BASE+'movements.html');await p.waitForTimeout(2000);ck((await p.$$eval('#shareSlot',x=>x.filter(e=>!e.hidden).length))===0,n+'movements: no Share on the intro text');
 ck(errs.length===0,n+'no page errors '+errs.join('|'));
 await ctx.close();}
await b.close();console.log(bad?'FAILED '+bad:'ALL PASS');process.exit(bad?1:0);})();
