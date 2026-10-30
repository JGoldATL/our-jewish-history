// F-035 and F-129 on Events with touch: the quiz pop-up after three cards (tap, swipe, dots, arc), and no swipe hints on the card.
// Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/events_touch.js   (headless Chromium only: emulated touch, no real phone)
const {chromium,devices}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':' '+JSON.stringify(x)));if(!c)bad++;};
async function swipe(p,x1,y1,x2,y2){const c=await p.context().newCDPSession(p);const t=(type,x,y)=>c.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});await t('touchStart',x1,y1);for(let i=1;i<=8;i++){await t('touchMove',x1+(x2-x1)*i/8,y1+(y2-y1)*i/8);await p.waitForTimeout(16);}await t('touchEnd');}
const count=p=>p.evaluate(()=>JSON.parse(sessionStorage.getItem('ojj-qp-cards')||'[]').length);
const centre=async(p,sel,i)=>{const b=await p.locator(sel).nth(i||0).boundingBox();return b&&[b.x+b.width/2,b.y+b.height/2];};
(async()=>{const b=await chromium.launch();
const devs=[['iPhone 13 (390)',devices['iPhone 13']],['Pixel 7 (412)',devices['Pixel 7']],['small Android (360)',{viewport:{width:360,height:740},isMobile:true,hasTouch:true,userAgent:devices['Pixel 7'].userAgent,deviceScaleFactor:3}],['iPad',devices['iPad (gen 7)']]];
for(const [name,dev] of devs){for(const how of ['next button taps','card swipes','dots','timeline notches']){
  const ctx=await b.newContext({...dev});await ctx.addInitScript(()=>{window.__ev=[];window.gtag=function(){window.__ev.push([].slice.call(arguments));};});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'events.html?qp=reset');await p.waitForTimeout(3200);
  for(let k=0;k<3;k++){
    if(how==='next button taps'){const c=await centre(p,'#pgHost .pgb[data-step="1"]');await p.touchscreen.tap(c[0],c[1]);}
    if(how==='card swipes'){const sb=await p.locator('#story').boundingBox();await swipe(p,sb.x+sb.width*.85,sb.y+40,sb.x+sb.width*.15,sb.y+40);}
    if(how==='dots'){const c=await centre(p,'#pgHost .dotb',k+1);await p.touchscreen.tap(c[0],c[1]);}
    if(how==='timeline notches'){const c=await centre(p,'#arc .notch',6+k*5);await p.touchscreen.tap(c[0],c[1]);}
    await p.waitForTimeout(1000);}
  const n=await count(p);let up=false;try{await p.waitForSelector('.ojjqp',{timeout:6000});up=true;}catch(e){}
  ck(n===3&&up,name+': three cards by '+how+' count 3 and the pop-up appears',{n,up});
  ck(await p.evaluate(()=>window.__ev.some(e=>e[1]==='quiz_prompt_shown'&&e[2].page_kind==='events')),name+' / '+how+': shown event sent');
  ck(errs.length===0,name+' / '+how+': no page errors',errs);await ctx.close();}}
// dragging the timeline bead with a finger brings each card up in turn: that is the person's own action and counts (the missed hook behind Jeffrey's report)
for(const [name,dev] of devs.slice(0,3)){const ctx=await b.newContext({...dev});await ctx.addInitScript(()=>{window.__ev=[];window.gtag=function(){window.__ev.push([].slice.call(arguments));};});const p=await ctx.newPage();await p.goto(BASE+'events.html?qp=reset');await p.waitForTimeout(3200);
 const cd=await p.context().newCDPSession(p);const tt=(type,x,y)=>cd.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
 const bd=await p.locator('#arc .bead').first().boundingBox();const x=bd.x+bd.width/2,y=bd.y+bd.height/2;await tt('touchStart',x,y);for(let i=1;i<=40;i++){await tt('touchMove',x+i*5,y+Math.sin(i/8)*30+i*1.2);await p.waitForTimeout(40);}
 const during=await p.locator('.ojjqp').count();await tt('touchEnd');
 const n=await count(p);let up=false;try{await p.waitForSelector('.ojjqp',{timeout:6000});up=true;}catch(e){}
 ck(n>=3&&up&&during===0,name+': dragging the timeline counts the cards it brings up, and the pop-up waits until the finger lifts',{n,up,during});await ctx.close();}
{const ctx=await b.newContext({...devices['iPhone 13']});await ctx.addInitScript(()=>{window.gtag=function(){};});const p=await ctx.newPage();await p.goto(BASE+'events.html?qp=reset');await p.waitForTimeout(3200);
 const pl=await centre(p,'#play');await p.touchscreen.tap(pl[0],pl[1]);await p.waitForTimeout(9000);ck((await count(p))===0,'Play still does not count the cards it shows',await count(p));ck(await p.locator('.ojjqp').count()===0,'no pop-up during Play');await ctx.close();}
// a touch that never ends (finger lost) must not block the pop-up: the guard releases after about 1.5 s
{const ctx=await b.newContext({...devices['iPhone 13']});await ctx.addInitScript(()=>{window.gtag=function(){};});const p=await ctx.newPage();await p.goto(BASE+'events.html?qp=reset');await p.waitForTimeout(3200);
 for(let k=0;k<2;k++){const c=await centre(p,'#pgHost .pgb[data-step="1"]');await p.touchscreen.tap(c[0],c[1]);await p.waitForTimeout(900);}
 await p.evaluate(()=>{document.dispatchEvent(new Event('touchstart',{bubbles:true}));});   // finger down, never lifted
 const c=await centre(p,'#pgHost .pgb[data-step="1"]');await p.touchscreen.tap(c[0],c[1]);
 let t0=Date.now(),ok=false;try{await p.waitForSelector('.ojjqp',{timeout:7000});ok=true;}catch(e){}
 ck(ok,'a lost touchend does not block the pop-up',Date.now()-t0);await ctx.close();}
// the debug line for a real phone
{const ctx=await b.newContext({...devices['iPhone 13']});const p=await ctx.newPage();await p.goto(BASE+'events.html?qp=reset&qp=debug');await p.waitForTimeout(2500);
 const t=await p.evaluate(()=>{const d=document.getElementById('ojjqpDbg');return d&&d.textContent;});ck(!!t&&/^qp-2026-10-30b \| cards 0\/3/.test(t),'?qp=debug shows the build, the card count and the reason',t);
 const c=await centre(p,'#pgHost .pgb[data-step="1"]');await p.touchscreen.tap(c[0],c[1]);await p.waitForTimeout(900);
 ck(/cards 1\/3/.test(await p.evaluate(()=>document.getElementById('ojjqpDbg').textContent)),'debug line counts the card');await ctx.close();}
{const ctx=await b.newContext({...devices['iPhone 13']});const p=await ctx.newPage();await p.goto(BASE+'events.html');await p.waitForTimeout(2200);ck(await p.locator('#ojjqpDbg').count()===0,'no debug line without ?qp=debug');await ctx.close();}
// F-129: no swipe hint anywhere on the Events card, half open or full, phone or iPad
for(const [name,dev] of [['iPhone 13',devices['iPhone 13']],['Pixel 7',devices['Pixel 7']],['iPad',devices['iPad (gen 7)']]]){
 const ctx=await b.newContext({...dev});await ctx.addInitScript(()=>{window.gtag=function(){};sessionStorage.setItem('ojj-qp-shown','1');});const p=await ctx.newPage();await p.goto(BASE+'events.html');await p.waitForTimeout(3000);
 const read=()=>p.evaluate(()=>{const f=document.querySelector('#panel>div:first-child'),a=f?getComputedStyle(f,'::after').content:'none',bf=f?getComputedStyle(f,'::before').content:'none';return {after:a,before:bf,text:/swipe/i.test(document.getElementById('panel').innerText),pseudoSwipe:/swipe/i.test(a)||/swipe/i.test(bf)};});
 let r=await read();ck(!r.text&&!r.pseudoSwipe,name+': no swipe hint on the half-open card',r);
 const h=await centre(p,'#sheetHandle');if(h&&await p.locator('#sheetHandle').isVisible()){await p.touchscreen.tap(h[0],h[1]);await p.waitForTimeout(600);r=await read();ck(!r.text&&!r.pseudoSwipe,name+': no swipe hint when the card is full',r);}
 await ctx.close();}
await b.close();console.log(bad?bad+' FAILED':'ALL PASSED');process.exit(bad?1:0);})();
