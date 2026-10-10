// B18 (undo a placed item in ordering questions), B19 (Back to the globe pill on the last question), tab icon links.
// Run: NODE_PATH=$(npm root -g) node tests/undo.js   (server on :8778 from the repo root)
const {chromium}=require('playwright');const fs=require('fs');
const VEND=process.env.VEND||'/tmp/claude-0/vend/node_modules';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
  const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];
  p.on('pageerror',e=>errs.push(String(e)));
  await p.route(/cdnjs.*d3\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(VEND+'/d3/dist/d3.min.js')}));
  await p.route(/cdnjs.*topojson\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(VEND+'/topojson-client/dist/topojson-client.min.js')}));
  await p.route(/fonts\.(googleapis|gstatic)\.com|googletagmanager/,r=>r.abort());
  for(const f of ['index.html','quiz.html']){
    await p.goto('http://localhost:8778/'+f);
    const h=await p.$$eval('link[rel~=icon],link[rel=apple-touch-icon]',l=>l.map(x=>x.getAttribute('href')));
    ok(h.join()==='favicon.svg,favicon.ico,apple-touch-icon.png',f+': three icon links '+h.join('|'));
  }
  for(const f of ['favicon.svg','favicon.ico','apple-touch-icon.png'])ok(fs.statSync(f).size>200,f+' exists');
  // find a round that opens on an ordering question: play until one shows
  let found=false;
  for(let t=0;t<60&&!found;t++){
    await p.goto('http://localhost:8778/quiz.html');await p.waitForSelector('.choice');
    for(let k=0;k<3;k++){
      if(await p.$('.hint')){found=true;break;}
      await p.click('.choice');await p.click('#next');
    }
  }
  ok(found,'reached an ordering question');
  const nums=()=>p.$$eval('.choice .n',n=>n.map(x=>x.textContent));
  const ch=await p.$$('.choice');
  await ch[0].click();await ch[1].click();
  ok((await nums()).slice(0,2).join()==='1,2','two items placed as 1 and 2');
  await ch[0].click();
  {const n2=await nums();ok(n2[0]===''&&n2[1]==='1','tap item 1 again: it clears and item 2 moves up to 1 ('+n2.join('|')+')');}
  await ch[0].click();
  const n3=await nums();ok(n3[0]==='2'&&n3[1]==='1','re-placing it makes it #2 ('+n3.join('|')+')');
  ok(!(await p.$('#res .result')),'nothing is submitted while items are being undone');
  // finish the ordering and reach the last question
  for(const c of await p.$$('.choice:not(.picked)'))await c.click();
  ok(!!(await p.$('#res .result')),'full order submits');
  // play on to the last question
  for(let g=0;g<4;g++){
    const t=await p.textContent('#next');
    if(t==='See your journey'){
      const back=await p.$('#res a.btn[href="index.html"]');
      ok(!!back&&(await back.textContent())==='Back to the globe','last question: Back to the globe pill sits next to See your journey');
      const cls=await back.getAttribute('class');ok(cls==='btn','pill has the same style class as See your journey');
      break;
    }
    ok(!(await p.$('#res a[href="index.html"]')),'earlier questions have no Back pill');
    await p.click('#next');await p.waitForSelector('.choice');
    if(await p.$('.hint')){for(const c of await p.$$('.choice'))await c.click();}else await p.click('.choice');
  }
  ok(errs.length===0,'no page errors '+errs.join(';'));
  await b.close();console.log(fails?'FAILURES: '+fails:'ALL PASS');process.exit(fails?1:0);
})();
