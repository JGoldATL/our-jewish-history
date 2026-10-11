// Device id: same in one browser across visits, new visit id each time, quiz still works with storage blocked. Run: NODE_PATH=$(npm root -g) node tests/device.js (server on :8778)
const {chromium}=require('playwright');const SITE=process.env.SITE||'http://localhost:8778/';
(async()=>{const b=await chromium.launch();let fail=0;const ck=(n,ok,x)=>{console.log((ok?'ok   ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)fail++;};
async function visit(ctx,url){const p=await ctx.newPage();const posts=[];const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/workers\.dev/,r=>{posts.push(JSON.parse(r.request().postData()));r.fulfill({status:204,body:''});});
  await p.goto(url);await p.waitForSelector('.choice:not([disabled])',{timeout:20000});const order=await p.evaluate(()=>!!document.querySelector('.hint'));if(order){const k=await p.$$eval('.choice',x=>x.length);for(let i=0;i<k;i++)await p.click(`.choice[data-k="${i}"]`);}else await p.click('.choice');await p.click('#submit');await p.waitForTimeout(800);return {p,posts,errs};}
const ctx=await b.newContext({viewport:{width:390,height:844},locale:'en-US'});
const a=await visit(ctx,SITE+'quiz.html?logtest=1');const c=await visit(ctx,SITE+'quiz.html?logtest=1&utm_source=WhatsApp');
ck('first visit sends a device id',a.posts.length>0&&/^[a-z0-9]{16,32}$/.test(a.posts[0].device_id||''),a.posts[0]&&a.posts[0].device_id);
ck('a later visit in the same browser sends the SAME device id but a new visit id',c.posts[0].device_id===a.posts[0].device_id&&c.posts[0].visit_id!==a.posts[0].visit_id);
ck('utm_source becomes the referral name (lower case)',c.posts[0].ref==='whatsapp',c.posts[0].ref);
ck('a different browser gets a different device id',await (async()=>{const x=await b.newContext({viewport:{width:390,height:844}});const v=await visit(x,SITE+'quiz.html?logtest=1');const same=v.posts[0].device_id!==a.posts[0].device_id;await x.close();return same;})());
// storage blocked: quiz works, rows still sent, just without a device id
const ctx2=await b.newContext({viewport:{width:390,height:844}});await ctx2.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}});});
const d=await visit(ctx2,SITE+'quiz.html?logtest=1');ck('storage blocked: rows are still sent, without a device id, no page errors',d.posts.length>0&&d.posts[0].device_id===undefined&&d.errs.length===0,d.errs);
ck('no page errors',a.errs.length===0&&c.errs.length===0,[...a.errs,...c.errs]);
console.log(fail?'FAIL '+fail:'PASS');await b.close();process.exit(fail?1:0);})();
