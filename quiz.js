// "When in the World?" quiz. Reads data/history.json (sheet.questions, loaded from the master's Questions tab) and data/quiz-land.json.
// Round logic and screens follow handoffs/WebDev-Prompt-Quiz-Build-2026-10-06.txt. Nothing here invents content: every word of a question comes from the Sheet.
(function(){
'use strict';
const ERAS=['Biblical era','Second Temple & Rome','Medieval & Modern'];
const LETTERS='ABCDE';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
// Project rule: CE years are written as the bare year. A timeline that also holds BCE years keeps "CE" so the order stays clear.
const plainCE=s=>typeof s==='string'&&/\bCE\b/.test(s)&&!/\bBCE\b/.test(s)?s.replace(/\s+CE\b/g,''):s;
const fy=(y,keepCE)=>y<0?`${(-y).toLocaleString()} BCE`:keepCE?`${y} CE`:`${y}`;
const shuffle=a=>{a=a.slice();for(let k=a.length-1;k>0;k--){const j=Math.floor(Math.random()*(k+1));[a[k],a[j]]=[a[j],a[k]];}return a;};

let BANK=[],seen=new Set(),round=[],i=0,score=0,draftsShown=false;

// ---------- anonymous answer logging (v0.4.0) ----------
// One random id per page visit, held only in memory (no cookie, no storage). No names, emails or IP addresses are sent.
// Fire-and-forget: never awaited, every error swallowed, so a blocked or failing logger can never slow or break the quiz.
// Logs only on the live site (or with ?logtest=1, whose ids start "test-" so they can be deleted). Does nothing if LOG_URL is blank.
const LOG_URL='https://patient-sound-f420journeysquiz-log.jeffreyagold-bbd.workers.dev/';
const VISIT=(()=>{try{const a=new Uint8Array(10);crypto.getRandomValues(a);return [...a].map(x=>(x%36).toString(36)).join('')+Date.now().toString(36);}catch(e){return '';}})();
const LOG_TEST=/[?&]logtest=1\b/.test(location.search);
function logRow(o){
  try{
    if(!LOG_URL||!VISIT||draftsShown)return;
    if(!LOG_TEST&&location.hostname!=='jgoldatl.github.io')return;
    const body=JSON.stringify(Object.assign({visit_id:(LOG_TEST?'test-':'')+VISIT},o));
    fetch(LOG_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body,keepalive:true}).catch(()=>{});
  }catch(e){}
}

// ---------- data ----------
// Production rule: only Approved questions are dealt. Drafts can be tested with ?drafts=1, and a preview build whose questions are all still
// drafts shows them too (marked in the footer), so the preview is never an empty page. A public build never contains drafts at all.
function pickQuestions(all,meta,search){
  const approved=all.filter(q=>q.status==='approved');
  const flag=/[?&]drafts=1\b/.test(search||'');
  const preview=meta&&meta.mode==='preview';
  const useDrafts=flag||(preview&&approved.length===0);
  return {list:useDrafts?all:approved,drafts:useDrafts&&all.some(q=>q.status!=='approved')};
}

// ---------- round logic (locked) ----------
// One question per era, each a different Style, shown in order of Jewish year. No repeats across "Play 3 more" until an era's pool is used up, then that era resets.
function deal(){
  const eras=ERAS.filter(e=>BANK.some(q=>q.era===e));
  eras.forEach(e=>{if(!BANK.some(q=>q.era===e&&!seen.has(q.id)))BANK.filter(q=>q.era===e).forEach(q=>seen.delete(q.id));});
  let best=null;
  for(let t=0;t<200;t++){
    const pick=eras.map(e=>{const c=BANK.filter(q=>q.era===e&&!seen.has(q.id));return c[Math.floor(Math.random()*c.length)];});
    if(new Set(pick.map(q=>q.style)).size===pick.length){best=pick;break;}
    best=best||pick;
  }
  best.forEach(q=>seen.add(q.id));
  return best.sort((a,b)=>a.jewishYear-b.jewishYear);
}
function start(){round=deal();i=0;score=0;show();}
function dots(){$('dots').innerHTML=round.map((_,k)=>`<i class="${k<=i?'on':''}"></i>`).join('');$('count').textContent=i<round.length?`${i+1} of ${round.length}`:'';}

// ---------- question screen (locked) ----------
function show(){
  dots();
  const q=round[i],isOrder=q.correct==='order',right=isOrder?-1:LETTERS.indexOf(q.correct);
  fly([[q.lat,q.lon]]);
  const opts=isOrder?shuffle(q.choices.map((c,k)=>({c,k}))):q.choices.map((c,k)=>({c,k}));
  $('stage').innerHTML=`<div class="card">
    <div class="eyebrow">${esc(q.era)} · ${esc(q.style)} · <span class="place">${esc(q.place)}</span></div>
    <p class="qt">${esc(q.question)}</p>
    ${isOrder?'<p class="hint">Tap them from earliest to latest.</p>':''}
    <div class="choices">${opts.map((o,n)=>`<button type="button" class="choice" data-k="${o.k}"><span class="n">${isOrder?'':LETTERS[n]}</span><span>${esc(o.c)}</span></button>`).join('')}</div>
    <div id="res"></div></div>`;
  const btns=[...document.querySelectorAll('.choice')];
  if(!isOrder){
    btns.forEach(b=>b.onclick=()=>{
      const k=+b.dataset.k,ok=k===right;
      btns.forEach(x=>{x.disabled=true;if(+x.dataset.k===right)x.classList.add('right');});
      if(!ok)b.classList.add('wrong');
      finish(ok,k);
    });
  }else{
    const seq=[];
    btns.forEach(b=>b.onclick=()=>{
      if(b.classList.contains('picked'))return;
      seq.push(+b.dataset.k);b.classList.add('picked');b.querySelector('.n').textContent=seq.length;
      if(seq.length===q.choices.length){
        const ok=seq.every((k,n)=>k===n);
        btns.forEach(x=>{
          x.disabled=true;const k=+x.dataset.k;x.classList.remove('picked');x.querySelector('.n').textContent=k+1;
          const at=seq.indexOf(k);x.classList.add(at===k?'right':'wrong');
          if(at!==k){const y=document.createElement('span');y.className='yours';y.textContent=`You had #${at+1}`;x.appendChild(y);}
        });
        const box=document.querySelector('.choices');btns.sort((a,b)=>a.dataset.k-b.dataset.k).forEach(x=>box.appendChild(x));
        finish(ok,undefined,seq);
      }
    });
  }
  btns[0].focus({preventScroll:true});
}

function finish(ok,pick,seq){
  const q=round[i];if(ok)score++;
  logRow({kind:'answer',question_id:q.id,picked:seq?seq.join(','):String(pick)});
  const answer=q.correct==='order'?'':q.choices[LETTERS.indexOf(q.correct)];
  let v;
  if(ok)v='You got it.';
  else if(q.correct==='order')v='Not quite. Here’s the real order, earliest first.';
  else v=`Not quite. You picked “${esc(q.choices[pick])}.” The answer is “${esc(answer)}.”`;
  const last=i>=round.length-1;
  $('res').innerHTML=`<div class="result">
    <div class="verdict ${ok?'ok':'no'}">${v}</div>
    <p class="quick">${esc(q.quickTake)}${q.deepDive?' <button type="button" class="more" id="more" aria-expanded="false" aria-controls="deep">Dive deeper →</button>':''}</p>
    ${q.deepDive?`<p class="deep" id="deep" hidden>${esc(q.deepDive)}</p>`:''}
    <div class="row"><button type="button" class="btn" id="next">${last?'See your journey':'Next question'}</button></div></div>`;
  if(q.deepDive)$('more').onclick=()=>{$('deep').hidden=false;$('more').hidden=true;};
  $('next').onclick=()=>{i++;i<round.length?show():end();};
  $('next').focus({preventScroll:true});
}

// ---------- end screen (locked) ----------
function end(){
  dots();
  fly(round.map(q=>[q.lat,q.lon]));
  const span=round[round.length-1].jewishYear-round[0].jewishYear;
  let tl='';const cross=round.some(q=>q.jewishYear<0||q.worldYear<0);
  round.forEach((q,n)=>{
    if(n>0){const g=q.jewishYear-round[n-1].jewishYear;tl+=`<li class="gap">${g===0?'Same year…':`${g.toLocaleString()} years later…`}</li>`;}
    tl+=`<li><div class="yr">${fy(q.jewishYear,cross)}</div><div class="ev">${esc(q.jewishEvent)}</div><div class="mw">Meanwhile: ${esc(q.worldAnchor)}, ${fy(q.worldYear,cross)}</div></li>`;
  });
  $('stage').innerHTML=`<div class="card end">
    <h2>You just traveled ${span.toLocaleString()} years of Jewish history.</h2>
    <p class="score">${score} of ${round.length} right</p>
    <ul class="tl">${tl}</ul>
    <div class="survey"><p id="svq">Did comparing Jewish history with familiar world history help you understand when these events happened?</p>
      <div class="row" id="sv" role="group" aria-labelledby="svq">${['A lot','Somewhat','Not really'].map(a=>`<button type="button" class="pill" aria-pressed="false">${a}</button>`).join('')}</div></div>
    <div class="row"><button type="button" class="btn" id="again">Play 3 more</button><a class="btn ghost" href="index.html">Back to the globe</a></div></div>`;
  document.querySelectorAll('#sv .pill').forEach(p=>p.onclick=()=>{
    document.querySelectorAll('#sv .pill').forEach(x=>{x.classList.remove('sel');x.setAttribute('aria-pressed','false');});
    p.classList.add('sel');p.setAttribute('aria-pressed','true');
    logRow({kind:'survey',survey:p.textContent});
  });
  $('again').onclick=start;
  $('again').focus({preventScroll:true});
}

// ---------- small globe (locked) ----------
const G={rot:[-35,-30,0],dots:[],ok:false};
function initGlobe(land){
  if(typeof d3==='undefined'||typeof topojson==='undefined'||!land){$('globe').hidden=true;return;}
  G.ok=true;
  const cv=$('globe'),ctx=cv.getContext('2d'),cs=getComputedStyle(document.documentElement);
  const col=n=>cs.getPropertyValue(n).trim();
  G.land=topojson.feature(land,land.objects.land);
  G.proj=d3.geoOrthographic().scale(84).translate([88,88]).clipAngle(90);
  G.path=d3.geoPath(G.proj,ctx);
  G.draw=()=>{
    G.proj.rotate(G.rot);ctx.clearRect(0,0,176,176);
    ctx.beginPath();G.path({type:'Sphere'});ctx.fillStyle=col('--sea');ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=col('--rim');ctx.stroke();
    ctx.beginPath();G.path(d3.geoGraticule10());ctx.lineWidth=.5;ctx.strokeStyle=col('--line');ctx.stroke();
    ctx.beginPath();G.path(G.land);ctx.fillStyle=col('--land');ctx.fill();
    G.dots.forEach(p=>{const c=[p[1],p[0]];if(d3.geoDistance(c,[-G.rot[0],-G.rot[1]])<1.5){const [x,y]=G.proj(c);
      ctx.beginPath();ctx.arc(x,y,6,0,7);ctx.fillStyle=col('--gold');ctx.globalAlpha=.3;ctx.fill();ctx.globalAlpha=1;
      ctx.beginPath();ctx.arc(x,y,3.2,0,7);ctx.fill();}});
  };
  G.fly=pts=>{
    G.dots=pts;
    const lat=d3.mean(pts,p=>p[0]),lon=d3.mean(pts,p=>p[1]),to=[-lon,-lat*0.8,0],from=G.rot.slice(),it=d3.interpolate(from,to);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){G.rot=to;G.draw();return;}
    const t0=performance.now(),dur=1200;
    const step=now=>{const k=Math.min(1,(now-t0)/dur);G.rot=it(d3.easeCubicInOut(k));G.draw();if(k<1)requestAnimationFrame(step);};
    requestAnimationFrame(step);
  };
  G.draw();
}
const fly=pts=>{if(G.ok)G.fly(pts);};

// ---------- boot ----------
async function boot(){
  let hist,land=null;
  try{hist=await (await fetch('data/history.json')).json();}catch(_){hist=null;}
  try{land=await (await fetch('data/quiz-land.json')).json();}catch(_){land=null;}
  initGlobe(land);
  const all=((hist&&hist.sheet&&hist.sheet.questions)||[]).map(x=>JSON.parse(JSON.stringify(x,(k,v)=>plainCE(v))));
  const pick=pickQuestions(all,hist&&hist.sheet&&hist.sheet.meta,location.search);
  BANK=pick.list;draftsShown=pick.drafts;
  if(draftsShown)$('mode').textContent='Preview · draft questions included · ';
  if(!BANK.length){$('stage').innerHTML='<div class="card msg">The questions are not ready yet. Please check back soon.</div>';return;}
  start();
}
window.__quiz={pickQuestions,deal:()=>deal(),get bank(){return BANK;}};
boot();
})();
