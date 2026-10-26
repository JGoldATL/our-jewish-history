// Events page on the shared card pager (F-147, CEO 10/22): counter "N of M", window of 7 / 5 / 3 dots, no wrap-around, "next" is the next card in the order shown (by date), arrow keys, hidden when no card is open.
// Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/events_pager.js   (headless Chromium only; no real iPad or phone)
const {chromium,devices}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
(async()=>{const b=await chromium.launch();const errs=[];
for(const [w,h,t,win] of [[1280,800,'desktop',7],[768,1024,'ipad',7],[390,844,'phone',5],[320,640,'small phone',3]]){
  const n=t+': ';const c=await b.newContext({viewport:{width:w,height:h},hasTouch:w<800});const p=await c.newPage();p.on('pageerror',e=>errs.push(n+e.message));
  await p.goto(BASE+'events.html');await p.waitForTimeout(3500);
  ck(!(await p.$('#prev'))&&!(await p.$('#next')),n+'old Previous and Next pills are gone; Play stays ('+!!(await p.$('#play'))+')');
  await p.evaluate(()=>selectMilestone(100));await p.waitForTimeout(700);
  const T=await p.evaluate(()=>milestones.length);
  const g=()=>p.evaluate(()=>{const e=document.querySelector('#pgHost .ojjpg');return {hidden:e.hidden,txt:e.querySelector('.pgn').firstChild.textContent,dots:e.querySelectorAll('.dotb').length,id:selected&&selected.record.id,prev:e.querySelector('[data-step="-1"]').getAttribute('aria-disabled'),next:e.querySelector('[data-step="1"]').getAttribute('aria-disabled')};});
  let s=await g();ck(!s.hidden&&s.txt===`101 of ${T}`&&s.dots===win,n+`counter reads "${s.txt}" with ${s.dots} dots (want ${win})`);
  const id0=s.id;await p.click('#pgHost [data-step="1"]');await p.waitForTimeout(500);s=await g();ck(s.txt===`102 of ${T}`&&s.id!==id0,n+'Next moves to the next card in date order');
  await p.keyboard.press('ArrowLeft');await p.keyboard.press('ArrowLeft');await p.waitForTimeout(600);s=await g();ck(s.txt===`100 of ${T}`,n+'left arrow key steps back');
  await p.evaluate(()=>selectMilestone(0));await p.waitForTimeout(500);s=await g();ck(s.prev==='true'&&/^1 of /.test(s.txt),n+'first card: Previous disabled, no wrap-around');
  await p.evaluate(()=>selectMilestone(milestones.length-1));await p.waitForTimeout(500);s=await g();ck(s.next==='true'&&s.txt===`${T} of ${T}`,n+'last card: Next disabled, no wrap-around');
  await p.evaluate(()=>closeStory());await p.waitForTimeout(400);s=await g();ck(s.hidden,n+'pager hides when no card is open');
  await c.close();}
// real-device sizes (Playwright's iPhone 13 is only 664 px tall, which is what a phone with the Safari bars really shows): the card title stays readable above the pager bar, and Play does not sit on Share
for(const [nm,d] of [['iPhone 13',devices['iPhone 13']],['iPhone SE',devices['iPhone SE']],['iPad upright',devices['iPad (gen 7)']]]){
  const c=await b.newContext({...d});const p=await c.newPage();p.on('pageerror',e=>errs.push(nm+': '+e.message));await p.goto(BASE+'events.html');await p.waitForTimeout(2800);
  for(let i=0;i<3;i++){await p.locator('#pgHost [data-step="1"]').tap();await p.waitForTimeout(400);}
  const r=await p.evaluate(()=>{const t=document.getElementById('storyTitle').getBoundingClientRect(),m=document.querySelector('.mnav').getBoundingClientRect(),pl=document.getElementById('play').getBoundingClientRect(),sh=document.querySelector('#shareSlot .ojj-share').getBoundingClientRect();
    return {firstLine:t.top>=0&&t.top+28<=m.top+2,barH:m.height,playHitsShare:!(pl.bottom<=sh.top||pl.top>=sh.bottom||pl.right<=sh.left||pl.left>=sh.right),playOn:pl.top>=0&&pl.bottom<=innerHeight&&pl.right<=innerWidth,horiz:document.documentElement.scrollWidth>innerWidth,pageScrolls:document.documentElement.scrollHeight>innerHeight+2};});
  if(nm==='iPhone SE')console.log('INFO iPhone SE (568 px tall): first line of the title '+(r.firstLine?'is':'is NOT')+' above the bar until you swipe the sheet up (the same before the pager existed)');else ck(r.firstLine,nm+': the first line of the card title is above the pager bar');ck(r.barH<=70,nm+': the pager bar is one row ('+Math.round(r.barH)+' px)');ck(!r.playHitsShare&&r.playOn,nm+': Play is on screen and clear of Share');ck(!r.horiz&&!r.pageScrolls,nm+': no sideways scroll, the page does not scroll');
  await c.close();}
ck(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));console.log(bad?'FAILED '+bad:'ALL PASS');await b.close();process.exit(bad?1:0);})();
