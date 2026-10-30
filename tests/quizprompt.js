// F-035 quiz prompt after three cards. Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/quizprompt.js   (headless Chromium only)
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':' '+JSON.stringify(x)));if(!c)bad++;};
const fs=require('fs');const H=JSON.parse(fs.readFileSync(__dirname+'/../data/history.json','utf8')).sheet;
const card=H.cards.find(x=>x.status==='approved'&&x.type==='Event');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch();
const mk=async(o)=>{o=o||{};const ctx=await b.newContext({viewport:o.vp||{width:1280,height:800},hasTouch:!!o.touch});
  await ctx.addInitScript(broken=>{window.__ev=[];window.gtag=function(){window.__ev.push([].slice.call(arguments));};
    if(broken){const bad={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');},removeItem(){},clear(){}};Object.defineProperty(window,'sessionStorage',{get:()=>bad});Object.defineProperty(window,'localStorage',{get:()=>bad});}},!!o.broken);
  if(o.noBank)await ctx.route('**/data/history.json',async r=>{const j=await (await r.fetch()).json();j.sheet.questions=j.sheet.questions.map(q=>({...q,status:'draft'}));r.fulfill({json:j});});
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));return {ctx,p};};
const evs=p=>p.evaluate(()=>window.__ev.filter(e=>/^quiz_prompt/.test(e[1])).map(e=>e[1]+(e[2]&&e[2].result?':'+e[2].result:'')));
const pop=p=>p.locator('.ojjqp');
const waitPop=async(p,ms)=>{try{await p.waitForSelector('.ojjqp',{timeout:ms||6000});return true;}catch(e){return false;}};
async function nextN(p,sel,n,gap){for(let k=0;k<n;k++){await p.locator(sel).first().click();await p.waitForTimeout(gap||700);}}

// ---- Events: the full flow
{const {ctx,p}=await mk();await p.goto(BASE+`events.html?card=${card.id}`);await p.waitForTimeout(2500);
 const S='#pgHost .pgb[data-step="1"]';
 ck(await p.evaluate(()=>sessionStorage.getItem('ojj-qp-cards'))===null,'events: a friend\'s link (?card=) is not counted');
 await nextN(p,S,2);await p.waitForTimeout(2200);ck(!(await pop(p).count()),'events: no pop-up after 2 different cards');
 await nextN(p,S,1);ck(await waitPop(p),'events: pop-up appears after the 3rd different card');
 const info=await p.evaluate(()=>{const e=document.querySelector('.ojjqp');return {n:e.querySelectorAll('.qpc button').length,x:!!e.querySelector('.qpx'),q:e.querySelector('.qpq').textContent,modal:e.getAttribute('aria-modal'),role:e.getAttribute('role')};});
 ck(info.n>=2&&info.x&&info.q.length>10&&info.modal==='false'&&info.role==='dialog','events: one question, answer choices, a close X, not modal',info);
 // does it cover the share button or the pager arrows?
 const ov=await p.evaluate(()=>{const r=document.querySelector('.ojjqp').getBoundingClientRect();const hit=s=>{const e=document.querySelector(s);if(!e)return null;const q=e.getBoundingClientRect();return !(q.right<r.left||q.left>r.right||q.bottom<r.top||q.top>r.bottom);};return {share:hit('#shareSlot .ojj-share'),pager:hit('#pgHost .ojjpg'),play:hit('#play'),box:[r.left|0,r.top|0,r.width|0,r.height|0]};});
 console.log('INFO events 1280x800 overlap',JSON.stringify(ov));
 await p.screenshot({path:'/tmp/claude-0/rm/qp-events-1280.png'});
 await p.evaluate(()=>{document.querySelector('a.qpgo')||0;});
 await p.locator('.ojjqp .qpc button').nth(0).click();await p.waitForTimeout(300);
 const after=await p.evaluate(()=>({v:document.querySelector('.qpv')?.textContent,t:document.querySelector('.qpt')?.textContent,go:document.querySelector('a.qpgo')?.getAttribute('href'),url:location.pathname,dis:[...document.querySelectorAll('.qpc button')].every(x=>x.disabled)}));
 ck(!!after.v&&!!after.go&&after.go==='quiz.html'&&after.url.endsWith('events.html')&&after.dis,'events: answering shows right or wrong, the explanation and a Play the full quiz button; the page does not move on its own',after);
 ck(!!after.t&&after.t.length>5,'events: the explanation line (quick take) is shown');
 await p.evaluate(()=>document.querySelector('a.qpgo').addEventListener('click',e=>e.preventDefault()));await p.locator('a.qpgo').click();
 const e1=await evs(p);ck(e1[0]==='quiz_prompt_shown'&&/^quiz_prompt_answered:(right|wrong)$/.test(e1[1])&&e1[2]==='quiz_prompt_tapped_through',"events: GA4 sends shown, answered (right or wrong), tapped through",e1);
 const keys=await p.evaluate(()=>window.__ev.filter(e=>/^quiz_prompt/.test(e[1])).map(e=>Object.keys(e[2]).sort().join()));
 ck(keys.every(k=>/^(page_kind|question_id|result|page_kind,question_id|page_kind,question_id,result)$/.test(k)),'events: GA4 events carry only page kind, question id and result',keys);
 await p.locator('.ojjqp .qpx').click();ck(!(await pop(p).count()),'events: X closes it after answering');
 await nextN(p,S,3);await p.waitForTimeout(2500);ck(!(await pop(p).count()),'events: not shown a second time in the same visit');
 ck((await evs(p)).filter(x=>x==='quiz_prompt_shown').length===1,'events: shown exactly once');
 ck(p.errs.length===0,'events: no page errors',p.errs);await ctx.close();}

// ---- Events: dismiss = 24 hours on this device
{const {ctx,p}=await mk();await p.goto(BASE+`events.html?card=${card.id}`);await p.waitForTimeout(2500);const S='#pgHost .pgb[data-step="1"]';
 await nextN(p,S,3);await waitPop(p);await p.locator('.ojjqp .qpx').click();
 ck((await evs(p)).join()==='quiz_prompt_shown,quiz_prompt_dismissed','events: dismissing sends a dismissed event');
 const until=await p.evaluate(()=>+localStorage.getItem('ojj-qp-until'));ck(until-Date.now()>23.9*3600e3&&until-Date.now()<=24*3600e3+5000,'events: dismissal stored for 24 hours on the device',until-Date.now());
 const p2=await ctx.newPage();await p2.goto(BASE+`events.html?card=${card.id}`);await p2.waitForTimeout(2500);await nextN(p2,S,3);await p2.waitForTimeout(2500);
 ck(!(await pop(p2).count()),'events: a new visit on the same device stays quiet inside 24 hours');
 await p2.evaluate(()=>localStorage.setItem('ojj-qp-until',String(Date.now()-1000)));
 const p3=await ctx.newPage();await p3.goto(BASE+`events.html?card=${card.id}`);await p3.waitForTimeout(2500);await nextN(p3,S,3);
 ck(await waitPop(p3),'events: after the 24 hours it can show again');
 // Escape inside the pop-up also dismisses
 await p3.locator('.ojjqp .qpc button').first().focus();await p3.keyboard.press('Escape');ck(!(await pop(p3).count()),'events: Escape inside the pop-up closes it');
 await ctx.close();}

// ---- Events: Play (autoplay) does not count
{const {ctx,p}=await mk();await p.goto(BASE+'events.html');await p.waitForTimeout(3000);
 const pl=p.locator('#play');if(await pl.isVisible().catch(()=>false)){await pl.click();}else{await p.evaluate(()=>{const b=document.querySelector('#play');if(b)b.hidden=false;});await p.locator('#play').click({force:true});}
 await p.waitForTimeout(9000);const c=await p.evaluate(()=>sessionStorage.getItem('ojj-qp-cards'));
 ck(c===null||JSON.parse(c).length===0,'events: cards that autoplay opens are not counted',c);ck(!(await pop(p).count()),'events: no pop-up during autoplay');await ctx.close();}

// ---- Events: never mid-swipe (finger still down), then shows once it is let go
{const {ctx,p}=await mk();await p.goto(BASE+`events.html?card=${card.id}`);await p.waitForTimeout(2500);const S='#pgHost .pgb[data-step="1"]';
 await nextN(p,S,3,300);await p.mouse.move(400,300);await p.mouse.down();await p.waitForTimeout(3000);
 ck(!(await pop(p).count()),'events: nothing appears while a finger/pointer is down',await pop(p).count());
 await p.mouse.up();ck(await waitPop(p,5000),'events: appears after the gesture ends and things settle');await ctx.close();}

// ---- Events: empty bank
{const {ctx,p}=await mk({noBank:true});await p.goto(BASE+`events.html?card=${card.id}`);await p.waitForTimeout(2500);const S='#pgHost .pgb[data-step="1"]';
 await nextN(p,S,4);await p.waitForTimeout(2500);
 ck(!(await pop(p).count())&&(await evs(p)).length===0,'events: no approved question means no pop-up and no events');
 ck(await p.evaluate(()=>sessionStorage.getItem('ojj-qp-shown'))===null,'events: the one chance is not used up when there is nothing to ask');ck(p.errs.length===0,'events: empty bank causes no page errors',p.errs);await ctx.close();}

// ---- Events: storage blocked
{const {ctx,p}=await mk({broken:true});await p.goto(BASE+`events.html?card=${card.id}`);await p.waitForTimeout(2500);const S='#pgHost .pgb[data-step="1"]';
 await nextN(p,S,3);ck(await waitPop(p),'storage blocked: still shows after 3 cards (counted in memory)');
 await p.locator('.ojjqp .qpx').click();await nextN(p,S,3);await p.waitForTimeout(2500);ck(!(await pop(p).count()),'storage blocked: at most once per page load');ck(p.errs.length===0,'storage blocked: no page errors',p.errs);await ctx.close();}

// ---- Events on a phone (touch, narrow): layout and overlap
{const {ctx,p}=await mk({vp:{width:390,height:844},touch:true});await p.goto(BASE+`events.html?card=${card.id}`);await p.waitForTimeout(2500);const S='#pgHost .pgb[data-step="1"]';
 for(let k=0;k<3;k++){await p.locator(S).first().tap();await p.waitForTimeout(700);}
 ck(await waitPop(p),'phone: pop-up appears after 3 cards');
 const ov=await p.evaluate(()=>{const r=document.querySelector('.ojjqp').getBoundingClientRect();const hit=s=>{const e=document.querySelector(s);if(!e)return null;const q=e.getBoundingClientRect();return !(q.right<r.left||q.left>r.right||q.bottom<r.top||q.top>r.bottom);};return {share:hit('#shareSlot .ojj-share'),pager:hit('#pgHost .ojjpg'),fits:r.left>=0&&r.right<=innerWidth,h:r.height|0,x:document.querySelector('.qpx').getBoundingClientRect().width|0,noSide:document.documentElement.scrollWidth<=innerWidth+1};});
 console.log('INFO events 390x844 overlap',JSON.stringify(ov));ck(ov.fits&&ov.noSide&&ov.x>=44,'phone: pop-up fits the screen, no sideways scroll, X is 44 px wide',ov);
 await p.screenshot({path:'/tmp/claude-0/rm/qp-events-390.png'});await ctx.close();}

// ---- Movements
{const {ctx,p}=await mk();await p.goto(BASE+'movements.html');await p.waitForTimeout(3500);
 const nx=p.locator('#next');ck(await nx.count()>0,'movements: Next button found');
 await p.evaluate(()=>document.getElementById('panel').classList.remove('inviting'));   // the panel opens on its own invitation first; this only shows the Previous/Next buttons
 for(let k=0;k<2;k++){await nx.click();await p.waitForTimeout(800);}await p.waitForTimeout(2200);ck(!(await pop(p).count()),'movements: none after 2 cards');
 await nx.click();ck(await waitPop(p,9000),'movements: appears after the 3rd different card');ck(p.errs.length===0,'movements: no page errors',p.errs);await ctx.close();}

// ---- JewHate: carousel, then an entry page
{const {ctx,p}=await mk();await p.goto(BASE+'jewhate.html');await p.waitForTimeout(2500);const S='#pager .pgb[data-step="1"]';
 await nextN(p,S,2,900);await p.waitForTimeout(2200);ck(!(await pop(p).count()),'jewhate: none after 2 cards');
 await nextN(p,S,1,900);ck(await waitPop(p,8000),'jewhate: appears after the 3rd different card');
 ck(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('ojj-qp-cards')).length)===3,'jewhate: the starting card and tab changes were not counted (exactly 3)');ck(p.errs.length===0,'jewhate: no page errors',p.errs);await ctx.close();}
{const {ctx,p}=await mk();await p.goto(BASE+'jewhate.html');await p.waitForTimeout(2500);const S='#pager .pgb[data-step="1"]';
 await p.evaluate(()=>sessionStorage.setItem('ojj-qp-cards',JSON.stringify(['other-1','other-2'])));   // two cards already seen this visit
 await p.locator('.card.cur a.read').first().click();await p.waitForTimeout(2500);
 const n=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('ojj-qp-cards')||'[]').length);ck(n===3,'jewhate: opening a card\'s entry page counts as a card (count carries across pages in the visit)',n);
 ck(await waitPop(p,8000),'jewhate: the pop-up shows on the entry page');await ctx.close();}
{const {ctx,p}=await mk();await p.goto(BASE+'jewhate.html');await p.waitForTimeout(2500);const S='#pager .pgb[data-step="1"]';
 await nextN(p,S,2,900);await p.waitForTimeout(800);await p.locator('.card.cur a.read').first().click();await p.waitForTimeout(2500);
 const n=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('ojj-qp-cards')||'[]').length);ck(n===2,'jewhate: opening the entry of a card already counted does not count it twice',n);await ctx.close();}
{const {ctx,p}=await mk();await p.goto(BASE+'jewhate-entry.html?id='+encodeURIComponent(JSON.parse(fs.readFileSync(__dirname+'/../data/jewhate.json','utf8')).entries[0].id));await p.waitForTimeout(2000);
 ck(await p.evaluate(()=>sessionStorage.getItem('ojj-qp-cards'))===null,'jewhate: an entry page opened by a direct/friend link is not counted');await ctx.close();}

// ---- Archaeology: not over the intro card
{const {ctx,p}=await mk();await p.goto(BASE+'archaeology.html');await p.waitForTimeout(3500);
 await p.evaluate(()=>{['x1','x2','x3'].forEach(i=>OJJQuizPrompt.cardOpened(i));});await p.waitForTimeout(3500);
 ck(!(await pop(p).count()),'archaeology: nothing shows over the Begin the dig card');
 await p.locator('#begin').click();ck(await waitPop(p,8000),'archaeology: it can show once the intro is dismissed');await ctx.close();}
{const {ctx,p}=await mk();await p.goto(BASE+'archaeology.html');await p.waitForTimeout(3500);await p.locator('#begin').click();await p.waitForTimeout(500);
 const S='#card .pgb[data-step="-1"]';
 ck(await p.evaluate(()=>sessionStorage.getItem('ojj-qp-cards'))===null,'archaeology: the opening find is not counted');
 await nextN(p,S,2,900);await p.waitForTimeout(2200);ck(!(await pop(p).count()),'archaeology: none after 2 cards');
 await nextN(p,S,1,900);ck(await waitPop(p,8000),'archaeology: appears after the 3rd different card');ck(p.errs.length===0,'archaeology: no page errors',p.errs);await ctx.close();}

// ---- the quiz page and the old globe do not carry it
{const {ctx,p}=await mk();await p.goto(BASE+'quiz.html');await p.waitForTimeout(2500);ck(await p.evaluate(()=>typeof window.OJJQuizPrompt)==='undefined'&&await p.evaluate(()=>typeof window.OJJQuiz)==='object','quiz page: shared quizcore loaded, no pop-up code');ck(p.errs.length===0,'quiz page: no page errors',p.errs);await ctx.close();}
await b.close();console.log(bad?bad+' FAILED':'ALL PASSED');process.exit(bad?1:0);})();
