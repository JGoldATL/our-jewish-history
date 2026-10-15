// F-085 glass pill navigation. Flag off = nothing changes; ?nav=glass = the pill. Run: NODE_PATH=$(npm root -g) node tests/glassnav.js [outdir]
const {chromium}=require('playwright');const OUT=process.argv[2]||'tests/out';require('fs').mkdirSync(OUT,{recursive:true});
const BASE=process.env.SITE||'http://localhost:8778/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const sizes={desktop:{width:1280,height:800},ipad:{width:820,height:1180},phone:{width:390,height:844}};
for(const [sn,vp] of Object.entries(sizes)){
  const ctx=await b.newContext({viewport:vp,hasTouch:sn!=='desktop'});
  // flag off
  let p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'index.html');await p.waitForTimeout(1800);
  ok(await p.evaluate(()=>!document.querySelector('.gn')&&!document.documentElement.classList.contains('nav-glass')&&!!document.getElementById('quizLink')),sn+': flag off, old nav only');
  await p.close();
  for(const [pg,cur] of [['events.html','Events'],['movements.html','Movements'],['quiz.html','Quiz'],['roadmap.html',null],['feedback.html',null]]){
    p=await ctx.newPage();p.on('pageerror',e=>errs.push(pg+' '+e.message));
    await p.goto(BASE+pg+'?nav=glass');await p.waitForTimeout(pg==='quiz.html'||pg.startsWith('index')||pg.startsWith('movements')?2200:900);
    const r=await p.evaluate(()=>{const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e.closest('.gn-short,.gn-full,.gn-more')||e);return r.width>0&&s.display!=='none';};
      const pills=[...document.querySelectorAll('.gn .gp')].filter(vis);const sn=document.querySelector('.sn'),snr=sn&&sn.getBoundingClientRect();const sel=pills.map(x=>[...x.querySelectorAll('.gp-btn[aria-pressed="true"]')].map(b=>b.textContent));
      const th=pills.map(x=>{const t=x.querySelector('.gp-thumb'),on=x.querySelector('.gp-btn[aria-pressed="true"]');return on?Math.abs(t.offsetLeft-on.offsetLeft)<2&&Math.abs(t.offsetWidth-on.offsetWidth)<2:null;});
      const over=pills.map(x=>x.classList.contains('over'));const dots=[...document.querySelectorAll('.gn .gp-dots')].filter(vis).length;
      return {more:!!sn&&getComputedStyle(sn).display!=='none'&&snr.left<80&&snr.top>innerHeight/2&&/More/.test(sn.textContent),n:pills.length,sel,th,over,dots,old:!!document.querySelector('.sn')&&getComputedStyle(document.querySelector('.sn')).display!=='none',hs:document.documentElement.scrollWidth>innerWidth+1};});
    ok(r.n===1,`${sn} ${pg}: one page pill`);ok(r.more,`${sn} ${pg}: More (hamburger) sits bottom left`);
    ok(r.th.every(x=>x!==false),`${sn} ${pg}: thumb sits under the selected item`);
    if(cur)ok(JSON.stringify(r.sel[0])===JSON.stringify([cur]),`${sn} ${pg}: "${cur}" is on`);
    ok(!r.hs,`${sn} ${pg}: no sideways scroll`);
    ok(r.over.every(x=>!x)&&r.dots===0,`${sn} ${pg}: four pages fit, no arrow or dots`);
    if(pg==='events.html'||pg==='roadmap.html')await p.screenshot({path:`${OUT}/gn_${sn}_${pg.replace('.html','')}.png`});
    if(sn==='desktop'&&pg==='events.html'){
      // fade on map drag; none on pill tap
      await p.mouse.move(400,450);await p.mouse.down();await p.mouse.move(460,470,{steps:4});
      const f=await p.evaluate(()=>+getComputedStyle(document.querySelector('.gn .gp')).opacity);await p.waitForTimeout(500);
      const f2=await p.evaluate(()=>+getComputedStyle(document.querySelector('.gn .gp')).opacity);await p.mouse.up();await p.waitForTimeout(900);
      const f3=await p.evaluate(()=>+getComputedStyle(document.querySelector('.gn .gp')).opacity);
      ok(f2<.3&&f3>.95,`fades to 25% while dragging the map (${f2.toFixed(2)}) and returns after release (${f3.toFixed(2)})`);
      const bx=await p.evaluate(()=>{const r=document.querySelector('.gn .gp-btn:nth-child(3)').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]});
      await p.mouse.move(bx[0],bx[1]);await p.mouse.down();await p.waitForTimeout(450);
      const g=await p.evaluate(()=>+getComputedStyle(document.querySelector('.gn .gp')).opacity);
      await p.mouse.move(bx[0],bx[1]-120);await p.mouse.up();ok(g>.95,'pressing a pill does not fade it');
      // More menu
      await p.waitForTimeout(1200);
      await p.evaluate(()=>document.querySelector('.sn-btn').click());
      const mv=await p.evaluate(()=>[...document.querySelectorAll('.sn-menu a')].map(a=>a.textContent.replace(/\d+\/\d+$/,'')));
      ok(JSON.stringify(mv)===JSON.stringify(['Roadmap','Strategy','Feedback','Sources']),'More holds Roadmap, Strategy, Feedback, Sources');
      await p.screenshot({path:`${OUT}/gn_desktop_more.png`});
      // Sources opens the dialog from the More menu
      await p.evaluate(()=>document.querySelector('.sn-menu a[data-sources]').click());await p.waitForTimeout(300);
      ok(await p.evaluate(()=>!document.getElementById('sourcesDlg').hidden),'Sources in More opens the Sources dialog');
    }
    await p.close();}
  console.log(sn,'page errors:',errs.length?errs:'none');if(errs.length)fails++;await ctx.close();}
// reduced transparency / motion CSS present
const c=await b.newContext({viewport:sizes.desktop,reducedMotion:'reduce'});const p=await c.newPage();await p.goto(BASE+'index.html?nav=glass');await p.waitForTimeout(1800);
ok(await p.evaluate(()=>{const s=[...document.styleSheets].map(x=>{try{return [...x.cssRules].map(r=>r.cssText).join('')}catch(e){return ''}}).join('');return /prefers-reduced-transparency/.test(s)&&/rgba\(18, 27, 46, 0\.9[46]\)/.test(s)&&getComputedStyle(document.querySelector('.gp-thumb')).transitionDuration==='0s'}),'solid fallback rules present; reduced motion removes the slide');
console.log(fails?fails+' FAILED':'ALL PASS');await b.close();process.exit(fails?1:0);})();
