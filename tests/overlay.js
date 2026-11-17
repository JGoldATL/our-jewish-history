// 3.7.0 home overlay. Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/overlay.js
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':' '+JSON.stringify(x)));if(!c)bad++;};
const TEXT='Before there was religion, being a Jew meant belonging to an ancient people with a homeland: the Land of Israel. Empires conquered us. Rulers expelled us. Jews were scattered across the world. This is our journey.';
(async()=>{const b=await chromium.launch();
for(const [w,h,n] of [[1280,800,'desktop'],[390,844,'phone']]){
 const ctx=await b.newContext({viewport:{width:w,height:h}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE+'index.html?overlay=1');await p.waitForTimeout(1500);
 const o=await p.evaluate(()=>{const e=document.getElementById('intro');if(!e)return null;const r=e.getBoundingClientRect();return {vis:!e.hidden,h2:e.querySelector('h2').textContent,p:e.querySelector('p').textContent,bg:getComputedStyle(e).backgroundColor,w:r.width,h:r.height,z:getComputedStyle(e).zIndex,cover:document.getElementById('stage').classList.contains('cover-on')};});
 ck(o&&o.vis,n+': overlay shows on the first visit');ck(o&&o.h2==='Our Jewish Journey',n+': title is exactly as ruled');ck(o&&o.p===TEXT,n+': text is exactly as ruled',o&&o.p);
 ck(o&&/rgba\(11, 22, 36, 0\.66\)/.test(o.bg),n+': scrim is .66',o&&o.bg);ck(o&&o.w>=w-1&&o.h>=h-1,n+': covers the window');ck(o&&o.cover,n+': globe stays on its still cover under the overlay');
 const yr0=await p.textContent('#year');await p.waitForTimeout(1200);ck((await p.textContent('#year'))===yr0,n+': nothing moves under the overlay');
 await p.mouse.click(w/2,h/2);await p.waitForTimeout(250);const mid=await p.evaluate(()=>{const e=document.getElementById('intro');return e?+getComputedStyle(e).opacity:0;});
 ck(mid>0&&mid<1,n+': it dissolves rather than vanishing (opacity '+mid.toFixed(2)+' at 250 ms)');
 await p.waitForTimeout(700);ck((await p.$('#intro'))===null,n+': gone after the 0.6 s dissolve');
 await p.reload();await p.waitForTimeout(800);ck((await p.$('#intro'))===null,n+': not shown again in the same visit');
 await p.goto(BASE+'index.html?overlay=1&card=EVT-0001');await p.waitForTimeout(500);ck((await p.$('#intro'))===null,n+': a shared card link skips it');
 ck(errs.length===0,n+': no page errors',errs);await ctx.close();}
{const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();await p.goto(BASE+'index.html?overlay=1');await p.waitForTimeout(800);const hv=await p.evaluate(()=>[...document.querySelectorAll('#intro .hint span')].filter(x=>x.offsetParent).map(x=>x.textContent));ck(hv.join()==='Click to begin','desktop hint reads Click to begin',hv);await p.keyboard.press('Enter');await p.waitForTimeout(900);ck((await p.$('#intro'))===null,'Enter on the focused overlay also dismisses it');await ctx.close();}
{const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();await p.goto(BASE+'index.html?overlay=1');await p.waitForTimeout(800);const hv=await p.evaluate(()=>[...document.querySelectorAll('#intro .hint span')].filter(x=>x.offsetParent).map(x=>x.textContent));ck(hv.join()==='Tap to begin','touch hint reads Tap to begin',hv);await p.tap('#intro');await p.waitForTimeout(900);ck((await p.$('#intro'))===null,'a tap dismisses it');await ctx.close();}
{const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();await p.goto(BASE+'index.html');await p.waitForTimeout(800);ck((await p.$('#intro'))===null,'automated browsers skip it without ?overlay=1');await ctx.close();}
await b.close();console.log(bad?bad+' FAILED':'ALL PASSED');process.exit(bad?1:0);})();
