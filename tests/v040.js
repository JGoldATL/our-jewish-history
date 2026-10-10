// v0.4.0: start screen with the Default | Academic toggle, tagged wrong-answer lines, result-screen share.
// Run: NODE_PATH=$(npm root -g) node tests/v040.js   (server on :8778 from the repo root)
const {chromium}=require('playwright');const fs=require('fs');
const VEND=process.env.VEND||'/tmp/claude-0/vend/node_modules';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
// Fixture: three questions, one per era, each with Choice years; the bank is cut to these so the rounds are known.
const YEARS={Q046:[-1046,80,793,-51],Q021:[80,122,330,-25],Q050:[1948,1969,1941,1989]};
const KEEP=['Q046','Q021','Q050'];
function fixtureShare(h){ // Q052 in the round for the S1 rule; Q021 and Q050 as the others
  h.sheet.questions=h.sheet.questions.filter(q=>['Q052','Q021','Q050'].includes(q.id));
}
async function open(b,{url='http://localhost:8778/quiz.html',fix,share,clip}={}){
  const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
  await p.route(/cdnjs.*d3\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(VEND+'/d3/dist/d3.min.js')}));
  await p.route(/cdnjs.*topojson\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(VEND+'/topojson-client/dist/topojson-client.min.js')}));
  await p.route(/fonts\.|googletagmanager|workers\.dev/,r=>r.abort());
  const h=JSON.parse(fs.readFileSync('data/history.json','utf8'));
  if(fix)fix(h);
  await p.route(/data\/history\.json/,r=>r.fulfill({contentType:'application/json',body:JSON.stringify(h)}));
  await p.addInitScript(({share,clip})=>{
    window.__shared=[];window.__copied=[];
    if(share==='ok')navigator.share=async d=>{window.__shared.push(d);};
    else if(share==='abort')navigator.share=async d=>{window.__shared.push(d);const e=new Error('x');e.name='AbortError';throw e;};
    else Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
    if(clip==='ok')Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.__copied.push(t);}},configurable:true});
    else Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('no');}},configurable:true});
  },{share,clip});
  await p.goto(url);await p.waitForSelector('.choice');
  return {p,errs,ctx};
}
const play=async(p,picks)=>{ // picks: array of letter indexes per question in dealt order, or 'right'
  const out=[];
  for(let n=0;n<3;n++){
    await p.waitForSelector('.choice:not([disabled])');
    const q=await p.evaluate(()=>({order:!!document.querySelector('.hint')}));
    if(q.order){const k=await p.$$eval('.choice',b=>b.length);for(let i=0;i<k;i++)await p.click(`.choice[data-k="${i}"]`);}
    else await p.click(`.choice[data-k="${picks[n]}"]`);
    await p.click('#submit');
    out.push({verdict:await p.$eval('.verdict',e=>e.textContent),date:await p.$eval('.result',e=>(e.querySelector('.dateline')||{}).textContent||''),eyebrow:await p.$eval('.eyebrow',e=>e.textContent)});
    await p.click('#next');
  }
  await p.waitForSelector('.end');return out;
};
(async()=>{
  const b=await chromium.launch();
  // 1. v0.4.1: the quiz pops up. The first question shows on load; no start screen, no Default | Academic pill, Default tone.
  for(const w of [390,320]){
    const ctx=await b.newContext({viewport:{width:w,height:700}});const p=await ctx.newPage();
    await p.route(/fonts\.|googletagmanager|workers\.dev|cdnjs/,r=>r.abort());await p.goto('http://localhost:8778/quiz.html');await p.waitForSelector('.choice');
    const r=await p.evaluate(()=>({q:!!document.querySelector('.qt'),choices:document.querySelectorAll('.choice').length,count:document.getElementById('count').textContent,
      noToggle:!document.querySelector('.tone')&&!document.querySelector('.seg')&&!document.getElementById('startBtn'),hs:document.documentElement.scrollWidth>innerWidth,tone:window.__quiz&&window.__quiz.tone}));
    ok(r.q&&r.choices>=2&&r.count==='1 of 3',w+' px: the first question is on screen as soon as the page opens ('+r.count+')');
    ok(r.noToggle,w+' px: no start screen, no Default | Academic pill');
    ok(r.tone==='default',w+' px: tone is Default');
    ok(!r.hs,w+' px: no sideways scroll');
    await p.close();await ctx.close();
  }
  { // a friend's link opens the first question in Default
    const f=await open(b,{url:'http://localhost:8778/quiz.html?from=friend'});
    ok(await f.p.evaluate(()=>window.__quiz.tone)==='default'&&await f.p.$('.tone')===null,'a friend\'s link opens straight to a question, in Default');
    await f.ctx.close();
  }
  // 2. wrong-answer lines, many rounds
  const closeOnly=/near miss/, farOnly=/Off by|off by/;
  let nClose=0,nFar=0,nAny=0,badTag=[],noDate=[],repeats=0,prev=null,emoji=[],ce=[];
  for(let r=0;r<30;r++){
    const {p,errs,ctx}=await open(b,{fix:h=>{h.sheet.questions=h.sheet.questions.filter(q=>KEEP.includes(q.id));h.sheet.questions.forEach(q=>q.choiceYears=YEARS[q.id]);}});
    
    // dealt order is chronological: Q046 (957 BCE), Q021 (132), Q050 (1948). Wrong picks: Colosseum 80 (far), Pantheon -25 (D, gap 105 = any), Pearl Harbor 1941 (close)
    const o=await play(p,[1,3,2]);
    const [a,c2,d]=o;
    // Q046 far: correct Zhou -1046, picked 80 -> gap 1126
    ok2(/1046 BCE/.test(a.verdict),'far: line shows the right date 1046 BCE',a.verdict);
    if(closeOnly.test(a.verdict))badTag.push('far got close: '+a.verdict);
    if(farOnly.test(a.verdict))nFar++;else nAny++;
    // Q021 any: correct 122 picked -25 -> gap 147
    ok2(/\b122\b/.test(c2.verdict),'any: line shows the right date 122',c2.verdict);
    if(closeOnly.test(c2.verdict)||farOnly.test(c2.verdict))badTag.push('any got tagged: '+c2.verdict);
    // Q050 close: correct 1948 picked 1941 -> gap 7
    ok2(/\b1948\b/.test(d.verdict),'close: line shows the right date 1948',d.verdict);
    if(farOnly.test(d.verdict))badTag.push('close got far: '+d.verdict);
    if(closeOnly.test(d.verdict))nClose++;
    for(const x of o){if(/\bCE\b/.test(x.verdict+x.date))ce.push(x.verdict);if(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(x.verdict))emoji.push(x.verdict);
      if(prev&&prev===x.verdict.split(' The answer is')[0])repeats++;prev=x.verdict.split(' The answer is')[0];
      if(/\{\w+\}/.test(x.verdict))noDate.push('unfilled '+x.verdict);}
    ok2(errs.length===0,'no page errors',errs.join('|'));
    await ctx.close();
  }
  function ok2(c,m,extra){if(!c){console.log('FAIL '+m+' :: '+extra);fails++;}}
  ok(badTag.length===0,'tags respected over 30 rounds'+(badTag.length?': '+badTag[0]:''));
  ok(nClose>0&&nFar>0&&nAny>0,`all three kinds of line appeared (close ${nClose}, far ${nFar}, any ${nAny})`);
  ok(repeats===0,'the same line never shows twice in a row');
  ok(ce.length===0,'no "CE" in any wrong-answer line');
  ok(emoji.length===0,'no emoji in any wrong-answer line');
  ok(noDate.length===0,'no unfilled placeholders'+(noDate.length?': '+noDate[0]:''));
  { // no Choice years -> plain correction plus the Jewish event's date, in Default (Academic is dormant in v0.4.1)
    const {p,ctx}=await open(b,{fix:h=>{h.sheet.questions=h.sheet.questions.filter(q=>KEEP.includes(q.id));h.sheet.questions.forEach(q=>{delete q.choiceYears;});}});
    const o=await play(p,[1,3,2]);
    ok(o.every(x=>/^Not quite\. You picked/.test(x.verdict)&&/In Jewish history: .+, \d/.test(x.date)),'Default without Choice years: plain correction and the Jewish event date, never an invented line');
    await ctx.close();
  }
  // 3. share
  const bank=['539 BCE: a Persian king','Beat that.','in about 90 seconds','did not use Google','Nowhere to go but up','mixes up centuries','congratulations or competition','Prove it.'];
  const S1=/539 BCE: a Persian king/;
  let s1Right=0,s1Wrong=0,perfectOnly=true,zeroOnly=true,sharedOK=true,linkOK=true,seen=new Set();
  for(const [label,picks] of [['all wrong',null],['all right',null]]){
    for(let r=0;r<18;r++){
      const {p,ctx}=await open(b,{url:'http://localhost:8778/quiz.html?x=1#y',share:'ok',fix:fixtureShare});
      
      // answer by reading the dealt question's correct letter from the bank
      for(let n=0;n<3;n++){
        await p.waitForSelector('.choice:not([disabled])');
        const info=await p.evaluate(()=>{const qs=window.__quiz.bank;const txt=document.querySelector('.qt').textContent;const q=qs.find(x=>x.question===txt);return {order:!!document.querySelector('.hint'),right:q?'ABCDE'.indexOf(q.correct):0,n:document.querySelectorAll('.choice').length};});
        if(info.order){const k=info.n;for(let i=0;i<k;i++)await p.click(`.choice[data-k="${i}"]`);}
        else await p.click(`.choice[data-k="${label==='all right'?info.right:(info.right+1)%info.n}"]`);
        await p.click('#submit');
        await p.click('#next');
      }
      await p.waitForSelector('.end');
      const score=await p.$eval('.score',e=>+e.textContent.match(/(\d) of/)[1]);
      await p.click('#share');await p.waitForTimeout(80);
      const sh=await p.evaluate(()=>window.__shared);
      if(sh.length!==1){sharedOK=false;await ctx.close();continue;}
      const t=sh[0].text,u=sh[0].url;seen.add(bank.findIndex(x=>t.includes(x)));
      if(u!=='http://localhost:8778/quiz.html')linkOK=false;
      if(S1.test(t)){if(label==='all right')s1Right++;else s1Wrong++;}
      if(/did not use Google/.test(t)&&score!==3)perfectOnly=false;
      if(/Nowhere to go but up/.test(t)&&score!==0)zeroOnly=false;
      if(/\{|\bCE\b|[\u{1F300}-\u{1FAFF}]/u.test(t))sharedOK=false;
      await ctx.close();
    }
  }
  ok(sharedOK,'Default share: the phone share screen opens once with a bank line, no placeholders, no CE, no emoji');
  ok(linkOK,'share link is the bare quiz address (query and hash removed)');
  ok(s1Wrong===0,'the 539 BCE line never shows when that question was missed');
  ok(s1Right>0,'the 539 BCE line can show when that question was answered right ('+s1Right+')');
  ok(perfectOnly&&zeroOnly,'perfect-score and zero-score lines only at those scores');
  ok(seen.size>=4,'several different share lines come up ('+seen.size+')');
  { // fallback: no share screen -> copy; both fail -> the text is shown; cancel -> nothing copied
    let c=await open(b,{share:'none',clip:'ok',fix:fixtureShare});
    for(let n=0;n<3;n++){await c.p.waitForSelector('.choice:not([disabled])');const order=await c.p.evaluate(()=>!!document.querySelector('.hint'));
      if(order){const k=await c.p.$$eval('.choice',b=>b.length);for(let i=0;i<k;i++)await c.p.click(`.choice[data-k="${i}"]`);}else await c.p.click('.choice');await c.p.click('#submit');await c.p.click('#next');}
    await c.p.waitForSelector('.end');await c.p.click('#share');await c.p.waitForTimeout(80);
    const cp=await c.p.evaluate(()=>window.__copied);ok(cp.length===1&&/http:\/\/localhost:8778\/quiz\.html$/.test(cp[0]),'no share screen: the line and link are copied');
    ok(/Copied/.test(await c.p.$eval('#shareMsg',e=>e.textContent)),'a confirmation shows');
    await c.ctx.close();
    c=await open(b,{share:'none',clip:'fail',fix:fixtureShare});
    for(let n=0;n<3;n++){await c.p.waitForSelector('.choice:not([disabled])');const order=await c.p.evaluate(()=>!!document.querySelector('.hint'));
      if(order){const k=await c.p.$$eval('.choice',b=>b.length);for(let i=0;i<k;i++)await c.p.click(`.choice[data-k="${i}"]`);}else await c.p.click('.choice');await c.p.click('#submit');await c.p.click('#next');}
    await c.p.waitForSelector('.end');await c.p.click('#share');await c.p.waitForTimeout(80);
    ok(/quiz\.html/.test(await c.p.$eval('#shareMsg',e=>e.textContent))&&c.errs.length===0,'copy blocked: the text is shown so it can be copied by hand, no page errors');
    await c.ctx.close();
    c=await open(b,{share:'abort',clip:'ok',fix:fixtureShare});
    for(let n=0;n<3;n++){await c.p.waitForSelector('.choice:not([disabled])');const order=await c.p.evaluate(()=>!!document.querySelector('.hint'));
      if(order){const k=await c.p.$$eval('.choice',b=>b.length);for(let i=0;i<k;i++)await c.p.click(`.choice[data-k="${i}"]`);}else await c.p.click('.choice');await c.p.click('#submit');await c.p.click('#next');}
    await c.p.waitForSelector('.end');await c.p.click('#share');await c.p.waitForTimeout(80);
    ok((await c.p.evaluate(()=>window.__copied)).length===0,'share screen cancelled: nothing is copied');
    await c.ctx.close();
  }
  { // footer version on the globe page
    const ctx=await b.newContext({viewport:{width:1200,height:800}});const p=await ctx.newPage();await p.route(/fonts\.|googletagmanager/,r=>r.abort());
    await p.goto('http://localhost:8778/');await p.waitForTimeout(2500);
    ok(/^v0\.4\.1 /.test(await p.$eval('#version',e=>e.textContent)),'footer reads v0.4.1');await ctx.close();
  }
  await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
})();
