// GA4 tag test (v0.3.2). Run: NODE_PATH=$(npm root -g) node tests/ga4.js   (server on :8778 from the repo root)
// Checks: tag requested only on the production host, on every .html page; no GoatCounter; blocked tag never breaks a page; page never sends quiz data to Google.
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const VEND=process.env.VEND||'/tmp/claude-0/vend/node_modules';
const ID='G-W0VSWJ8FCS';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const pages=fs.readdirSync('.').filter(f=>f.endsWith('.html'));
async function open(browser,url,{block=false}={}){
  const ctx=await browser.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[],gtag=[],other=[];
  p.on('pageerror',e=>errs.push(String(e)));
  p.on('request',r=>{const u=r.url();if(/googletagmanager|google-analytics/.test(u))gtag.push(u);if(/goatcounter|zgo\.at/.test(u))other.push(u);});
  await p.route(/cdnjs.*d3\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(VEND+'/d3/dist/d3.min.js')}));
  await p.route(/cdnjs.*topojson\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(VEND+'/topojson-client/dist/topojson-client.min.js')}));
  await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await p.route(/googletagmanager|google-analytics/,r=>block?r.abort():r.fulfill({contentType:'text/javascript',body:'/*stub*/'}));
  await p.route(/^https:\/\/jgoldatl\.github\.io\//,r=>{const f=new URL(r.request().url()).pathname.replace(/^\//,'')||'index.html';const fp=path.join(process.cwd(),f);
    if(!fs.existsSync(fp))return r.fulfill({status:404,body:''});r.fulfill({contentType:MIME[path.extname(fp)]||'application/octet-stream',body:fs.readFileSync(fp)});});
  await p.goto(url);await p.waitForTimeout(1200);return {p,errs,gtag,other,ctx};
}
(async()=>{
  const browser=await chromium.launch();
  for(const f of pages){
    let r=await open(browser,'https://jgoldatl.github.io/'+f);
    ok(r.gtag.some(u=>u.includes('gtag/js?id='+ID)),f+': production host requests the GA4 tag');
    const dl=await r.p.evaluate(()=>JSON.stringify(window.dataLayer||[]));
    ok(dl.includes(ID),f+': config call for '+ID+' is queued');ok(r.other.length===0,f+': no GoatCounter request');ok(r.errs.length===0,f+': no page errors');await r.ctx.close();
    r=await open(browser,'http://localhost:8778/'+f);
    ok(r.gtag.length===0,f+': local host sends nothing to Google ('+r.gtag.length+')');await r.ctx.close();
    r=await open(browser,'https://jgoldatl.github.io/'+f,{block:true});
    ok(r.errs.length===0,f+': page loads with the tag blocked, no page errors');await r.ctx.close();
  }
  { // quiz still completes with the tag blocked, and nothing about answers goes to Google
    const r=await open(browser,'https://jgoldatl.github.io/quiz.html',{block:true});
    await r.p.click('#startBtn');for(let n=0;n<3;n++){await r.p.waitForSelector('.choice:not([disabled])');const order=await r.p.evaluate(()=>!!document.querySelector('.hint'));
      if(order){const k=await r.p.$$eval('.choice',b=>b.length);for(let i=0;i<k;i++)await r.p.click(`.choice[data-k="${i}"]`);}else await r.p.click('.choice');await r.p.click('#next');}
    await r.p.waitForSelector('.pill');const done=await r.p.$eval('.score',e=>e.textContent);
    ok(/of 3 right/.test(done)&&r.errs.length===0,'quiz completes with the tag blocked ('+done.trim()+')');await r.ctx.close();
    const q=await open(browser,'https://jgoldatl.github.io/quiz.html');
    await q.p.click('#startBtn');for(let n=0;n<3;n++){await q.p.waitForSelector('.choice:not([disabled])');const order=await q.p.evaluate(()=>!!document.querySelector('.hint'));
      if(order){const k=await q.p.$$eval('.choice',b=>b.length);for(let i=0;i<k;i++)await q.p.click(`.choice[data-k="${i}"]`);}else await q.p.click('.choice');await q.p.click('#next');}
    await q.p.waitForSelector('.pill');await q.p.click('.pill >> nth=1');await q.p.waitForTimeout(400);
    ok(q.gtag.every(u=>!/question_id|picked|visit_id|survey/i.test(u)),'no quiz answer, visit id or survey text in any Google request');await q.ctx.close();
  }
  await browser.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
})();
