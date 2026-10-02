// Play / Pause on touch devices, and the two icons: drawn shapes, same black, same height, no text characters.
const {chromium,devices}=require('playwright');const S=process.argv[2]||'tests/out';require('fs').mkdirSync(S+'/pause',{recursive:true});
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});let bad=0;
for(const d of ['iPhone 13','iPad (gen 7)','Desktop Chrome']){const c=await b.newContext({...devices[d]});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(''+(process.env.SITE||'http://localhost:8778/')+'');await p.waitForTimeout(2000);
const tap=async s=>d.startsWith('Desk')?p.locator(s).click():p.locator(s).tap();
const intro=await p.evaluate(()=>({glyph:/[▶Ⅱ⏸]/.test($('introPlay').textContent),svg:!!$('introPlay').querySelector('svg path')}));
const state=()=>p.evaluate(()=>{const btn=$('play'),i=$('playIco'),cs=getComputedStyle(i),bb=i.getBBox();return {label:$('playLbl').textContent,pressed:btn.getAttribute('aria-pressed'),fill:cs.fill,color:getComputedStyle(btn).color,h:+bb.height.toFixed(2),glyph:/[▶Ⅱ⏸]/.test(btn.textContent),running:tour!=null};});
await tap('#introPlay');await p.waitForTimeout(1500);const playing=await state();await p.locator('#play').screenshot({path:`${S}/pause/${d.split(' ')[0]}-pause-icon.png`});
await tap('#play');await p.waitForTimeout(500);const y1=await p.evaluate(()=>currentYear());await p.waitForTimeout(1000);const y2=await p.evaluate(()=>currentYear());const paused=await state();await p.locator('#play').screenshot({path:`${S}/pause/${d.split(' ')[0]}-play-icon.png`});
const same=playing.fill===paused.fill&&playing.fill===playing.color&&paused.fill===paused.color&&playing.h===paused.h;
const ok=playing.label==='Pause'&&playing.running&&paused.label==='Play'&&!paused.running&&y1===y2&&same&&!playing.glyph&&!paused.glyph&&!intro.glyph&&intro.svg&&!errs.length;if(!ok)bad++;
console.log(d,JSON.stringify({intro,playing,paused}),'stopped:',y1===y2,'icons match:',same,errs.length?errs:'',ok?'PASS':'FAIL');await c.close();}
await b.close();process.exit(bad?1:0);})();
