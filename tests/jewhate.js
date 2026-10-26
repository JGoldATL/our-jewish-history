// JewHate: family tabs, focus carousel, entry page. Everything from data/jewhate.json.
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
const fs=require('fs');const D=JSON.parse(fs.readFileSync(__dirname+'/../data/jewhate.json','utf8')).entries;const L=D.filter(e=>e.status==='LOCKED');
(async()=>{const br=await chromium.launch();const errs=[];
for(const [vw,vh,tag] of [[1280,800,'desktop'],[390,844,'phone']]){
  const ctx=await br.newContext({viewport:{width:vw,height:vh}});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));const n=tag+': ';
  await p.goto(BASE+'jewhate.html');await p.waitForTimeout(2200);
  ck(/The History of JewHate/.test(await p.title())&&(await p.$eval('.brand h1',x=>x.textContent))==='The History of JewHate'&&(await p.$eval('.brand p',x=>x.textContent))==='The origin of lies and stereotypes.',n+'title and intro are exactly as approved');
  const tabs=await p.$$eval('.tab',b=>b.map(x=>x.textContent.replace(/\s+/g,' ').trim()));
  ck(tabs[0]==='All '+L.length,n+'All tab count is computed ('+tabs[0]+')');
  const fam={};L.forEach(e=>fam[e.family]=(fam[e.family]||0)+1);const multi=Object.keys(fam).filter(f=>fam[f]>=2),oth=L.filter(e=>fam[e.family]<2).length;
  ck(multi.every(f=>tabs.includes(f+' '+fam[f])),n+'every family with 2 or more entries has its own tab with the right count');
  ck(oth===0||tabs[tabs.length-1]==='Other '+oth,n+'one-entry families are grouped under Other ('+tabs[tabs.length-1]+')');
  ck(tabs.length===1+multi.length+(oth?1:0),n+'no extra or hard-coded tabs ('+tabs.join(' | ')+')');
  ck((await p.$$eval('.tab[aria-selected=true]',b=>b.length))===1,n+'one tab selected');
  const cards=await p.$$('.card');ck(cards.length===L.length,n+'All shows every LOCKED entry ('+cards.length+')');
  const txt=await p.evaluate(()=>document.body.innerText);
  ck(!/Claim is false|The claim made|\[[^\]]+\]/.test(txt),n+'no "Claim is false" tag, no placeholder brackets');
  ck((await p.$$eval('.card .chip',c=>c.length))===0,n+'no year (or any chip) on preview cards');
  const withYear=L.filter(e=>e.year!=null&&e.family===L[0].family).length;
  ck((await p.$$eval('.card',c=>c.every(x=>x.querySelectorAll('button.ojj-share').length===1)))&&(await p.$$eval('.card',c=>c.length))===L.length,n+'exactly one Share button on every card');
  ck(await p.$$eval('.card',c=>c.every(x=>x.querySelector('.fam').textContent.trim()&&x.querySelector('.lie .lb').textContent==='The lie'&&x.querySelector('a.read'))),n+'every card: family label, "The lie" box, Deep dive link');
  ck(!L.some(e=>e.status!=='LOCKED')&&!/Draft, not signed off/.test(txt),n+'no draft entries without ?drafts=1');
  const M=Math.floor(L.length/2);ck(!(await p.$eval('#pager [data-step="-1"]',b=>b.getAttribute('aria-disabled')==='true'))&&!(await p.$eval('#pager [data-step="1"]',b=>b.getAttribute('aria-disabled')==='true')),n+'opens on a middle card, both Previous and Next enabled');
  ck((await p.$eval('#pager .pgn',x=>x.firstChild.textContent))===`${M+1} of ${L.length}`,n+'opens centered on the middle card');
  // next moves one card
  await p.click('#pager [data-step="1"]');await p.waitForTimeout(900);
  ck((await p.$eval('#pager .pgn',x=>x.firstChild.textContent))===`${M+2} of ${L.length}`,n+'Next button moves one card on');
  await p.keyboard.press('ArrowRight');await p.waitForTimeout(900);ck((await p.$eval('#pager .pgn',x=>x.firstChild.textContent)).startsWith((M+3)+' of'),n+'right arrow key moves on');
  await p.keyboard.press('ArrowLeft');await p.waitForTimeout(900);ck((await p.$eval('#pager .pgn',x=>x.firstChild.textContent)).startsWith((M+2)+' of'),n+'left arrow key moves back');
  ck((await p.$$eval('.card[inert]',c=>c.length))===L.length-1,n+'only the focused card can be tabbed to');
  // change tab resets
  await p.click('.tab:nth-child(2)');await p.waitForTimeout(500);
  {const q=await p.$eval('#pager .pgn',x=>x.firstChild.textContent),k=await p.$$eval('.card',c=>c.length);ck(q===`${Math.floor(k/2)+1} of ${k}`,n+'changing tab opens on that family\'s middle card');}
  // last card: Next disabled, no wrap
  const m=await p.$$eval('.card',c=>c.length);for(let i=0;i<m&&!(await p.$eval('#pager [data-step="1"]',b=>b.getAttribute('aria-disabled')==='true'));i++){await p.click('#pager [data-step="1"]');await p.waitForTimeout(350);}
  ck(await p.$eval('#pager [data-step="1"]',b=>b.getAttribute('aria-disabled')==='true'),n+'Next disabled at the last card, no wrap-around');
  await p.waitForTimeout(600);// controls reachable and sized
  const sizes=await p.$$eval('.tab,#pager .pgb,.card.cur a.read,.card.cur .ojj-share',b=>b.filter(x=>x.offsetParent).map(x=>{const r=x.getBoundingClientRect();return Math.min(r.width,r.height)}));
  ck(sizes.every(s=>s>=43.5),n+'touch targets at least 44 px ('+Math.min(...sizes).toFixed(0)+')');
  ck(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),n+'no sideways page scroll');
  if(vw>=760){const g=await p.evaluate(()=>{const nv=document.querySelector('#gnBar .gp').getBoundingClientRect(),h=document.querySelector('.brand h1').getBoundingClientRect();return {nl:nv.left,hr:h.right,ht:h.top,nb:nv.bottom}});ck(g.nl>g.hr&&g.ht<g.nb,n+'nav on the right, title raised into the nav row');}
  const items=await p.$$eval('#gnBar .gp-btn',b=>b.map(x=>x.textContent.trim()));ck(items.join(',')==='Events,Movements,JewHate,Archaeology,Quiz','nav pill order: '+items.join(' > '));
  await ctx.close();
}
// drafts flag
let ctx=await br.newContext({viewport:{width:1280,height:800}});let p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'jewhate.html?drafts=1');await p.waitForTimeout(2200);
ck((await p.$$('.card')).length===D.length,'?drafts=1 shows the LEANING entry too ('+D.length+')');ck((await p.$$eval('.draft',x=>x.length))===D.length-L.length,'draft entries carry a Draft tag');
// entry page
await p.goto(BASE+'jewhate-entry.html?id='+L[2].id);await p.waitForTimeout(2000);
const t=await p.evaluate(()=>document.body.innerText);
ck(await p.$eval('.lie .lb',x=>x.textContent)==='The lie'&&t.includes(L[2].lie),'entry page: the lie is shown in the labeled box');
ck(t.includes(L[2].record)&&t.includes(L[2].deepDive),'entry page: the record and Deep Dive text are shown in full, not truncated');
ck((await p.$$eval('button.ojj-share',b=>b.length))===1,'entry page: exactly one Share button');
await p.evaluate(()=>{window.__u=null;Object.defineProperty(navigator,'share',{value:d=>{window.__u=d;return Promise.resolve();},configurable:true});});
await p.click('button.ojj-share');await p.waitForTimeout(200);
{const u=await p.evaluate(()=>window.__u);ck(u&&/jewhate-entry\.html\?id=/.test(u.url)&&!/drafts/.test(u.url)&&/The History of JewHate/.test(u.title)&&u.text==='I thought you\u2019d enjoy this. Did you know that Jews\u2026'&&!u.text.includes(L[2].lie),'entry page: Share hands the entry link (no drafts flag) to the share sheet');}
await p.evaluate(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.resolve()},configurable:true});});
await p.click('button.ojj-share');await p.waitForTimeout(200);
ck((await p.$eval('.ojj-sr',x=>x.textContent))==='Link copied','entry page: without a share sheet the link is copied and "Link copied" is announced');
ck(/What the record shows/.test(t)&&/Where it started, and how it spread/.test(t)&&/Where you may still hear it/.test(t)&&/sources/i.test(t),'entry page: the sections');
ck(!/Where\s*\n.*map/i.test(t)&&(await p.$$('.panel .lbl')).length>=0&&!(await p.$$eval('.panel .lbl',x=>x.map(y=>y.textContent)).then(a=>a.includes('Where'))),'entry page: no Where map panel');
ck(!/Internal|Evidence status|Date certainty|Accuracy|Knowledge category/.test(t),'entry page: no internal columns');
const noYear=L.find(e=>e.year==null);await p.goto(BASE+'jewhate-entry.html?id='+noYear.id);await p.waitForTimeout(1500);
ck(!(await p.$$eval('.panel .lbl',x=>x.map(y=>y.textContent)).then(a=>a.includes('When'))),'entry page: When panel omitted when the entry has no year');
const noUrl=L.find(e=>(e.sources||[]).some(s=>!s.url));if(noUrl){await p.goto(BASE+'jewhate-entry.html?id='+noUrl.id);await p.waitForTimeout(1500);const s=noUrl.sources.find(s=>!s.url);ck((await p.$$eval('.src li',l=>l.length))===noUrl.sources.length&&(await p.$$eval('.src li',l=>l.filter(x=>!x.querySelector('a')).length))>=1,'entry page: a source with no URL shows without a link');}
{const dr=D.find(e=>e.status!=='LOCKED');if(dr){await p.goto(BASE+'jewhate-entry.html?id='+dr.id);await p.waitForTimeout(1200);ck(/not available/.test(await p.innerText('#msg')),'LEANING entry page is not available without ?drafts=1');}else{await p.goto(BASE+'jewhate-entry.html?id=JH-999');await p.waitForTimeout(1200);ck(/not available/.test(await p.innerText('#msg')),'unknown entry id shows the not-available message');}}
ck(/noindex/.test(await (await fetch(BASE+'jewhate.html')).text()),'pages carry noindex until Strategy decides on search indexing');
ck(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
console.log(bad?'FAILED '+bad:'ALL PASS');await br.close();process.exit(bad?1:0);})();
