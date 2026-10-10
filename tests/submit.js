// v0.4.1: a tap selects, Submit locks the answer in. Run: NODE_PATH=$(npm root -g) VEND=... node tests/submit.js (server on :8778)
const {chromium}=require('playwright');const fs=require('fs');
const VEND=process.env.VEND||'/tmp/claude-0/vend/node_modules';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
async function open(b,keepOrder){
  const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[],posts=[];p.on('pageerror',e=>errs.push(String(e)));
  await p.route(/cdnjs.*d3\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(VEND+'/d3/dist/d3.min.js')}));
  await p.route(/cdnjs.*topojson\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(VEND+'/topojson-client/dist/topojson-client.min.js')}));
  await p.route(/fonts\.|googletagmanager/,r=>r.abort());
  await p.route(/workers\.dev/,r=>{posts.push(r.request().postData());r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  const h=JSON.parse(fs.readFileSync('data/history.json','utf8'));
  h.sheet.questions=h.sheet.questions.filter(q=>keepOrder?q.correct==='order':q.correct!=='order');
  await p.route(/data\/history\.json/,r=>r.fulfill({contentType:'application/json',body:JSON.stringify(h)}));
  await p.goto('http://localhost:8778/quiz.html?logtest=1');await p.waitForSelector('.choice');
  return {p,ctx,errs,posts};
}
(async()=>{
  const b=await chromium.launch();
  { // multiple choice
    const {p,ctx,errs,posts}=await open(b,false);
    ok(await p.$eval('#submit',e=>e.disabled&&e.textContent==='Submit'),'Submit shows and is disabled before anything is selected');
    await p.click('.choice[data-k="0"]');
    ok(await p.$('.verdict')===null&&await p.$$eval('.choice',c=>c.every(x=>!x.disabled)),'tapping an answer only selects it: no verdict, choices still open');
    ok(await p.$eval('#submit',e=>!e.disabled)&&await p.$eval('.choice[data-k="0"]',e=>e.classList.contains('sel')&&e.getAttribute('aria-pressed')==='true'),'selected answer is marked and Submit turns on');
    await p.click('.choice[data-k="1"]');
    ok(await p.$$eval('.choice.sel',c=>c.length)===1&&await p.$eval('.choice[data-k="1"]',e=>e.classList.contains('sel')),'changing the selection moves the mark (only one selected)');
    ok(posts.length===0,'nothing is logged before Submit');
    await p.click('#submit');
    ok(await p.$('.verdict')!==null&&await p.$('#submit')===null,'Submit reveals the verdict and the Submit button goes away');
    ok(await p.$$eval('.choice',c=>c.every(x=>x.disabled)&&c.filter(x=>x.classList.contains('right')).length===1),'choices lock, exactly one green');
    await p.waitForTimeout(150);
    const rows=posts.filter(x=>/"answer"/.test(x||''));
    ok(rows.length===1&&/"picked":"1"/.test(rows[0]),'one answer row logged, for the answer that was selected at Submit ('+rows.length+')');
    ok(errs.length===0,'no page errors');await ctx.close();
  }
  { // put-in-order
    const {p,ctx,errs}=await open(b,true);
    const n=await p.$$eval('.choice',c=>c.length);
    ok(await p.$eval('#submit',e=>e.disabled),'order: Submit is disabled at the start');
    for(let k=0;k<n-1;k++)await p.click(`.choice[data-k="${k}"]`);
    ok(await p.$eval('#submit',e=>e.disabled)&&await p.$('.verdict')===null,'order: still disabled until every item is placed');
    await p.click(`.choice[data-k="${n-1}"]`);
    ok(await p.$eval('#submit',e=>!e.disabled)&&await p.$('.verdict')===null,'order: all placed, Submit turns on, nothing revealed yet');
    await p.click('.choice[data-k="0"]');
    ok(await p.$eval('#submit',e=>e.disabled),'order: taking an item back out turns Submit off again');
    await p.click('.choice[data-k="0"]');await p.click('#submit');
    ok(/^Not quite/.test(await p.$eval('.verdict',e=>e.textContent))&&await p.$('#submit')===null,'order: Submit reveals, and the re-placed item (now last) is what was judged');
    ok(errs.length===0,'no page errors');await ctx.close();
  }
  await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
})();
