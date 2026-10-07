// Quiz answer logging test (v0.4.0). Run: NODE_PATH=$(npm root -g) node tests/log.js   (server on :8778 from the repo root)
// The logger URL is blank in the source until the Worker exists, so the test swaps in a fake address and captures what the page sends.
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
const VEND=process.env.VEND||'/tmp/claude-0/vend/node_modules';
const FAKE='https://log.example.test/log';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};

async function open(browser,{url,withUrl=true,logMode='ok',draftFixture=false}){
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  const p=await ctx.newPage();const errs=[],posts=[];
  p.on('pageerror',e=>errs.push(String(e)));
  await p.route(/cdnjs.*d3\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(VEND+'/d3/dist/d3.min.js')}));
  await p.route(/cdnjs.*topojson\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(VEND+'/topojson-client/dist/topojson-client.min.js')}));
  await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  if(draftFixture){const h=JSON.parse(fs.readFileSync('data/history.json','utf8'));h.sheet.meta.mode='preview';h.sheet.questions.forEach(q=>q.status='draft');
    await p.route(/data\/history\.json/,r=>r.fulfill({contentType:'application/json',body:JSON.stringify(h)}));}
  // serve the repo for the pretend production host, and patch in the fake logger address when asked
  await p.route(/^https:\/\/jgoldatl\.github\.io\//,r=>{
    const f=new URL(r.request().url()).pathname.replace(/^\//,'')||'index.html';
    const fp=path.join(process.cwd(),f);
    if(!fs.existsSync(fp))return r.fulfill({status:404,body:''});
    let body=fs.readFileSync(fp);
    if(f==='quiz.js'&&withUrl)body=body.toString().replace("const LOG_URL='';","const LOG_URL='"+FAKE+"';");
    r.fulfill({contentType:MIME[path.extname(fp)]||'application/octet-stream',body});
  });
  await p.route(/localhost:8778\/quiz\.js/,async r=>{
    const res=await r.fetch();let body=await res.text();
    if(withUrl)body=body.replace("const LOG_URL='';","const LOG_URL='"+FAKE+"';");
    r.fulfill({response:res,body});
  });
  await p.route(FAKE,r=>{
    posts.push(JSON.parse(r.request().postData()));
    if(logMode==='ok')r.fulfill({status:204,body:''});
    else if(logMode==='fail')r.abort();
    else if(logMode==='500')r.fulfill({status:500,body:'no'});
    // 'hang': never answered
  });
  await p.goto(url);
  await p.waitForSelector('.choice');
  return {p,errs,posts,ctx};
}
async function play(p){
  const seen=[];
  for(let n=0;n<3;n++){
    await p.waitForSelector('.choice:not([disabled])');
    const order=await p.evaluate(()=>!!document.querySelector('.hint'));seen.push(order);
    if(order){const k=await p.$$eval('.choice',b=>b.length);for(let i=0;i<k;i++)await p.click(`.choice[data-k="${i}"]`);}
    else await p.click('.choice');
    await p.click('#next');
  }
  await p.waitForSelector('.pill');
  await p.click('.pill >> nth=1');
  return seen;
}

(async()=>{
  const browser=await chromium.launch();
  const LOCAL='http://localhost:8778/quiz.html';

  { // 1. nothing sent on a non-production host without ?logtest=1
    const {p,errs,posts,ctx}=await open(browser,{url:LOCAL});await play(p);await p.waitForTimeout(300);
    ok(posts.length===0,'non-production host: nothing is sent ('+posts.length+')');ok(errs.length===0,'no page errors');await ctx.close();
  }
  { // 2. ?logtest=1 sends 3 answers and 1 survey, all anonymous
    const {p,errs,posts,ctx}=await open(browser,{url:LOCAL+'?logtest=1'});await play(p);await p.waitForTimeout(400);
    const a=posts.filter(x=>x.kind==='answer'),s=posts.filter(x=>x.kind==='survey');
    ok(a.length===3,'3 answer rows ('+a.length+')');ok(s.length===1&&s[0].survey==='Somewhat','1 survey row, "Somewhat"');
    ok(new Set(posts.map(x=>x.visit_id)).size===1&&/^test-[a-z0-9]{12,32}$/.test(posts[0].visit_id),'one visit id, starts "test-" ('+posts[0].visit_id+')');
    const allowed=['visit_id','kind','question_id','picked','survey'];
    ok(posts.every(x=>Object.keys(x).every(k=>allowed.includes(k))),'only the planned fields are sent: '+[...new Set(posts.flatMap(Object.keys))].join(','));
    ok(a.every(x=>/^Q\d+$/.test(x.question_id)&&/^[0-9](,[0-9])*$/.test(x.picked)),'answer rows well formed (era, style and right/wrong are not sent; the Worker looks them up)');
    ok(errs.length===0,'no page errors');await ctx.close();
  }
  { // 2b. an ordering question sends the tap order (rounds are random, so try fresh rounds until one has an ordering question)
    let found=null;
    for(let t=0;t<25&&!found;t++){
      const {p,posts,ctx}=await open(browser,{url:LOCAL+'?logtest=1'});const seen=await play(p);await p.waitForTimeout(200);
      if(seen.some(Boolean))found=posts.filter(x=>x.kind==='answer')[seen.findIndex(Boolean)];
      await ctx.close();
    }
    ok(found&&/^[0-9](,[0-9])+$/.test(found.picked),'ordering question sends the tap order ('+(found&&found.picked)+')');
  }
  { // 3. pretend production host logs without ?logtest and without "test-"
    const {p,errs,posts,ctx}=await open(browser,{url:'https://jgoldatl.github.io/quiz.html'});await play(p);await p.waitForTimeout(400);
    ok(posts.length===4,'production host: 4 rows sent ('+posts.length+')');ok(posts.every(x=>!x.visit_id.startsWith('test-')),'production ids carry no "test-" prefix');ok(errs.length===0,'no page errors');await ctx.close();
  }
  { // 4. the quiz works if logging is blocked, errors, or never answers
    for(const mode of ['fail','500','hang']){
      const t0=Date.now();
      const {p,errs,ctx}=await open(browser,{url:LOCAL+'?logtest=1',logMode:mode});await play(p);
      const done=await p.$eval('.score',e=>e.textContent);
      ok(/of 3 right/.test(done)&&errs.length===0,'logger "'+mode+'": quiz still completes ('+(Date.now()-t0)+' ms), no page errors');await ctx.close();
    }
  }
  { // 5. draft questions are never logged
    const {p,posts,ctx}=await open(browser,{url:LOCAL+'?logtest=1&drafts=1',draftFixture:true});await play(p);await p.waitForTimeout(300);
    ok(posts.length===0,'?drafts=1: nothing is sent ('+posts.length+')');await ctx.close();
  }
  { // 6. blank logger address (today's state): nothing is sent, no errors
    const {p,errs,posts,ctx}=await open(browser,{url:LOCAL+'?logtest=1',withUrl:false});await play(p);await p.waitForTimeout(300);
    ok(posts.length===0&&errs.length===0,'blank LOG_URL: nothing sent, no errors');await ctx.close();
  }
  await browser.close();
  console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
})();
