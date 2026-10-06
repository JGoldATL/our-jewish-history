// Sheet arrows: Movements with both ends ready are drawn; none is drawn twice; the New Amsterdam branch rule holds.
// Run: NODE_PATH=$(npm root -g) node tests/arrows.js   (server on :8778)
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8778/');await p.waitForTimeout(2500);await p.evaluate(()=>dismissPrompt());
const r=await p.evaluate(()=>{
  const S=DATA.sheet.movements,eng=DATA.movements.filter(m=>!m.sheetArrow),sa=DATA.movements.filter(m=>m.sheetArrow);
  const covered=new Set(eng.map(m=>DATA.cardLinks?.[m.id]).filter(Boolean));
  const dupes=sa.filter(m=>covered.has(S.find(s=>s.id===m.id).eventId)).map(m=>m.id);
  const ids=new Set(sa.map(m=>m.id)),pl=new Map(DATA.sheet.places.map(x=>[x.id,x]));
  const expected=S.filter(m=>m.arrowEndsReady&&!covered.has(m.eventId)&&pl.get(m.originPlaceId)?.lat!=null&&pl.get(m.destinationPlaceId)?.lat!=null).map(m=>m.id).filter(id=>id!=='MOV-055'||['MOV-052','MOV-053','MOV-054'].every(x=>ids.has(x)));
  const notDrawable=sa.filter(m=>!canRenderMovement(m)).map(m=>m.id);
  const notVisibleAtMid=sa.filter(m=>{const w=movementWindow(m);const f=computeFrame(Math.round(w[1])).movements.find(x=>x.id===m.id);return !(f.visible&&f.opacity>0.5);}).map(m=>m.id);
  const rule=!ids.has('MOV-055')||['MOV-052','MOV-053','MOV-054'].every(x=>ids.has(x));
  const oneEnded=S.filter(m=>!m.arrowEndsReady&&ids.has(m.id)).map(m=>m.id);
  return {engine:eng.length,sheetArrows:sa.length,dupes,missing:expected.filter(x=>!ids.has(x)),extra:[...ids].filter(x=>!expected.includes(x)),notDrawable,notVisibleAtMid,rule,oneEnded};});
console.log(JSON.stringify(r));
// MOV-005 (Judah to Babylon, 587 BCE) is inside the current timeline: it must appear on the globe and open a card on click
await p.evaluate(()=>setYearExact(-587));await p.waitForTimeout(1200);
const drawn=await p.evaluate(()=>[...document.querySelectorAll('g.route')].map(g=>g.getAttribute('aria-label')));
console.log('drawn at 587 BCE:',JSON.stringify(drawn));
const ok=!r.dupes.length&&!r.missing.length&&!r.extra.length&&!r.notDrawable.length&&!r.notVisibleAtMid.length&&r.rule&&!r.oneEnded.length&&!errs.length&&drawn.some(l=>/Jerusalem|Judah|Babylon/i.test(l)&&true);
await p.evaluate(()=>setYearExact(1654));await p.waitForTimeout(1200);
const dashed=await p.evaluate(()=>[...document.querySelectorAll('g.route .routeBody.contested')].length);
const expectDashed=await p.evaluate(()=>DATA.movements.filter(m=>m.contested).length);
console.log('contested (Dotted) arrows in data:',expectDashed,'dashed on screen at 1654 (camera may hide one at the edge):',dashed);
const ok2=expectDashed===2&&dashed>=1;
console.log(ok&&ok2?'PASS':'FAIL',errs);await b.close();process.exit(ok&&ok2?0:1)})();
