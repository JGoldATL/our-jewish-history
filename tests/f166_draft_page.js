// F-166 unlisted draft page: Run: NODE_PATH=$(npm root -g) node tests/f166_draft_page.js (needs python3 -m http.server 8778 in the repo root; takes about 6 minutes under software WebGL)
const {chromium}=require('playwright');let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const [w,h] of [[390,844],[820,1180],[1024,768],[1280,800]]){
  const ctx=await b.newContext({viewport:{width:w,height:h}});const p=await ctx.newPage();const errs=[],reqs=[];
  p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});p.on('request',r=>reqs.push(r.url()));
  await p.goto('http://localhost:8778/christianity-draft.html');await p.waitForSelector('#card .k',{timeout:15000});
  ok(errs.length===0,w+' no console/page errors '+errs.join('|').slice(0,150));
  const t=await p.evaluate(()=>({card:document.getElementById('card').textContent,mock:document.getElementById('mock').textContent,mockHidden:document.getElementById('mock').hidden,robots:(document.querySelector('meta[name=robots]')||{}).content,gtag:typeof window.gtag,body:document.body.innerText}));
  ok(/Wave 1 of 18/.test(t.card),w+' opens on wave 1 of 18');
  ok(/Draft: sources under review/.test(t.card)&&!t.mockHidden&&/Draft: sources under review/.test(t.mock),w+' Draft label on card and banner');
  ok(/noindex/.test(t.robots),w+' noindex');ok(t.gtag==='undefined',w+' no gtag');
  ok(!reqs.some(u=>/googletagmanager|google-analytics/.test(u)),w+' no GA4 request');
  ok(!/Islam|Muslim/i.test(t.body.replace(/Islamic Rule/g,'')),w+' no Islam/Muslim wording on page');
  ok(!/disputed|Palestine/i.test(t.card),w+' no banned words on first card');
  // dragged slider to last wave, then Play/Next
  await p.evaluate(()=>{const s=document.getElementById('sl');s.value=s.max;s.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.waitForTimeout(300);
  const last=await p.evaluate(()=>({card:document.getElementById('card').textContent,yr:document.getElementById('yr').innerText,max:document.getElementById('sl').max}));
  ok(/Wave 18 of 18/.test(last.card)&&last.yr==='2000',w+' dragged slider reaches wave 18, year '+last.yr);
  // every wave card renders via ticks
  const all=await p.evaluate(async()=>{const out=[];for(let i=0;i<18;i++){document.querySelectorAll('.tick')[i].click();await new Promise(r=>setTimeout(r,30));out.push(document.getElementById('card').textContent.includes('Wave '+(i+1)+' of 18'));}return out.every(Boolean);});
  ok(all,w+' all 18 waves show their card');
  // Play from start reaches 2000 and stops
  await p.evaluate(()=>document.querySelectorAll('.tick')[0].click());await p.click('#play');
  await p.waitForFunction(()=>document.getElementById('yr').innerText==='2000'&&document.getElementById('play').innerText==='Play',null,{timeout:150000}).then(()=>ok(true,w+' Play runs to 2000 and stops')).catch(()=>ok(false,w+' Play did not reach 2000'));
  if(w===390||w===1024)await p.screenshot({path:'/home/claude/scratch/f166-'+w+'.png'});
  await ctx.close();
}
// Islam page unchanged
const ctx=await b.newContext({viewport:{width:1024,height:768}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8778/haze.html');await p.waitForSelector('#card .k');const c=await p.evaluate(()=>document.getElementById('card').textContent);
ok(/of 16/.test(c)&&errs.length===0&&!/Draft/.test(c),'Islam page unchanged: 16 waves, no draft label, no errors');
console.log(fails?'FAILURES '+fails:'ALL PASS');await b.close();process.exit(fails?1:0);})();
