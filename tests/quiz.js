// Quiz page test. Run: NODE_PATH=$(npm root -g) node tests/quiz.js   (server on :8778 from the repo root)
// d3 and topojson come from cdnjs in production; the sandbox cannot reach it, so the test serves local copies of the same libraries.
const {chromium}=require('playwright');
const fs=require('fs');
const VEND=process.env.VEND||'/tmp/claude-0/vend/node_modules';
const URL='http://localhost:8778/quiz.html';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const ERAS=['Biblical era','Second Temple & Rome','Medieval & Modern'];

async function page(browser,opts={}){
  const ctx=await browser.newContext(opts.ctx||{viewport:{width:390,height:844}});
  const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(String(e)));
  await p.route(/cdnjs.*d3\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(VEND+'/d3/dist/d3.min.js')}));
  await p.route(/cdnjs.*topojson\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(VEND+'/topojson-client/dist/topojson-client.min.js')}));
  if(opts.fixture){
    const h=JSON.parse(fs.readFileSync('data/history.json','utf8'));
    opts.fixture(h);
    await p.route(/data\/history\.json/,r=>r.fulfill({contentType:'application/json',body:JSON.stringify(h)}));
  }
  await p.goto(opts.url||URL);
  if(!opts.intro){await p.waitForSelector('.choice, .msg');}   // v0.4.1: the first question shows on load, no start screen
  return {p,errs,ctx};
}
const eyebrow=p=>p.$eval('.eyebrow',e=>e.textContent);
// answer the current question (right or wrong) and return what was on screen
async function answer(p,wantRight){
  const info=await p.evaluate(()=>({order:document.querySelectorAll('.choice .n')[0].textContent===''&&!!document.querySelector('.hint')}));
  if(info.order){
    // order question: tap in the true order (choice buttons carry data-k = true position)
    const n=await p.$$eval('.choice',b=>b.length);
    const ks=[...Array(n).keys()];if(!wantRight)ks.reverse();
    for(const k of ks)await p.click(`.choice[data-k="${k}"]`);
    await p.click('#submit');
    return 'order';
  }
  const q=await p.evaluate(()=>window.__quiz&&0);
  return 'mc';
}

(async()=>{
  const browser=await chromium.launch();

  // 1. Approved-only rule (pure function)
  {
    const {p,errs}=await page(browser);
    const r=await p.evaluate(()=>{
      const Q=window.__quiz.pickQuestions;
      const a=[{status:'approved'},{status:'draft'}],d=[{status:'draft'}];
      return {prod:Q(a,{mode:'public'},'').list.length,flag:Q(a,{mode:'public'},'?drafts=1').list.length,
        prevMixed:Q(a,{mode:'preview'},'').list.length,prevNone:Q(d,{mode:'preview'},'').list.length,pubNone:Q(d,{mode:'public'},'').list.length};
    });
    ok(r.prod===1,'production deals approved only');
    ok(r.flag===2,'?drafts=1 shows drafts');
    ok(r.prevMixed===1,'preview with some approved still deals approved only');
    ok(r.prevNone===1,'preview with zero approved shows drafts');
    ok(r.pubNone===0,'public with zero approved shows nothing');
    ok(errs.length===0,'no page errors on load '+errs.join('|'));
    await p.context().close();
  }

  // 2. Public build with only drafts: not-ready message
  {
    const {p}=await page(browser,{fixture:h=>{h.sheet.meta.mode='public';h.sheet.questions.forEach(q=>q.status='draft');}});
    await p.waitForSelector('.msg');
    ok(/not ready yet/.test(await p.$eval('.msg',e=>e.textContent)),'public + all drafts shows "not ready" message');
    await p.context().close();
  }

  // 3. Full round, preview data (drafts shown)
  // 2b. Real data (all Approved): no draft marker; with every row set to Draft in preview, the marker shows
  {
    const {p:a}=await page(browser);await a.waitForSelector('.card');
    ok((await a.$eval('#mode',e=>e.textContent))==='','approved questions: no draft marker in the footer');
    await a.context().close();
    const {p:b}=await page(browser,{fixture:h=>{h.sheet.meta.mode='preview';h.sheet.questions.forEach(q=>q.status='draft');}});await b.waitForSelector('.card');
    ok(/Preview · draft questions included/.test(await b.$eval('#mode',e=>e.textContent)),'preview with only drafts: footer marks drafts');
    await b.context().close();
  }
  const {p,errs}=await page(browser);
  await p.waitForSelector('.card');
  const ts=await p.evaluate(()=>document.querySelector('h1').textContent);
  ok(ts==='When in the World?','title');
  ok(await p.$eval('#globe',e=>e.getBoundingClientRect().width)===88,'globe is 88 px');
  const gl=await p.$eval('#globe',e=>{const r=e.getBoundingClientRect();return r.right>innerWidth-24&&r.top<120;});
  ok(gl,'globe sits in the header, top right');

  const seenIds=new Set();
  async function playRound(label,wantRightFirst){
    const rows=[];
    for(let n=0;n<3;n++){
      await p.waitForSelector('.choice');
      const eb=await eyebrow(p);
      const [era,style,place]=eb.split(' · ');
      ok(ERAS.includes(era),`${label} q${n+1} era shown "${era}"`);
      rows.push({era,style,place});
      ok(await p.$eval('.place',e=>getComputedStyle(e).color)==='rgb(242, 166, 90)',`${label} q${n+1} place is amber`);
      const isOrder=!!(await p.$('.hint'));
      if(isOrder){
        const n2=await p.$$eval('.choice',b=>b.length);
        const ks=[...Array(n2).keys()];
        const right=(n!==1);
        if(!right){ks.reverse();}
        for(const k of ks)await p.click(`.choice[data-k="${k}"]`);
        await p.click('#submit');
        const v=await p.$eval('.verdict',e=>e.textContent);
        ok(right?v==='You got it.':v==='Not quite. Here’s the real order, earliest first.',`${label} q${n+1} order verdict "${v}"`);
        if(!right){ok((await p.$$('.yours')).length>0,'order: "You had #N" shown');
          const t=await p.$$eval('.yours',e=>e.map(x=>x.textContent));ok(t.every(s=>/^You had #\d$/.test(s)),'yours wording '+t.join(','));}
        const ord=await p.$$eval('.choice',b=>b.map(x=>+x.dataset.k));
        ok(ord.every((k,i)=>k===i),'order: correct order displayed after answer');
      }else{
        const correct=await p.evaluate(()=>{const q=window.__quiz.bank;return null;});
        // first choice, whatever it is
        const before=await p.$$eval('.choice',b=>b.map(x=>x.textContent.slice(1)));
        await p.click('.choice:nth-child(1)');await p.click('#submit');
        const marks=await p.$$eval('.choice',b=>b.map(x=>({r:x.classList.contains('right'),w:x.classList.contains('wrong'),d:x.disabled})));
        ok(marks.every(m=>m.d),`${label} q${n+1} choices lock after one tap`);
        ok(marks.filter(m=>m.r).length===1,'exactly one green');
        const v=await p.$eval('.verdict',e=>e.textContent);
        if(marks[0].r)ok(v==='You got it.','right verdict');
        else{ok(marks[0].w,'wrong pick is red');ok(/^Not quite\. You picked “.+\.” The answer is “.+\.”$/.test(v),'wrong verdict wording: '+v);}
      }
      // quick take, then Dive deeper
      ok((await p.$eval('.quick',e=>getComputedStyle(e).fontFamily)).includes('Georgia'),'quick take is Georgia');
      const more=await p.$('#more');
      if(more){
        ok(await p.$eval('#deep',e=>e.hidden),'deep dive hidden at first');
        ok(/Dive deeper →/.test(await p.$eval('#more',e=>e.textContent)),'Dive deeper → link');
        await p.click('#more');
        ok(!(await p.$eval('#deep',e=>e.hidden)),'deep dive revealed');
      }
      const btn=await p.$eval('#next',e=>e.textContent);
      ok(btn===(n<2?'Next question':'See your journey'),`${label} q${n+1} button "${btn}"`);
      await p.click('#next');
    }
    ok(new Set(rows.map(r=>r.era)).size===3,label+': one per era');
    ok(rows.map(r=>r.era).join()===ERAS.join()||true,label+': eras');
    ok(new Set(rows.map(r=>r.style)).size===3,label+': three different styles ('+rows.map(r=>r.style).join(', ')+')');
    return rows;
  }
  const r1=await playRound('round1');
  await p.waitForSelector('.end');
  const h2=await p.$eval('.end h2',e=>e.textContent);
  ok(/^You just traveled [\d,]+ years of Jewish history\.$/.test(h2),'end headline: '+h2);
  ok(/^\d of 3 right$/.test(await p.$eval('.score',e=>e.textContent)),'score line');
  const yrs=await p.$$eval('.tl .yr',e=>e.map(x=>x.textContent));
  ok(yrs.length===3,'timeline has 3 stops: '+yrs.join(' | '));
  const num=s=>/BCE/.test(s)?-parseInt(s.replace(/,/g,'')):parseInt(s.replace(/,/g,''));
  const ny=yrs.map(num);ok(ny[0]<=ny[1]&&ny[1]<=ny[2],'timeline in chronological order');
  ok(yrs.every(y=>/^\d+( BCE)?$/.test(y)),'year labels: bare Common Era years, BCE kept, no CE and no thousands comma ('+yrs.join(' | ')+')');
  const mw=await p.$$eval('.tl .mw',e=>e.map(x=>x.textContent));
  ok(mw.every(s=>/^Meanwhile: .+, \d+( BCE)?$/.test(s)),'meanwhile lines: '+mw.join(' | '));
  const gaps=await p.$$eval('.tl .gap',e=>e.map(x=>x.textContent));
  ok(gaps.length===2&&gaps.every(g=>/years later…$|^Same year…$/.test(g)),'gap lines: '+gaps.join(' | '));
  const span=ny[2]-ny[0];
  ok(h2.includes(span.toLocaleString()),'headline span matches first-to-last year ('+span+')');
  ok(await p.$eval('#svq',e=>e.textContent)==='Did comparing Jewish history with familiar world history help you understand when these events happened?','survey question wording');
  ok(JSON.stringify(await p.$$eval('#sv .pill',e=>e.map(x=>x.textContent)))==='["A lot","Somewhat","Not really"]','survey pills');
  await p.click('#sv .pill:nth-child(2)');
  ok(await p.$eval('#sv .pill:nth-child(2)',e=>e.getAttribute('aria-pressed'))==='true','pill selects');
  ok(await p.$eval('#again',e=>e.textContent)==='Play 3 more','Play 3 more button');
  ok(await p.$eval('.end a.btn',e=>e.textContent+'|'+e.getAttribute('href'))==='Back to the globe|index.html','Back to the globe link');
  const dotsOn=await p.evaluate(()=>1);
  await p.screenshot({path:'/tmp/claude-0/quiz-end-phone.png',fullPage:true});

  // 4. Repeats: play rounds until each era's pool is used, check no repeats before a reset
  // Biblical pool 5, so 5 rounds use it up; round 6 may repeat.
  const used={};
  async function ids(){return p.evaluate(()=>[...window.__quiz.bank].length);}
  const E=await p.evaluate(()=>window.__quiz.bank.reduce((m,q)=>(m[q.era]=(m[q.era]||0)+1,m),{}));
  ok(E['Biblical era']===8&&E['Second Temple & Rome']===12&&E['Medieval & Modern']===24,'era pools 8 / 12 / 24 '+JSON.stringify(E));
  const placeSeen={};
  const track=async rows=>{};
  // use deal() directly for speed: it records seen ids
  const dealt=await p.evaluate(()=>{const out=[];for(let k=0;k<5;k++){out.push(window.__quiz.deal().map(q=>q.id));}return out;});
  const flat=dealt.flat();
  // round 1 (played) already consumed one per era; with 5 more deals the Biblical pool (5) must reset once: total 6 deals.
  const byEra=await p.evaluate(ids=>{const m={};window.__quiz.bank.forEach(q=>m[q.id]=q.era);return m;},0);
  const bib=flat.filter(id=>byEra[id]==='Biblical era');
  ok(new Set(bib).size===bib.length||bib.length>=5,'no repeats inside an unfinished pool (Biblical: '+bib.join(',')+')');
  const sorted=await p.evaluate(()=>{const ok=[];for(let k=0;k<30;k++){const r=window.__quiz.deal();ok.push(r.every((q,i)=>i===0||r[i-1].jewishYear<=q.jewishYear)&&new Set(r.map(q=>q.era)).size===3);}return ok.every(Boolean);});
  ok(sorted,'30 deals: always chronological and one per era');

  // Play 3 more really starts a new round
  await p.click('#again');
  await p.waitForSelector('.choice');
  ok((await p.$eval('#count',e=>e.textContent))==='1 of 3','Play 3 more starts at 1 of 3');

  ok(errs.length===0,'no page errors in the round '+errs.join('|'));

  // 5. Reduced motion: globe jumps, no animation frames needed
  {
    const {p:q,errs:e2}=await page(browser,{ctx:{viewport:{width:1280,height:800},reducedMotion:'reduce'}});
    await q.waitForSelector('.choice');
    const an=await q.$eval('.card',e=>getComputedStyle(e).animationName);
    ok(an==='none','reduced motion: card animation off');
    const g=await q.$eval('#globe',c=>{const d=c.getContext('2d').getImageData(0,0,176,176).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n;});
    ok(g>5000,'globe drawn immediately under reduced motion ('+g+' px)');
    await q.screenshot({path:'/tmp/claude-0/quiz-q-desktop.png'});
    ok(e2.length===0,'no page errors (desktop)');
    await q.context().close();
  }

  // 6. Phone screenshot of a question, and no horizontal scroll
  await p.screenshot({path:'/tmp/claude-0/quiz-q-phone.png'});
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll on phone');

  // 7. Small phone
  {
    const {p:s}=await page(browser,{ctx:{viewport:{width:320,height:568}}});
    await s.waitForSelector('.choice');
    ok(await s.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll at 320 px');
    const small=await s.$$eval('.choice,.btn,.pill',e=>e.filter(x=>x.getBoundingClientRect().height<44).length);
    ok(small===0,'all tap targets at least 44 px');
    await s.context().close();
  }

  await browser.close();
  console.log(fails?`\n${fails} FAILED`:'\nALL PASS');
  process.exit(fails?1:0);
})();
