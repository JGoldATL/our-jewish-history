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
// Year labels: bare years for the Common Era (1654), BCE kept on BCE years, never a thousands comma (2000 BCE).
const fy=y=>y<0?`${-y} BCE`:`${y}`;
const shuffle=a=>{a=a.slice();for(let k=a.length-1;k>0;k--){const j=Math.floor(Math.random()*(k+1));[a[k],a[j]]=[a[j],a[k]];}return a;};

let BANK=[],seen=new Set(),round=[],i=0,score=0,draftsShown=false;
// v0.4.0 tone: 'default' is the funnier voice, 'academic' is plain. In memory only, so every page load (and every friend's link) opens in Default.
let tone='default',lastW=null,results=[];

// ---------- approved line bank (Voice Guide section 10, approved by the CEO Oct 7, 2026) ----------
// The site only ever picks from these lines; none are written on the fly. S2 and S3 were cut. No emoji.
// Wrong-answer lines: tag is close (within 25 years), far (300 years or more) or any. {correct} and {guess} are year labels, {gap} is a number of years.
const W=[
 {id:'W1',tag:'far',t:'Off by {gap} years. It was {correct}, not {guess}. In ancient history, that is basically a rounding error.'},
 {id:'W2',tag:'close',t:'Close. It was {correct}. History would call that a near miss.'},
 {id:'W3',tag:'far',t:'It was {correct}. You were off by {gap} years. History is patient, and so is this quiz.'},
 {id:'W4',tag:'any',t:'It was {correct}. The timeline has seen worse guesses.'},
 {id:'W5',tag:'any',t:'Not quite. It was {correct}. The timeline is not offended.'},
 {id:'W6',tag:'any',t:'The blur strikes again. It was {correct}.'},
 {id:'W7',tag:'any',t:'It was {correct}. Confidence noted. Accuracy pending.'},
 {id:'W8',tag:'any',t:'Not this time. It was {correct}. The next question is a fresh start.'},
 {id:'W9',tag:'any',t:'It was {correct}, not {guess}. Now it is on your map.'},
 {id:'W10',tag:'any',t:'It was {correct}, not {guess}. Good news: you are now one of the few who know.'}
];
const CLOSE_MAX=25,FAR_MIN=300;
// Share lines (funnier tone only). S1 names an event, so it is used only when that question was in the round and answered correctly (Voice Guide 7g).
const S=[
 {id:'S1',event:'Q052',t:'539 BCE: a Persian king let the exiles go home. Ancient empires rarely did that, so write it down.'},
 {id:'S4',t:'{score} of 3 on When in the World? Beat that.'},
 {id:'S5',t:'{score} of 3 in about 90 seconds. Jewish history, placed in world time. Your turn.'},
 {id:'S6',only:'perfect',t:'3 of 3. I would like it noted that I did not use Google.'},
 {id:'S7',only:'zero',t:'I got 0 of 3. Nowhere to go but up. Your turn.'},
 {id:'S8',t:'{score} of 3. Not bad for someone who still mixes up centuries. Your turn.'},
 {id:'S9',t:'{score} of 3 on When in the World? I accept congratulations or competition. Your turn.'},
 {id:'S10',t:'Think you can place a Jewish event in world history? I got {score} of 3. Prove it.'}
];
// Academic share: the score and a neutral line, never an event (Voice Guide 7e). This neutral line is new wording and awaits the CEO's approval.
const ACADEMIC_SHARE='{score} of 3 on When in the World? Jewish history, placed in world time.';
const pickOne=a=>a[Math.floor(Math.random()*a.length)];
const fill=(t,o)=>t.replace(/\{(\w+)\}/g,(m,k)=>o[k]);

// ---------- anonymous answer logging (v0.4.0) ----------
// v0.6.0: each row carries one random id per page visit (kept in memory) plus an anonymous device id (random, saved in this browser's localStorage so a returning device can be recognised),
// and a few coarse details: language, time zone, screen size, device type and the referring site name. No names, emails or IP addresses are sent. The Worker adds country and region from Cloudflare and never stores the IP.
// Fire-and-forget: never awaited, every error swallowed, so a blocked or failing logger can never slow or break the quiz.
// Logs only on the live site (or with ?logtest=1, whose ids start "test-" so they can be deleted). Does nothing if LOG_URL is blank.
const LOG_URL='https://patient-sound-f420journeysquiz-log.jeffreyagold-bbd.workers.dev/';
const VISIT=(()=>{try{const a=new Uint8Array(10);crypto.getRandomValues(a);return [...a].map(x=>(x%36).toString(36)).join('')+Date.now().toString(36);}catch(e){return '';}})();
const DEVICE=(()=>{try{let d=localStorage.getItem('ojj-device');if(!/^[a-z0-9]{16,32}$/.test(d||'')){const a=new Uint8Array(16);crypto.getRandomValues(a);d=[...a].map(x=>(x%36).toString(36)).join('');localStorage.setItem('ojj-device',d);}return d;}catch(e){return '';}})();
const CTX=(()=>{const c={};try{if(DEVICE)c.device_id=DEVICE;}catch(e){}
  try{const l=(navigator.language||'').split('@')[0].slice(0,20);if(/^[A-Za-z0-9-]{2,20}$/.test(l))c.lang=l;}catch(e){}
  try{const z=Intl.DateTimeFormat().resolvedOptions().timeZone||'';if(/^[A-Za-z0-9_\/+-]{1,40}$/.test(z))c.tz=z;}catch(e){}
  try{const w=screen.width,h=screen.height;if(w>=100&&h>=100&&w<100000&&h<100000)c.screen=Math.round(w)+'x'+Math.round(h);const m=Math.min(w,h),coarse=matchMedia('(pointer:coarse)').matches;c.dev=coarse?(m<600?'phone':'tablet'):'desktop';}catch(e){}
  try{let r='';const u=(location.search.match(/[?&]utm_source=([A-Za-z0-9._-]{1,40})/)||[])[1];if(u)r=u.toLowerCase();else if(document.referrer){const hn=new URL(document.referrer).hostname.replace(/^www\./,'').toLowerCase();if(hn&&hn!==location.hostname)r=hn;}if(/^[a-z0-9._-]{1,60}$/.test(r))c.ref=r;}catch(e){}
  return c;})();
let ROUND='';   // v0.4.3: a new random tag for each round of 3, so answers and the survey tap can be grouped by round
function newRound(){try{const a=new Uint8Array(8);crypto.getRandomValues(a);ROUND=[...a].map(x=>(x%36).toString(36)).join('');}catch(e){ROUND='';}}
const LOG_TEST=/[?&]logtest=1\b/.test(location.search);
function logNote(t){try{let n=document.getElementById('logNote');if(!n){n=document.createElement('div');n.id='logNote';n.style.cssText='position:fixed;left:8px;bottom:8px;z-index:9;background:#222;color:#fff;font:12px system-ui;padding:6px 10px;border-radius:6px;max-width:90vw';document.body.appendChild(n);}n.textContent=t;}catch(e){}}
function logRow(o){
  try{
    if(!LOG_URL||!VISIT||draftsShown)return;
    if(!LOG_TEST&&location.hostname!=='jgoldatl.github.io')return;
    const body=JSON.stringify(Object.assign({visit_id:(LOG_TEST?'test-':'')+VISIT},CTX,ROUND?{round_id:ROUND}:{},o));
    const p=fetch(LOG_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body,keepalive:true});
    if(LOG_TEST)p.then(r=>logNote('log test: Worker replied '+r.status+(r.status===204?' (saved)':' (refused)'))).catch(e=>logNote('log test: could not reach the Worker ('+(e&&e.message||'blocked')+')'));
    else p.catch(()=>{});
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
function start(){newRound();round=deal();i=0;score=0;results=[];lastW=null;show();}

// ---------- start screen (v0.4.0, DORMANT since v0.4.1: not called at boot; Academic returns later) ----------
function intro(){
  dots();$('count').textContent='';
  $('stage').innerHTML=`<div class="card intro">
    <p class="qt">Place Jewish history in world time. Three questions.</p>
    <div class="tone" role="group" aria-label="Tone"><button type="button" class="seg" data-tone="default" aria-pressed="true">Default</button><button type="button" class="seg" data-tone="academic" aria-pressed="false">Academic</button></div>
    <div class="row"><button type="button" class="btn" id="startBtn">Start</button></div></div>`;
  tone='default';
  document.querySelectorAll('.tone .seg').forEach(b=>b.onclick=()=>{
    tone=b.dataset.tone;
    document.querySelectorAll('.tone .seg').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  });
  $('startBtn').onclick=start;$('startBtn').focus({preventScroll:true});
}
function dots(){$('dots').innerHTML=(round||[]).map((_,k)=>`<i class="${k<=i?'on':''}"></i>`).join('');$('count').textContent=i<round.length?`${i+1} of ${round.length}`:'';}

// ---------- question screen (locked) ----------
function show(){
  dots();$('backLink').hidden=false;
  const q=round[i],isOrder=q.correct==='order',right=isOrder?-1:LETTERS.indexOf(q.correct);
  fly([[q.lat,q.lon]]);
  const opts=isOrder?shuffle(q.choices.map((c,k)=>({c,k}))):q.choices.map((c,k)=>({c,k}));
  $('stage').innerHTML=`<div class="card">
    <div class="eyebrow">${esc(q.era)} · ${esc(q.style)} · <span class="place">${esc(q.place)}</span></div>
    <p class="qt">${esc(q.question)}</p>
    ${isOrder?'<p class="hint">Tap them from earliest to latest.</p>':''}
    <div class="choices">${opts.map((o,n)=>`<button type="button" class="choice" data-k="${o.k}"><span class="n">${isOrder?'':LETTERS[n]}</span><span>${esc(o.c)}</span></button>`).join('')}</div>
    <div class="row subrow" id="subrow"><button type="button" class="btn" id="submit" disabled>Submit</button></div>
    <div id="res"></div></div>`;
  const btns=[...document.querySelectorAll('.choice')];
  const sub=$('submit');
  if(!isOrder){
    // v0.4.1: a tap selects (and can be changed); Submit locks the answer in
    let pickK=null;
    btns.forEach(b=>b.onclick=()=>{
      pickK=+b.dataset.k;
      btns.forEach(x=>{const on=x===b;x.classList.toggle('sel',on);x.setAttribute('aria-pressed',String(on));});
      sub.disabled=false;
    });
    sub.onclick=()=>{
      if(pickK==null)return;
      const k=pickK,ok=k===right;
      $('subrow').remove();
      btns.forEach(x=>{x.disabled=true;x.classList.remove('sel');x.removeAttribute('aria-pressed');if(+x.dataset.k===right)x.classList.add('right');});
      if(!ok)btns.find(x=>+x.dataset.k===k).classList.add('wrong');
      finish(ok,k);
    };
  }else{
    const seq=[];
    btns.forEach(b=>b.onclick=()=>{
      if(b.classList.contains('picked')){
        // tap a placed item again to take it back out; the ones after it move up one place
        seq.splice(seq.indexOf(+b.dataset.k),1);b.classList.remove('picked');b.querySelector('.n').textContent='';
        seq.forEach((k,n)=>{btns.find(x=>+x.dataset.k===k).querySelector('.n').textContent=n+1;});
        sub.disabled=seq.length!==q.choices.length;
        return;
      }
      seq.push(+b.dataset.k);b.classList.add('picked');b.querySelector('.n').textContent=seq.length;
      sub.disabled=seq.length!==q.choices.length;
    });
    sub.onclick=()=>{
      if(seq.length===q.choices.length){
        $('subrow').remove();
        const ok=seq.every((k,n)=>k===n);
        btns.forEach(x=>{
          x.disabled=true;const k=+x.dataset.k;x.classList.remove('picked');x.querySelector('.n').textContent=k+1;
          const at=seq.indexOf(k);x.classList.add(at===k?'right':'wrong');
          if(at!==k){const y=document.createElement('span');y.className='yours';y.textContent=`You had #${at+1}`;x.appendChild(y);}
        });
        const box=document.querySelector('.choices');btns.sort((a,b)=>a.dataset.k-b.dataset.k).forEach(x=>box.appendChild(x));
        finish(ok,undefined,seq);
      }
    };
  }
  btns[0].focus({preventScroll:true});
}

// Picks a wrong-answer line by tag. A line is used only when every number it needs is known: {correct} needs the correct choice's year,
// {guess} and {gap} need the picked choice's year too (Sheet column "Choice years"). Returns null when no line can be built truthfully.
function wrongLine(q,pick){
  const cy=q.choiceYears,right=LETTERS.indexOf(q.correct);
  if(!cy||cy[right]==null)return null;
  const correct=cy[right],guess=pick!=null?cy[pick]:null,known=guess!=null;
  const gap=known?Math.abs(guess-correct):null;
  const tag=known?(gap<=CLOSE_MAX?'close':gap>=FAR_MIN?'far':'any'):'any';
  let pool=W.filter(w=>(w.tag===tag||w.tag==='any')&&(known||!/\{(guess|gap)\}/.test(w.t)));
  if(tag==='any')pool=pool.filter(w=>w.tag==='any');
  pool=pool.filter(w=>w.id!==lastW);
  if(!pool.length)return null;
  const w=pickOne(pool);lastW=w.id;
  return fill(w.t,{correct:fy(correct),guess:known?fy(guess):'',gap:known?gap.toLocaleString():''});
}

function finish(ok,pick,seq){
  const q=round[i];if(ok)score++;
  results[i]=ok;
  logRow({kind:'answer',question_id:q.id,picked:seq?seq.join(','):String(pick)});
  const answer=q.correct==='order'?'':q.choices[LETTERS.indexOf(q.correct)];
  let v,dateline='';
  if(ok)v='You got it.';
  else if(q.correct==='order')v='Not quite. Here’s the real order, earliest first.';
  else{
    const fun=tone==='default'?wrongLine(q,pick):null;
    v=fun?`${esc(fun)} The answer is “${esc(answer)}.”`:`Not quite. You picked “${esc(q.choices[pick])}.” The answer is “${esc(answer)}.”`;
    // Every wrong answer shows the right date. A tagged line carries it already; otherwise the Jewish event's date is shown under the verdict.
    if(!fun)dateline=`<p class="dateline">In Jewish history: ${esc(q.jewishEvent)}, ${fy(q.jewishYear)}.</p>`;
  }
  const last=i>=round.length-1;
  if(last)$('backLink').hidden=true;   // the Back to the globe pill is on screen, so the text link goes
  $('res').innerHTML=`<div class="result">
    <div class="verdict ${ok?'ok':'no'}">${v}</div>${dateline}
    <p class="quick">${esc(q.quickTake)}${q.deepDive?' <button type="button" class="more" id="more" aria-expanded="false" aria-controls="deep">Dive deeper →</button>':''}</p>
    ${q.deepDive?`<p class="deep" id="deep" hidden>${esc(q.deepDive)}</p>`:''}
    <div class="row"><button type="button" class="btn" id="next">${last?'See your journey':'Next question'}</button>${last?'<a class="btn" href="index.html">Back to the globe</a>':''}</div></div>`;
  if(q.deepDive)$('more').onclick=()=>{$('deep').hidden=false;$('more').hidden=true;};
  $('next').onclick=()=>{i++;i<round.length?show():end();};
  $('next').focus({preventScroll:true});
}

// ---------- end screen (locked) ----------
function end(){
  dots();$('backLink').hidden=true;
  fly(round.map(q=>[q.lat,q.lon]));
  const span=round[round.length-1].jewishYear-round[0].jewishYear;
  let tl='';
  round.forEach((q,n)=>{
    if(n>0){const g=q.jewishYear-round[n-1].jewishYear;tl+=`<li class="gap">${g===0?'Same year…':`${g.toLocaleString()} years later…`}</li>`;}
    tl+=`<li><div class="yr">${fy(q.jewishYear)}</div><div class="ev">${esc(q.jewishEvent)}</div><div class="mw">Meanwhile: ${esc(q.worldAnchor)}, ${fy(q.worldYear)}</div></li>`;
  });
  $('stage').innerHTML=`<div class="card end">
    <h2>You just traveled ${span.toLocaleString()} years of Jewish history.</h2>
    <p class="score">${score} of ${round.length} right</p>
    <div class="row share"><button type="button" class="btn ghost" id="share">Share your score</button><span id="shareMsg" class="sharemsg" role="status"></span></div>
    <ul class="tl">${tl}</ul>
    <div class="survey"><p id="svq">Did comparing Jewish history with familiar world history help you understand when these events happened?</p>
      <div class="row" id="sv" role="group" aria-labelledby="svq">${['A lot','Somewhat','Not really'].map(a=>`<button type="button" class="pill" aria-pressed="false">${a}</button>`).join('')}</div></div>
    <div class="row"><button type="button" class="btn" id="again">Play 3 more</button><a class="btn ghost" href="index.html">Back to the globe</a></div></div>`;
  document.querySelectorAll('#sv .pill').forEach(p=>p.onclick=()=>{
    document.querySelectorAll('#sv .pill').forEach(x=>{x.classList.remove('sel');x.setAttribute('aria-pressed','false');});
    p.classList.add('sel');p.setAttribute('aria-pressed','true');
    logRow({kind:'survey',survey:p.textContent});
  });
  $('share').onclick=doShare;
  $('again').onclick=start;
  $('again').focus({preventScroll:true});
}

// ---------- share (v0.4.0) ----------
// Default tone: one line from the approved bank. Academic: the score and a neutral line, never the event. The link is the bare quiz address
// (no query string), so a friend always opens in Default. The phone's own share screen is used where it exists; otherwise the text is copied.
function shareText(){
  const n=score,total=round.length,perfect=n===total,zero=n===0;
  if(tone==='academic')return fill(ACADEMIC_SHARE,{score:n});
  const hit=round.some((q,k)=>results[k]&&q.id==='Q052');
  const pool=S.filter(l=>(!l.event||(l.event==='Q052'&&hit))&&(!l.only||(l.only==='perfect'&&perfect)||(l.only==='zero'&&zero)));
  return fill(pickOne(pool).t,{score:n});
}
function quizLink(){try{const u=new URL(location.href);u.search='';u.hash='';return u.href;}catch(e){return location.href;}}
async function doShare(){
  const text=shareText(),url=quizLink(),msg=m=>{try{$('shareMsg').textContent=m;}catch(e){}};
  try{
    if(navigator.share){await navigator.share({text,url});return;}
  }catch(e){if(e&&e.name==='AbortError')return;}
  try{await navigator.clipboard.writeText(text+' '+url);msg('Copied. Paste it anywhere.');}
  catch(e){msg(text+' '+url);}
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
  // v0.4.1: the quiz pops up. The first question shows as soon as the page opens; no start screen, no tone toggle. Default tone only.
  // intro() (Default | Academic start screen) is kept dormant for the Academic return; call it here instead of start() to bring it back.
  start();
}
window.__quiz={pickQuestions,deal:()=>deal(),get bank(){return BANK;},get tone(){return tone;}};
boot();
})();
