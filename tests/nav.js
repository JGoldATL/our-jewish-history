// Site nav (bottom left, collapsible) on the globe, quiz, Strategy, Roadmap and Feedback pages; Strategy page embeds the deck (gate pre-opened for these checks; tests/gate.js covers the gate).
const {chromium}=require('playwright');
const SITE=process.env.SITE||'http://localhost:8778/';
const DECK='1Z4MahsifP0Z_ZOW7O8yQaCDR0XHLPHbVJjyyITAUWaQ';
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const out=[];let fail=0;
const ck=(n,ok,x)=>{out.push((ok?'ok   ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)fail++;};
const devs=[['iPhone',{width:390,height:844}],['iPad',{width:820,height:1180}],['desktop',{width:1280,height:800}]];
for(const [dn,vp] of devs){
 for(const pg of ['index.html','quiz.html?logtest=0','strategy.html','roadmap.html','feedback.html']){
  const ctx=await b.newContext({viewport:vp,hasTouch:dn!=='desktop'});await ctx.addInitScript(()=>{try{sessionStorage.setItem('ojj-gate','1')}catch(e){}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/docs.google.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<p>deck</p>'}));
  await p.goto(SITE+pg);await p.waitForTimeout(pg==='index.html'?2500:900);
  if(pg==='index.html')await p.evaluate(()=>{try{dismissPrompt()}catch(e){}});
  const t=dn+' '+pg.split('?')[0];
  const btn=p.locator('#siteNavBtn');ck(t+': More button visible',await btn.isVisible());
  const box=await btn.boundingBox();ck(t+': bottom left',box&&box.x<120&&box.y>vp.height-140&&box.y+box.height<=vp.height,box&&{x:Math.round(box.x),y:Math.round(box.y)});
  ck(t+': menu starts closed',await p.locator('#siteNavMenu').isHidden()&&(await btn.getAttribute('aria-expanded'))==='false');
  await btn.click();ck(t+': tap opens',await p.locator('#siteNavMenu').isVisible()&&(await btn.getAttribute('aria-expanded'))==='true');
  const links=await p.$$eval('#siteNavMenu a',a=>a.map(x=>x.getAttribute('href')));ck(t+': links',JSON.stringify(links)==='["feedback.html","roadmap.html","strategy.html"]',links);
  const mb=await p.locator('#siteNavMenu').boundingBox();ck(t+': menu on screen',mb&&mb.x>=0&&mb.y>=0&&mb.x+mb.width<=vp.width,mb&&{x:Math.round(mb.x),y:Math.round(mb.y)});
  await p.keyboard.press('Escape');ck(t+': Escape closes',await p.locator('#siteNavMenu').isHidden());
  await btn.click();await p.mouse.click(vp.width-20,60);ck(t+': tap outside closes',await p.locator('#siteNavMenu').isHidden());
  const sw=await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);ck(t+': no sideways scroll',!sw);
  ck(t+': no page errors',errs.length===0,errs);
  if(pg==='strategy.html'){const src=await p.getAttribute('#deck','src');ck(t+': deck embedded',src.includes('/presentation/d/'+DECK+'/embed'),src);
   ck(t+': fallback link',(await p.getAttribute('#deckOpen','href')).includes(DECK));
   ck(t+': current page marked',await p.locator('#siteNavMenu a[aria-current="page"]').count()===1);
   const fr=await p.locator('.frame').boundingBox();ck(t+': deck fits width',fr.width<=vp.width&&Math.abs(fr.width/fr.height-16/9)<0.05,{w:Math.round(fr.width),h:Math.round(fr.height)});
   ck(t+': noindex',(await p.getAttribute('meta[name=robots]','content'))==='noindex');
   await p.locator('#backGlobe').click();await p.waitForTimeout(500);ck(t+': back to globe',/\/(index\.html)?$/.test(p.url()),p.url());}
  if(pg==='index.html'){await btn.click();await Promise.all([p.waitForURL('**/strategy.html'),p.locator('#siteNavMenu a[href="strategy.html"]').click()]);ck(t+': nav opens Strategy',/strategy\.html$/.test(p.url()));}
  await ctx.close();}}
console.log(out.join('\n'));console.log(fail?'FAIL '+fail:'PASS');await b.close();process.exit(fail?1:0);})();
