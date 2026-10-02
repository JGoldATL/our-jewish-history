const {chromium,devices}=require('playwright');const S=process.argv[2]||'tests/out';require('fs').mkdirSync(S+'/reg',{recursive:true});(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const devs=[['iphone',devices['iPhone 13']],['iphoneSE',devices['iPhone SE']],['ipadP',devices['iPad (gen 7)']],['ipadL',devices['iPad (gen 7) landscape']],['desk',{viewport:{width:1440,height:900}}]];
for(const [n,d] of devs){const c=await b.newContext({...d});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(''+(process.env.SITE||'http://localhost:8778/')+'');await p.waitForTimeout(2200);
await p.screenshot({path:`${S}/reg/L-${n}-open.png`});
const tap=async s=>d.hasTouch?p.locator(s).tap():p.locator(s).click();
await tap('#introExplore');await p.waitForTimeout(300);await tap('#next');await tap('#next');await tap('#next');await p.waitForTimeout(500);
const r=await p.evaluate(()=>{const st=$('story').getBoundingClientRect(),t=$('storyTitle').getBoundingClientRect(),pl=$('play').getBoundingClientRect(),rs=$('reset').getBoundingClientRect();
 return {pageScrolls:document.documentElement.scrollHeight>innerHeight+2,titleVisible:t.top>=0&&t.bottom<=innerHeight,titleTop:Math.round(t.top),vh:innerHeight,title:$('storyTitle').textContent,
 playVisible:pl.top>=0&&pl.bottom<=innerHeight,resetVisible:rs.top>=0&&rs.bottom<=innerHeight,panelScrollable:$('panel').scrollHeight>$('panel').clientHeight,horiz:document.documentElement.scrollWidth>innerWidth,
 gone:[!!document.getElementById('zoomIn'),!!document.getElementById('chipBox'),!!document.getElementById('milestoneSelect')]}});
await p.screenshot({path:`${S}/reg/L-${n}-card.png`});
await tap('#reset');await p.waitForTimeout(300);
console.log(n,JSON.stringify(r),errs);await c.close();}
await b.close();})();
