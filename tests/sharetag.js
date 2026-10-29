// F-062: every shared link carries utm_source=share and still opens the same card. Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/sharetag.js  (headless Chromium only)
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':' '+JSON.stringify(x)));if(!c)bad++;};
const fs=require('fs');const H=JSON.parse(fs.readFileSync(__dirname+'/../data/history.json','utf8')).sheet;
(async()=>{const b=await chromium.launch();
const run=async(name,page,sel,wait)=>{const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();
  await p.addInitScript(()=>{window.__shared=[];Object.defineProperty(navigator,'share',{value:d=>{window.__shared.push(d.url);return Promise.resolve();}});});
  await p.goto(BASE+page);await p.waitForTimeout(wait||2500);await p.locator(sel).first().click();await p.waitForTimeout(400);
  const u=await p.evaluate(()=>window.__shared[0]);ck(!!u&&new URL(u).searchParams.get('utm_source')==='share',name+': shared link carries utm_source=share',u);
  ck(!!u&&!/drafts/.test(u),name+': drafts parameter still stripped',u);await ctx.close();return u;};
const c=H.cards.find(x=>x.status==='approved'&&x.type==='Event');
const u1=await run('events',`events.html?card=${c.id}`,'#shareSlot .ojj-share');
ck(new URL(u1).searchParams.get('card')===c.id,'events: card id kept in the link',u1);
await run('old globe',`index.html?card=${c.id}`,'#shareSlot .ojj-share');
await run('jewhate','jewhate.html?drafts=1','.card.cur .ojj-share',2200);
// a friend opening a tagged link still lands on the same card, no page errors
const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+`events.html?card=${c.id}&utm_source=share`);await p.waitForTimeout(2500);
ck(await p.locator('#shareSlot .ojj-share').count()>0,'a tagged link opens the card (share button present on the opened card)');ck(errs.length===0,'no page errors on a tagged link',errs);
await b.close();console.log(bad?bad+' FAILED':'ALL PASSED');process.exit(bad?1:0);})();
