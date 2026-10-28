// Seam check for F-149: renders the flat maps at set places and zooms, with the insets on and off, and checks the draw order.
// Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/seams.js   (headless Chromium only; screenshots go to tests/out/seams/)
// The same places open in a browser with ?view=lon,lat,degrees-across, e.g. archaeology.html?view=35.35,31.32,3 or movements.html?view=35.35,31.32,3
const {chromium}=require('playwright');const fs=require('fs');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
const PLACES=[['masada',35.35,31.32],['gezer',34.92,31.86],['dura-europos',40.73,34.75],['elephantine',32.89,24.08]],DEGS=[3,8,20];
fs.mkdirSync('tests/out/seams',{recursive:true});
(async()=>{const b=await chromium.launch();const errs=[];
for(const page of ['archaeology','movements']){
  for(const [nm,lon,lat] of PLACES){for(const deg of (page==='movements'?[34]:DEGS)){   // Movements never zooms in past 34 degrees across (MIN_DEG), so that is its closest view
    const c=await b.newContext({viewport:{width:1280,height:800}});const p=await c.newPage();p.on('pageerror',e=>errs.push(page+' '+nm+': '+e.message));
    await p.goto(`${BASE}${page}.html?view=${lon},${lat},${deg}`);await p.waitForTimeout(1800);
    const info=await p.evaluate(()=>{const ims=[...document.querySelectorAll('#map image')].map(i=>i.getAttribute('data-inset')||'base');const v=(window.ARC||window.MV).state().V;return {ims,v};});
    if(nm==='masada'&&(page==='movements'||deg===3))ck(Math.abs(info.v.lon-lon)<0.01&&Math.abs(info.v.lat-lat)<0.01&&Math.abs(info.v.degW-deg)<0.01,`${page}: ?view= opens at ${lon},${lat} and ${deg} degrees across`);
    if(page==='archaeology'&&info.ims.length>2)ck(info.ims.join('>')==='base>tier2-near-east>tier1-land-of-israel'||info.ims.indexOf('tier2-near-east')<info.ims.indexOf('tier1-land-of-israel'),`${nm} ${deg}: Tier 2 draws under Tier 1, both over the base (${info.ims.join('>')})`);
    await p.addStyleTag({content:'#card,#tbar,.keybtn,.hint,.zoom,.pin,.pinRing,.pinName,#panel{visibility:hidden!important}'});
    await p.locator('#map').screenshot({path:`tests/out/seams/${page}-${nm}-${deg}deg.png`});await c.close();}}}
ck(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));console.log(bad?'FAILED '+bad:'ALL PASS');await b.close();process.exit(bad?1:0);})();
