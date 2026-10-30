/* Quiz prompt after three cards (F-035, CEO spec 2026-10-29).
   After a person opens 3 DIFFERENT cards by tap, swipe, arrow or dot in one visit, a small dismissible card offers one random question from the approved quiz bank.
   Autoplay, the Play button and a friend's link do not count (the pages only call cardOpened for a person's own action).
   Rules: at most once per visit; after a dismissal it stays away on that device for 24 hours; never while a swipe, drag, scroll or animation is in progress.
   The question and the wording of the answer come from quizcore.js, the same code the quiz uses. Nothing here identifies a person.
   Storage (sessionStorage for the visit, localStorage for the 24 hours) is wrapped in try/catch; if it fails the prompt shows at most once per page load.

   Pages: OJJQuizPrompt.init({kind:'events', busy:function(){return true while something is moving or covering the cards;}});
          OJJQuizPrompt.cardOpened(uniqueCardId);   // call on a person's own card open only */
(function(){
'use strict';
var K_CARDS='ojj-qp-cards',K_SHOWN='ojj-qp-shown',K_UNTIL='ojj-qp-until';
var NEED=3,QUIET=900,GIVEUP=20000,DAY=24*3600*1000;
/* ?qp=reset on any card page clears this visit's count and the 24-hour quiet period on this device, so the pop-up can be tried again page by page */
try{if(/[?&]qp=reset\b/.test(location.search)){sessionStorage.removeItem('ojj-qp-cards');sessionStorage.removeItem('ojj-qp-shown');localStorage.removeItem('ojj-qp-until');}}catch(e){}
var cfg={kind:'card',busy:null},mem={cards:[],shown:false,until:0},armed=false,open=false,bank=null,last=0,pressed=false;
function now(){return Date.now();}
function sget(k){try{return sessionStorage.getItem(k);}catch(e){return null;}}
function sset(k,v){try{sessionStorage.setItem(k,v);return true;}catch(e){return false;}}
function lget(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lset(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}
function cards(){var s=sget(K_CARDS);if(s!=null){try{var a=JSON.parse(s);if(Array.isArray(a))return a;}catch(e){}}return mem.cards;}
function saveCards(a){mem.cards=a;sset(K_CARDS,JSON.stringify(a));}
function wasShown(){return mem.shown||sget(K_SHOWN)==='1';}
function markShown(){mem.shown=true;sset(K_SHOWN,'1');}
function awayUntil(){var n=parseInt(lget(K_UNTIL)||'0',10);return Math.max(mem.until,isFinite(n)?n:0);}
function eligible(){return !open&&!wasShown()&&now()>=awayUntil();}
function track(name,extra){try{if(typeof window.gtag==='function'){var p={page_kind:cfg.kind};for(var k in (extra||{}))p[k]=extra[k];window.gtag('event',name,p);}}catch(e){}}

/* quiet means: no finger down, and nothing touched, dragged, scrolled or typed for a moment */
function mark(){last=now();}
['pointermove','touchmove','wheel','keydown'].forEach(function(t){document.addEventListener(t,function(e){if(t==='pointermove'&&!pressed)return;mark();},{capture:true,passive:true});});
document.addEventListener('scroll',mark,{capture:true,passive:true});
['pointerdown','touchstart'].forEach(function(t){document.addEventListener(t,function(){pressed=true;mark();},{capture:true,passive:true});});
['pointerup','pointercancel','touchend','touchcancel','click'].forEach(function(t){document.addEventListener(t,function(){pressed=false;mark();},{capture:true,passive:true});});
function quiet(){if(pressed&&now()-last>1500)pressed=false;   /* a lost touchend (finger lifted off the page, a card re-drawn under it) must not hold the pop-up back forever */
  return !pressed&&now()-last>=QUIET;}
function pageBusy(){try{return !!(cfg.busy&&cfg.busy());}catch(e){return false;}}

/* the bank: approved, one-tap questions, loaded once when it is first needed */
function getBank(){
  if(bank)return bank;
  bank=fetch('data/history.json',{credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error('bank');return r.json();}).then(function(h){
    var s=h&&h.sheet,all=(s&&s.questions)||[];var list=window.OJJQuiz.pickQuestions(all,s&&s.meta,location.search).list;
    return list.filter(function(q){return q.status==='approved'||/[?&]drafts=1\b/.test(location.search);}).filter(window.OJJQuiz.oneTap);   // approved only, even on a preview build
  }).catch(function(){bank=null;return [];});   // a failed load is tried again next time
  return bank;
}

var CSS='.ojjqp{position:fixed;left:12px;right:12px;top:var(--qp-top,150px);z-index:46;max-width:440px;margin:0 auto;box-sizing:border-box;padding:10px 14px 12px;border-radius:16px;background:rgba(14,24,34,.97);color:var(--text,#EFE6D3);border:1px solid var(--line,rgba(239,230,211,.28));box-shadow:0 10px 30px rgba(0,0,0,.5);font-family:var(--sans,Arial,sans-serif);font-size:14px;line-height:1.35;max-height:calc(100vh - var(--qp-top,150px) - 12px);overflow:auto}'
+'.ojjqp[hidden]{display:none}'
+'.ojjqp .qph{display:flex;align-items:flex-start;gap:8px;margin:0 0 2px}'
+'.ojjqp .qpe{flex:1 1 auto;margin:0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--amber,#E8B27A);padding-top:4px}'
+'.ojjqp .qpx{flex:none;width:44px;height:44px;margin:-6px -8px 0 0;border:0;background:none;color:var(--text,#EFE6D3);font-size:24px;line-height:1;cursor:pointer;border-radius:50%}'
+'.ojjqp .qpx:hover{background:rgba(239,230,211,.12)}'
+'.ojjqp .qpq{margin:0 0 8px;font-weight:600}'
+'.ojjqp .qpc{display:flex;flex-direction:column;gap:6px}'
+'.ojjqp .qpc button{min-height:44px;text-align:left;padding:6px 12px;border-radius:12px;border:1px solid var(--line,rgba(239,230,211,.28));background:rgba(239,230,211,.06);color:inherit;font:inherit;cursor:pointer;display:flex;gap:10px;align-items:baseline}'
+'.ojjqp .qpc button:hover:not(:disabled){background:rgba(239,230,211,.14)}'
+'.ojjqp .qpc button:disabled{cursor:default}'
+'.ojjqp .qpc .l{font-weight:700;color:var(--amber,#E8B27A)}'
+'.ojjqp .qpc .right{border-color:#6fbf8b;background:rgba(111,191,139,.18)}'
+'.ojjqp .qpc .wrong{border-color:#e07b6e;background:rgba(224,123,110,.16)}'
+'.ojjqp .qpr{margin-top:8px}.ojjqp .qpr:empty{display:none}'
+'.ojjqp .qpv{font-weight:700;margin:0 0 4px}.ojjqp .qpd,.ojjqp .qpt{margin:0 0 6px}.ojjqp .qpd{color:var(--soft,#D2CABB)}'
+'.ojjqp .qpgo{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:999px;background:var(--amber,#E8B27A);color:#0E1822;font-weight:700;text-decoration:none;margin-top:4px}'
+'.ojjqp :focus-visible{outline:3px solid var(--amber,#E8B27A);outline-offset:2px}'
/* wide screens: the bottom-left corner, over the map and away from the card panel, its pager and the Share button */
+'@media (min-width:900px){.ojjqp{top:auto;left:24px;right:auto;bottom:calc(24px + env(safe-area-inset-bottom,0px));width:360px;margin:0;max-height:calc(100vh - 48px)}}';
function style(){if(document.getElementById('ojjqpCss'))return;var s=document.createElement('style');s.id='ojjqpCss';s.textContent=CSS;document.head.appendChild(s);}
function el(tag,cls,txt,parent){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;if(parent)parent.appendChild(e);return e;}

function show(q){
  style();open=true;markShown();
  var box=el('div','ojjqp');box.setAttribute('role','dialog');box.setAttribute('aria-modal','false');box.setAttribute('aria-label','A quick question from the quiz');
  var h=el('div','qph',null,box);el('p','qpe','Quick question',h);
  var x=el('button','qpx','×',h);x.type='button';x.setAttribute('aria-label','Close this question');
  el('p','qpq',q.question,box);
  var ch=el('div','qpc',null,box),res=el('div','qpr',null,box);res.setAttribute('aria-live','polite');
  var answered=false,L=window.OJJQuiz.LETTERS,right=L.indexOf(q.correct);
  function close(byDismiss){
    if(!box.parentNode)return;box.parentNode.removeChild(box);open=false;
    if(byDismiss&&!answered){var u=now()+DAY;mem.until=u;lset(K_UNTIL,String(u));track('quiz_prompt_dismissed',{question_id:q.id});}   // 24 hours, only when closed without answering
  }
  x.onclick=function(){close(true);};
  box.addEventListener('keydown',function(e){if(e.key==='Escape'){e.stopPropagation();close(true);}});
  var btns=q.choices.map(function(c,k){var b=el('button',null,null,ch);b.type='button';el('span','l',L[k],b);el('span',null,c,b);
    b.onclick=function(){if(answered)return;answered=true;var ok=k===right;
      btns.forEach(function(y,n){y.disabled=true;if(n===right)y.classList.add('right');});if(!ok)b.classList.add('wrong');
      var v=window.OJJQuiz.verdict(q,ok,k);
      el('p','qpv',v.text,res);if(v.date)el('p','qpd',v.date,res);if(q.quickTake)el('p','qpt',q.quickTake,res);
      var a=el('a','qpgo','Play the full quiz',res);a.href='quiz.html';a.addEventListener('click',function(){track('quiz_prompt_tapped_through',{question_id:q.id});});
      track('quiz_prompt_answered',{question_id:q.id,result:ok?'right':'wrong'});};
    return b;});
  document.body.appendChild(box);
  track('quiz_prompt_shown',{question_id:q.id});
}

function tick(t0){
  armed=true;
  if(!eligible()||now()-t0>GIVEUP){armed=false;return;}
  if(!quiet()||pageBusy()){setTimeout(function(){tick(t0);},400);return;}
  getBank().then(function(list){
    if(!eligible()){armed=false;return;}
    if(!list.length){armed=false;return;}                       // nothing approved to ask: stay quiet, and do not use up the one chance
    if(!quiet()||pageBusy()){setTimeout(function(){tick(t0);},400);return;}
    armed=false;show(list[Math.floor(Math.random()*list.length)]);
  });
}

/* ?qp=debug on any card page shows a small line at the bottom of the screen: which build of this file is running, how many cards are counted, and why the pop-up is or is not waiting. For testing on a phone. */
var BUILD='qp-2026-10-30b';
function debugBadge(){
  if(!/[?&]qp=debug\b/.test(location.search)||document.getElementById('ojjqpDbg'))return;
  var d=document.createElement('div');d.id='ojjqpDbg';d.style.cssText='position:fixed;left:6px;right:6px;bottom:2px;z-index:60;font:10px/1.3 monospace;color:#EFE6D3;background:rgba(0,0,0,.7);padding:3px 6px;border-radius:6px;pointer-events:none;white-space:pre-wrap';
  document.body.appendChild(d);
  setInterval(function(){var a=cards(),u=awayUntil();
    d.textContent=BUILD+' | cards '+a.length+'/'+NEED+' | '+(wasShown()?'already shown this visit':'not shown yet')+' | '+(now()<u?'resting '+Math.round((u-now())/3600000)+' h':'not resting')+' | '+(armed?'waiting':'idle')+' | '+(pressed?'finger down':'no finger')+' | '+(quiet()?'quiet':'moving')+' | '+(pageBusy()?'page busy':'page free')+' | bank '+(bank?'loaded/loading':'not loaded');},400);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',debugBadge);else debugBadge();
window.OJJQuizPrompt={
  init:function(o){cfg.kind=(o&&o.kind)||cfg.kind;cfg.busy=(o&&o.busy)||null;if(o&&o.phoneTop)try{document.documentElement.style.setProperty('--qp-top',o.phoneTop+'px');}catch(e){}},
  cardOpened:function(id){
    if(id==null||id==='')return;id=String(id);
    var a=cards();if(a.indexOf(id)<0){a=a.concat([id]).slice(-50);saveCards(a);}
    if(a.length>=2&&!bank)getBank();                            // warm the bank before it is needed
    if(a.length>=NEED&&eligible()&&!armed)tick(now());
  }
};
})();
