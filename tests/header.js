// Locked header (Jeffrey, 2026-11-01; Header_Final_v1). Run: NODE_PATH=$(npm root -g) node tests/header.js   (server on :8778 from the repo root)
// Checks on all seven pages at 390, 600, 655, 768, 949, 950, 1024, 1366 and 1920 px: nav order, one switch point at 950 px, fluid title at the locked points, compact nav
// (text 14 to 17 px, items 36 to 40 px), swipe below about 655 px with a gold cue arrow in its own slot that never covers an item and hides at the end, no overlap between the
// nav and the title, no sideways page scroll. Optional: FONTS=/path/to/node_modules/@fontsource (instrument-sans, cormorant-garamond) loads the real fonts; without it the two-line title rule is skipped.
const {chromium}=require('playwright');const fs=require('fs');const BASE=process.env.BASE||'http://localhost:8778/';
let bad=0;const ck=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':' '+JSON.stringify(x)));if(!c)bad++;};
const PAGES=['events','movements','jewhate','archaeology','haze','thankjews','quiz'],WIDTHS=[390,600,655,768,949,950,1024,1366,1920];
const ORDER='Events,Movements,JewHate,Archaeology,Islamic Rule,Thank Jews?,Quiz';
const TITLE={390:36,768:42,1024:51,1366:63,1920:64};
const FONTS=process.env.FONTS;
async function fonts(page){
 await page.route(/cdnjs\.cloudflare\.com|googletagmanager/,r=>r.abort());
 if(!FONTS){await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());return;}
 await page.route(/fonts\.googleapis\.com/,r=>{const f=[];for(const w of [400,500,600])f.push(`@font-face{font-family:'Instrument Sans';font-weight:${w};src:url(http://fonts.local/is-${w}.woff2)}`);
  for(const w of [500,600,700])for(const st of ['normal','italic'])f.push(`@font-face{font-family:'Cormorant Garamond';font-weight:${w};font-style:${st};src:url(http://fonts.local/cg-${w}-${st}.woff2)}`);r.fulfill({contentType:'text/css',body:f.join('\n')});});
 await page.route(/fonts\.gstatic\.com/,r=>r.abort());
 await page.route(/fonts\.local/,r=>{const m=r.request().url().match(/(is|cg)-(\d+)(?:-(normal|italic))?\.woff2/);
  r.fulfill({contentType:'font/woff2',body:fs.readFileSync(m[1]==='is'?`${FONTS}/instrument-sans/files/instrument-sans-latin-${m[2]}-normal.woff2`:`${FONTS}/cormorant-garamond/files/cormorant-garamond-latin-${m[2]}-${m[3]}.woff2`)});});}
const hit=(a,b)=>a.left<b.right-.5&&a.right>b.left+.5&&a.top<b.bottom-.5&&a.bottom>b.top+.5;
(async()=>{const b=await chromium.launch();
 for(const pg of PAGES){for(const w of WIDTHS){
  const p=await b.newPage({viewport:{width:w,height:w<700?844:800}});await fonts(p);await p.goto(BASE+pg+'.html');await p.waitForTimeout(1800);
  const r=await p.evaluate(()=>{const R=e=>{const q=e.getBoundingClientRect();return {left:q.left,right:q.right,top:q.top,bottom:q.bottom};};
   const bar=document.getElementById('gnBar'),pill=bar.querySelector('.gp'),track=bar.querySelector('.gp-track'),btns=[...bar.querySelectorAll('.gp-btn')],cue=bar.querySelector('.gp-cue'),h1=document.querySelector('header.top .brand h1'),tag=document.querySelector('header.top .brand p,header.top .brand span'),on=btns.find(x=>x.getAttribute('aria-pressed')==='true'),tr=R(track);
   const lh=parseFloat(getComputedStyle(h1).lineHeight);
   const lines=e=>{if(!e)return [];const g=document.createRange();g.selectNodeContents(e);return [...g.getClientRects()].filter(q=>q.width>1).map(q=>({left:q.left,right:q.right,top:q.top,bottom:q.bottom}));};
   return {order:btns.map(x=>x.textContent.trim()).join(','),pill:R(pill),btn0:getComputedStyle(btns[0]),font:parseFloat(getComputedStyle(btns[0]).fontSize),h:btns[0].getBoundingClientRect().height,swipes:track.scrollWidth>track.clientWidth+2,
    cueShown:getComputedStyle(cue).display!=='none',cueRect:R(cue),btnRects:btns.map(R),h1:R(h1),h1lines:lines(h1),taglines:lines(tag),tag:tag?R(tag):null,title:parseFloat(getComputedStyle(h1).fontSize),lines:Math.round(h1.getBoundingClientRect().height/lh),
    over:document.documentElement.scrollWidth-innerWidth,labels:btns.map(x=>x.textContent.trim().length),onIn:on?(R(on).left>=tr.left-1&&R(on).right<=tr.right+1):null,quizLast:btns[btns.length-1].textContent.trim()==='Quiz',
    fontsOK:document.fonts.check('700 20px "Cormorant Garamond"')&&document.fonts.check('600 14px "Instrument Sans"'),trackRect:tr};});
  const t=pg+' '+w+' px: ';
  ck(r.order===ORDER,t+'nav order',r.order);ck(r.quizLast&&r.labels.every(n=>n<=12),t+'Quiz rightmost, labels 12 characters or fewer',r.labels);
  ck(r.over<=1,t+'no sideways page scroll',r.over);
  ck(r.font>=13.99&&r.font<=17.01&&r.h>=35.9&&r.h<=40.1,t+'compact nav: text 14 to 17 px, items 36 to 40 px',{font:r.font,h:r.h});
  ck(r.swipes===(w<655),t+'pill swipes only below about 655 px (swipes: '+r.swipes+')');
  if(TITLE[w])ck(Math.abs(r.title-TITLE[w])<=1,t+'title '+TITLE[w]+' px at this width',r.title);
  if(w>=950){const narrow=r.h1.right<=r.pill.left+1||r.h1.bottom<=r.pill.top+1||r.h1.top>=r.pill.bottom-1;ck(!r.h1lines.some(q=>hit(q,r.pill))&&!r.taglines.some(q=>hit(q,r.pill)),t+'nav shares the title line and does not overlap the title or tagline',{h1:r.h1lines,pill:r.pill});
   ck(r.pill.top<r.h1.top+r.title*1.1&&r.pill.bottom>r.h1.top,t+'nav is level with the title',{pill:[r.pill.top,r.pill.bottom],h1top:r.h1.top});}
  else ck(r.pill.bottom<=r.h1.top+1,t+'nav sits above the title',{pill:r.pill.bottom,h1:r.h1.top});
  if(r.fontsOK)ck(r.lines<=2,t+'title fits in two lines or fewer',r.lines);
  if(r.swipes){ck(r.cueShown&&!r.btnRects.filter(x=>x.right>r.trackRect.left+1&&x.left<r.trackRect.right-1).map(x=>({left:Math.max(x.left,r.trackRect.left),right:Math.min(x.right,r.trackRect.right),top:x.top,bottom:x.bottom})).some(x=>hit(x,r.cueRect)),t+'gold cue arrow is in its own slot and covers no item',r.cueRect);
   const col=await p.$eval('#gnBar .gp-cue',e=>getComputedStyle(e).color);ck(/224,\s*176,\s*79|rgb\(224, 176, 79\)/.test(col),t+'cue arrow is gold #E0B04F',col);
   ck(r.onIn!==false,t+'the current page is scrolled into view',r.onIn);
   await p.$eval('#gnBar .gp-track',e=>{e.scrollLeft=e.scrollWidth;});await p.waitForTimeout(350);
   const hid=await p.$eval('#gnBar .gp-cue',e=>getComputedStyle(e).visibility);ck(hid==='hidden',t+'cue arrow hides at the end of the swipe',hid);
   const clickable=await p.$eval('#gnBar .gp-cue',e=>getComputedStyle(e).pointerEvents);ck(clickable==='none','cue is a cue only, not a button',clickable);}
  await p.close();}}
 await b.close();console.log(bad?bad+' FAILED':'ALL PASSED');process.exit(bad?1:0);})();
