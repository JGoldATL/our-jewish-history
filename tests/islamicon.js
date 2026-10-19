// CEO 10/20: forced conversion other than to Christianity is drawn as the Islam icon (white, blue star | green, crescent and star); Christianity keeps the split diamond.
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
const fetch0=async u=>(await fetch(u)).text();
(async()=>{const br=await chromium.launch();const errs=[];const p=await br.newPage({viewport:{width:900,height:600}});p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'events.html');await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');document.body.appendChild(s);const f=rel=>{const g=communitySymbol(s,'converted',30,{conversionReligion:rel});return g.innerHTML};return {isl:f('Islam'),unk:f(undefined),chr:f('Christianity')}});
ck(r.isl.includes('#1F7A4A')&&r.isl.includes('#1D4FA0'),'Events: Islam icon has green half and blue star');ck(r.unk===r.isl.replace(/symClip\d+/g,'X')||(r.unk.includes('#1F7A4A')),'Events: unknown or other faith also draws the Islam icon');
ck(!r.isl.includes('#5A3B7A'),'Events: no purple diamond left for forced conversion to Islam');ck(r.chr.includes('#5A3B7A'),'Events: Christianity keeps its own split diamond');
const src=await (await fetch0(BASE+'movements.js'));const m={lab:(/purpleDiamond:'([^']*)'/.exec(src)||[])[1],svg:(/purpleDiamond:"(<svg.*?<\/svg>)"/.exec(src)||[])[1]||''};
ck(m.lab==='Forced conversion to Islam','Movements key label reads Forced conversion to Islam');ck(m.svg.includes('#1F7A4A')&&!m.svg.includes('#5A3B7A'),'Movements key icon is the Islam icon');
ck(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));console.log(bad?'FAILED '+bad:'ALL PASS');await br.close();process.exit(bad?1:0);})();
