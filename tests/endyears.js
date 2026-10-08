// End-screen year labels: bare Common Era years (no "CE"), BCE kept, no thousands comma. Plays many rounds, including ones that cross BCE.
// Run: NODE_PATH=$(npm root -g) node tests/endyears.js   (server on :8778 from the repo root)
const {chromium}=require('playwright');const fs=require('fs');
const VEND=process.env.VEND||'/tmp/claude-0/vend/node_modules';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
  const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];
  p.on('pageerror',e=>errs.push(String(e)));
  await p.route(/cdnjs.*d3\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(VEND+'/d3/dist/d3.min.js')}));
  await p.route(/cdnjs.*topojson\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(VEND+'/topojson-client/dist/topojson-client.min.js')}));
  await p.route(/fonts\.|googletagmanager|workers\.dev/,r=>r.abort());
  let rounds=0,cross=0,ceHits=[],commaHits=[],labels=0,seen2000=false,seen2560=false,bareCE=0,minus=[];
  for(let r=0;r<80;r++){
    await p.goto('http://localhost:8778/quiz.html');await p.click('#startBtn');await p.waitForSelector('.choice');
    for(let k=0;k<3;k++){
      if(await p.$('.hint')){for(const c of await p.$$('.choice'))await c.click();}else await p.click('.choice');
      await p.click('#next');if(k<2)await p.waitForSelector('.choice');
    }
    await p.waitForSelector('.end');rounds++;
    const lab=await p.$$eval('.tl .yr, .tl .mw',els=>els.map(e=>e.textContent.trim()));
    const txt=lab.join('\n');
    if(/BCE/.test(txt))cross++;
    for(const l of lab){labels++;
      if(/\bCE\b/.test(l))ceHits.push(l);
      if(/\d,\d{3}/.test(l))commaHits.push(l);
      if(/(^|[\s,])[-−]\d/.test(l))minus.push(l);
      if(/(^|,\s)\d{1,4}$/.test(l)&&!/BCE/.test(l))bareCE++;
      if(/(^|[\s,])2000 BCE$/.test(l))seen2000=true;
      if(/2560 BCE$/.test(l))seen2560=true;
    }
    const whole=await p.evaluate(()=>document.querySelector('.end').innerText);
    if(/\bCE\b/.test(whole)&&!/\bBCE\b/.test(whole))ceHits.push('(page) '+whole.slice(0,40));
  }
  console.log(`rounds ${rounds}, rounds crossing BCE ${cross}, year labels read ${labels}, bare Common Era labels ${bareCE}`);
  ok(cross>=5,'enough rounds cross BCE to prove the point ('+cross+')');
  ok(bareCE>=20,'Common Era labels appear as bare years ('+bareCE+')');
  ok(ceHits.length===0,'no "CE" on any end screen'+(ceHits.length?': '+ceHits.slice(0,3).join(' | '):''));
  ok(commaHits.length===0,'no thousands comma in any year label'+(commaHits.length?': '+commaHits.slice(0,3).join(' | '):''));
  ok(minus.length===0,'no minus sign on any year label');
  ok(seen2000,'Abraham reads "2000 BCE"');
  ok(seen2560,'Great Pyramid reads "2560 BCE"');
  ok(errs.length===0,'no page errors '+errs.join(';'));
  await b.close();console.log(fails?'FAILURES: '+fails:'ALL PASS');process.exit(fails?1:0);
})();
