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
  const sz=await p.$eval('#shareSlot .ojj-share',x=>{const r=x.getBoundingClientRect();return Math.min(r.width,r.height);});ck(sz>=43.5,n+pg+': Share is at least 44 px ('+sz.toFixed(0)+')');
  {const g=await p.evaluate(()=>{const b=document.querySelector('#shareSlot .ojj-share').getBoundingClientRect(),s=document.querySelector('#story').getBoundingClientRect(),c=document.querySelector('#closeStory').getBoundingClientRect();return {top:b.top-s.top,fromRight:s.right-b.right,leftOfClose:b.right<=c.left+1,overlapClose:!(b.right<=c.left||b.left>=c.right||b.bottom<=c.top||b.top>=c.bottom)};});ck(g.top<=14&&g.fromRight<=90&&!g.overlapClose,n+pg+': Share sits at the top right of the card, clear of the close button ('+JSON.stringify(g)+')');}
  ck(!!(await p.$eval('#shareSlot .ojj-share',x=>x.getAttribute('aria-label')).then(a=>/^Share: /.test(a))),n+pg+': Share has an accessible name');
  await p.click('#shareSlot .ojj-share');await p.waitForTimeout(200);const s=await p.evaluate(()=>window.__shared);
  ck(s&&s.url.includes('?card='+card.id)&&!/drafts/.test(s.url)&&s.text==='Take a peek at this event from Jewish history\u2026',n+pg+': shares the card link with the Events opening line, no drafts flag');
 }
 // Movements
 const ev=await (async()=>{await p.goto(BASE+'movements.html');await p.waitForTimeout(2500);return p.evaluate(()=>{const e=[...MV.events.values()].find(x=>x.card&&x.routes.length>1);return {k:e.key,r:e.routes[1].id,t:e.title};});})();
 await p.goto(BASE+'movements.html?m='+encodeURIComponent(ev.k)+'&drafts=1');await p.waitForTimeout(2500);
 ck(await p.evaluate(k=>MV.state().SEL&&MV.state().SEL.ev===k,ev.k),n+'movements: ?m= opens that movement');
 ck((await p.$$eval('#story .ojj-share',x=>x.length))===1,n+'movements: exactly one Share on the card');
 const sz=await p.$eval('#story .ojj-share',x=>{const r=x.getBoundingClientRect();return Math.min(r.width,r.height);});ck(sz>=43.5,n+'movements: Share at least 44 px ('+sz.toFixed(0)+')');
 {const g=await p.evaluate(()=>{const b=document.querySelector('#story .ojj-share').getBoundingClientRect(),s=document.querySelector('#story').getBoundingClientRect(),c=document.querySelector('#closeStory').getBoundingClientRect();return {top:b.top-s.top,fromRight:s.right-b.right,overlapClose:!(b.right<=c.left||b.left>=c.right||b.bottom<=c.top||b.top>=c.bottom)};});ck(g.top<=14&&g.fromRight<=90&&!g.overlapClose,n+'movements: Share at the top right of the card, clear of the close button ('+JSON.stringify(g)+')');}
 await p.click('#story .ojj-share');await p.waitForTimeout(200);let s=await p.evaluate(()=>window.__shared);
 ck(s&&s.url.includes('?m=')&&!/drafts/.test(s.url)&&s.text==='Follow the Jewish journey with me\u2026'&&/Our Jewish Journey/.test(s.title),n+'movements: shares link with the Movements opening line');
 await p.goto(BASE+'movements.html?m='+encodeURIComponent(ev.k)+'&r='+encodeURIComponent(ev.r));await p.waitForTimeout(2500);
 ck(await p.evaluate(r=>MV.state().SEL&&MV.state().SEL.id===r,ev.r),n+'movements: ?m=&r= opens that route');
 await p.click('#story .ojj-share');await p.waitForTimeout(200);s=await p.evaluate(()=>window.__shared);ck(s&&s.url.includes('&r='),n+'movements: route share keeps the route');
 // no share on the intro (no card open)
 await p.goto(BASE+'movements.html');await p.waitForTimeout(2000);ck((await p.$$eval('#story .ojj-share',x=>x.length))===0,n+'movements: no Share on the intro text');
 ck(errs.length===0,n+'no page errors '+errs.join('|'));
 await ctx.close();}
await b.close();console.log(bad?'FAILED '+bad:'ALL PASS');process.exit(bad?1:0);})();
