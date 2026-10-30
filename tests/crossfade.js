// F-159 inset cross-fade, F-160 option B (Movements zoom floor 26 on tablet and desktop), and the Sources entry for the elevation credit.
// Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/crossfade.js   (headless Chromium only)
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':' '+JSON.stringify(x)));if(!c)bad++;};
(async()=>{const b=await chromium.launch();
const ops=p=>p.evaluate(()=>{const o={};document.querySelectorAll('image[data-inset]').forEach(i=>{o[i.dataset.inset]=i.hasAttribute('opacity')?+i.getAttribute('opacity'):1;});return o;});
// ---- fade: scan the zoom on Archaeology, iPad landscape
{const ctx=await b.newContext({viewport:{width:1180,height:820}});await ctx.addInitScript(()=>{window.gtag=function(){};sessionStorage.setItem('ojj-qp-shown','1');});const p=await ctx.newPage();
 const seen={'tier1-land-of-israel':[],'tier2-near-east':[]};const errs=[];p.on('pageerror',e=>errs.push(e.message));
 for(let d=130;d>=6;d-=2){await p.goto(BASE+`archaeology.html?a=ARC-006&view=35.2,31.8,${d}`);await p.waitForTimeout(900);const o=await ops(p);for(const k in seen)seen[k].push([d,o[k]===undefined?0:o[k]]);}
 for(const k in seen){const s=seen[k].map(x=>x[1]);const mid=s.filter(v=>v>0&&v<1).length;const maxStep=Math.max(...s.slice(1).map((v,i)=>Math.abs(v-s[i])));
  ck(s[0]===0,k+': not drawn when zoomed far out');ck(s[s.length-1]===1,k+': fully opaque when zoomed in');ck(mid>=1,k+': passes through partial opacity (a fade, not a switch)',seen[k].filter(x=>x[1]>0&&x[1]<1));
  ck(s.every((v,i)=>i===0||v>=s[i-1]-0.001),k+': opacity only grows as you zoom in');ck(maxStep<=0.75,k+': no jump bigger than 0.75 per 2-degree step (was 0 to 1 before)',maxStep);}
 console.log('INFO samples',JSON.stringify(seen));ck(errs.length===0,'no page errors',errs);await ctx.close();}
// ---- manifest fadeBand 0 keeps the old hard switch
{const ctx=await b.newContext({viewport:{width:1180,height:820}});await ctx.addInitScript(()=>{window.gtag=function(){};sessionStorage.setItem('ojj-qp-shown','1');});
 await ctx.route('**/images/inset/manifest.json',async r=>{const j=await (await r.fetch()).json();j.insets.forEach(i=>i.fadeBand=0);r.fulfill({json:j});});
 const p=await ctx.newPage();const all=[];for(const d of [60,50,44,40,36,32,28,20]){await p.goto(BASE+`archaeology.html?a=ARC-006&view=35.2,31.8,${d}`);await p.waitForTimeout(800);all.push(Object.values(await ops(p)));}
 ck(all.flat().every(v=>v===1),'fadeBand 0 in the manifest restores the old all-or-nothing behaviour',all);await ctx.close();}
// ---- F-160 option B: on a tablet or desktop a person can zoom Movements to 16 degrees, where the Land of Israel picture (Tier 1) is fully drawn; phones stay at 46 with no insets
for(const [n,vp,touch] of [['iPad landscape',{width:1180,height:820},true],['iPad portrait',{width:820,height:1180},true],['desktop 1440',{width:1440,height:900},false]]){
 const ctx=await b.newContext({viewport:vp,hasTouch:touch});await ctx.addInitScript(()=>{window.gtag=function(){};sessionStorage.setItem('ojj-qp-shown','1');});const p=await ctx.newPage();
 await p.goto(BASE+'movements.html?view=35.2,31.8,60');await p.waitForTimeout(2500);for(let k=0;k<12;k++){await p.locator('#zin').click();await p.waitForTimeout(120);}await p.waitForTimeout(900);
 const o=await ops(p);ck(o['tier1-land-of-israel']===1&&o['tier2-near-east']===1,'movements '+n+': both insets fully drawn at the closest zoom',o);await ctx.close();}
{const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await ctx.addInitScript(()=>{window.gtag=function(){};sessionStorage.setItem('ojj-qp-shown','1');});const p=await ctx.newPage();
 await p.goto(BASE+'movements.html?view=35.2,31.8,60');await p.waitForTimeout(2500);for(let k=0;k<10;k++){await p.locator('#zin').click({force:true}).catch(()=>{});await p.waitForTimeout(100);}await p.waitForTimeout(500);
 ck(Object.keys(await ops(p)).length===0,'movements phone: still no insets at the closest zoom (floor stays 46 degrees)');await ctx.close();}
// ---- Sources: one list for the whole site
{const ctx=await b.newContext({viewport:{width:1280,height:800}});await ctx.addInitScript(()=>{window.gtag=function(){};});const p=await ctx.newPage();
 await p.goto(BASE+'events.html');await p.waitForTimeout(2500);await p.locator('#sourcesLink').click();await p.waitForTimeout(500);
 const li=await p.evaluate(()=>{const a=[...document.querySelectorAll('#allSources li')].find(l=>/OpenTopography/.test(l.textContent));return a?{t:a.textContent,href:a.querySelector('a')&&a.querySelector('a').href}:null;});
 ck(!!li&&/doi\.org\/10\.5069\/G9445JDF/.test(li.href)&&/SRTM/.test(li.t),'Sources dialog lists the NASA SRTM / OpenTopography credit with its DOI link',li);
 const n=await p.evaluate(()=>document.querySelectorAll('#allSources li').length);ck(n>5,'the rest of the Sources list is still there ('+n+' entries)');
 await p.goto(BASE+'index.html');await p.waitForTimeout(2500);await p.locator('#sourcesLink').click();await p.waitForTimeout(500);ck(await p.evaluate(()=>/OpenTopography/.test(document.getElementById('allSources').textContent)),'the old globe shows it too');
 await p.goto(BASE+'archaeology.html');await p.waitForTimeout(2500);ck(!(await p.evaluate(()=>/OpenTopography|SRTM/.test(document.querySelector('footer.foot').textContent))),'the Archaeology footer no longer carries the credit');
 ck(await p.evaluate(()=>/\d+\.\d+\.\d+/.test(document.getElementById('version').textContent)),'the Archaeology footer still shows the version');await ctx.close();}
await b.close();console.log(bad?bad+' FAILED':'ALL PASS');process.exit(bad?1:0);})();
