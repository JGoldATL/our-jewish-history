/* The History of JewHate. Index page: family tabs plus a focus carousel. Entry page: the record for one entry.
   Everything shown comes from data/jewhate.json (written by tools/sheet-to-jewhate.py). Tabs, counts, cards and chips are computed here, never typed.
   Only LOCKED entries show; LEANING entries show only with ?drafts=1 and carry a Draft tag. */
(function(){
  /* F-103 (Thank Jews): the same script runs the "Thank Jews" pages. A page sets window.OJJ_CARDS before this file loads; without it everything below is the JewHate page, unchanged. */
  var CFG=window.OJJ_CARDS||null,TJ=!!CFG;
  var KIND=TJ?CFG.kind:'jewhate',DATA=TJ?CFG.data:'data/jewhate.json',ENTRY=TJ?CFG.entry:'jewhate-entry.html',INDEX=TJ?CFG.index:'jewhate.html',SHARE_TITLE=TJ?CFG.shareTitle:'The History of JewHate',TABKEY=TJ?'tj-tab':'jh-tab';
  var DRAFTS=/[?&]drafts=1\b/.test(location.search),Q=DRAFTS?'?drafts=1':'';
  var reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  function $(s,r){return (r||document).querySelector(s);}
  if(window.OJJQuizPrompt)OJJQuizPrompt.init({kind:KIND});   // F-035: the quiz pop-up after three cards
  function el(tag,cls,txt,parent){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;if(parent)parent.appendChild(e);return e;}
  function yearText(e){if(e.year==null)return null;var y=e.year<0?Math.abs(e.year)+' BCE':String(e.year);return (e.approx?'c. ':'')+y;}   // BCE kept, CE years are bare
  function label(e){return e.shortLabel||e.title;}   // Dataset's Short label when present; the Sheet Title until then
  function load(cb){
    fetch(DATA,{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(d){
      if(!TJ)(function(){var m=(d.source||'').match(/v\d+(?:\.\d+)+/),el=document.getElementById('siteVer');window.SITE_DATA_VERSION=m?m[0]:'unknown';if(el)el.textContent='v'+(window.SITE_VERSION||'')+'; data '+window.SITE_DATA_VERSION;})();   /* footer reads "version; data version" on every page */
      var list=d.entries.filter(function(e){return e.status==='LOCKED'||(DRAFTS&&e.status==='LEANING');});
      cb(list,d);
    }).catch(function(){var m=$('#msg');if(m){m.hidden=false;m.textContent='The entries could not be loaded. Please try again.';}});
  }
  function tabsFor(list){
    var by={};list.forEach(function(e){var f=e.family||'Other';(by[f]=by[f]||[]).push(e);});
    var multi=[],other=[];
    Object.keys(by).forEach(function(f){(by[f].length>=2?multi:other).push(f);});
    multi.sort(function(a,b){return by[b].length-by[a].length||by[a][0].order-by[b][0].order;});
    var tabs=[{key:'all',name:'All',items:list}].concat(multi.map(function(f){return {key:f,name:f,items:by[f]};}));
    if(other.length){var o=[];other.forEach(function(f){o=o.concat(by[f]);});o.sort(function(a,b){return a.order-b.order;});tabs.push({key:'__other',name:'Other',items:o});}
    return tabs;
  }

  /* ---------- index page ---------- */
  function index(list){
    var tabs=tabsFor(list),cur=0,idx=0,cards=[];
    var tabBar=$('#tabs'),track=$('#track');
    var pg=OJJPager.mount($('#pager'),{label:'entry',onStep:function(d){go(idx+d);},onGo:function(k){go(k);}});   // shared pager (F-147): arrows, dots, "N of M"; no wrap-around
    try{var s=JSON.parse(sessionStorage.getItem(TABKEY)||'null');if(s&&tabs[s.t]){cur=s.t;}}catch(e){}
    tabs.forEach(function(t,i){
      var b=el('button','tab',null,tabBar);b.type='button';b.setAttribute('role','tab');b.id='tab'+i;b.setAttribute('aria-controls','track');
      b.appendChild(document.createTextNode(t.name+' '));el('span','n',String(t.items.length),b);
      b.addEventListener('click',function(){pick(i,true);});
      b.addEventListener('keydown',function(ev){var d=ev.key==='ArrowRight'?1:ev.key==='ArrowLeft'?-1:0;if(!d)return;ev.preventDefault();ev.stopPropagation();var n=(i+d+tabs.length)%tabs.length;pick(n,true);$('#tab'+n).focus();});
    });
    function renderTabs(){[].forEach.call(tabBar.children,function(b,i){b.setAttribute('aria-selected',String(i===cur));b.tabIndex=i===cur?0:-1;});}
    function card(e,n,m){
      var c=el('article','card');c.setAttribute('role','group');c.setAttribute('aria-roledescription','slide');c.setAttribute('aria-label',(n+1)+' of '+m+': '+label(e));
      var fr=el('div','frow',null,c);var f=el('div','fam',e.family||'',fr);if(e.status!=='LOCKED')el('span','draft','Draft, not signed off',f);OJJShare.attach(fr,{kind:KIND,label:false,title:label(e)+' | '+SHARE_TITLE,url:ENTRY+'?id='+encodeURIComponent(e.id)});
      el('h2',null,label(e),c);
      if(TJ){el('p','sum',e.summary,c);if(CFG.showWhy&&e.why)el('p','why',e.why,c);}   // Thank Jews card: family, headline, plain summary with no label (Jeffrey 2026-10-30); the handoff's "why it matters" line is one switch (CFG.showWhy)
      else{var lie=el('div','lie',null,c);el('span','lb','The lie',lie);el('p',null,e.lie||e.title,lie);}
      var foot=el('div','cfoot',null,c);
      var a=el('a','read','Deep dive',foot);a.href=ENTRY+'?id='+encodeURIComponent(e.id)+(DRAFTS?'&drafts=1':'');
      return c;
    }
    var pickedAt=0,qpT=0;
    /* F-035: a card counts for the quiz pop-up once it has come to rest after the person moved to it (swipe, arrow, dot, key), not while it is still sliding and not when a tab sets the starting card */
    function settle(){clearTimeout(qpT);qpT=setTimeout(function(){var it=tabs[cur]&&tabs[cur].items[idx];if(it&&window.OJJQuizPrompt)try{OJJQuizPrompt.cardOpened(it.id);}catch(e){}},450);}
    function pick(i,reset){
      pickedAt=Date.now();cur=i;renderTabs();var items=tabs[i].items;track.replaceChildren();cards=items.map(function(e,n){var c=card(e,n,items.length);track.appendChild(c);return c;});
      track.setAttribute('aria-labelledby','tab'+i);
      try{sessionStorage.setItem(TABKEY,JSON.stringify({t:i}));}catch(e){}
      idx=Math.floor(items.length/2);mark();var c0=cards[idx];if(c0)track.scrollLeft=c0.offsetLeft-(track.clientWidth-c0.clientWidth)/2;
    }
    function mark(){
      var n=cards.length;cards.forEach(function(c,i){var on=i===idx;c.classList.toggle('cur',on);if(on)c.removeAttribute('inert');else c.setAttribute('inert','');});
      var items=tabs[cur].items;pg.update({count:n,index:idx,title:items[idx]?label(items[idx]):'',names:items.map(label)});
    }
    function go(i){i=Math.max(0,Math.min(cards.length-1,i));var c=cards[i];if(!c)return;var moved=i!==idx;idx=i;mark();if(moved)settle();
      var left=c.offsetLeft-(track.clientWidth-c.clientWidth)/2;track.scrollTo({left:left,behavior:reduce?'auto':'smooth'});}
    var raf=0;
    track.addEventListener('scroll',function(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;
      var mid=track.scrollLeft+track.clientWidth/2,best=0,bd=1e9;cards.forEach(function(c,i){var d=Math.abs(c.offsetLeft+c.clientWidth/2-mid);if(d<bd){bd=d;best=i;}});
      if(best!==idx){idx=best;mark();if(Date.now()-pickedAt>700)settle();}});});
    document.addEventListener('keydown',function(ev){
      if(ev.altKey||ev.ctrlKey||ev.metaKey)return;var t=ev.target;if(t&&(t.closest&&t.closest('[role=tablist]')))return;
      if(ev.key==='ArrowRight'){ev.preventDefault();go(idx+1);}else if(ev.key==='ArrowLeft'){ev.preventDefault();go(idx-1);}});
    window.addEventListener('resize',function(){go(idx);});
    pick(cur,false);
  }

  /* ---------- entry page ---------- */
  /* Thank Jews entry page: family and Share, headline, plain summary, the story (deep dive), who, when and where, the source. No Category, no "why it matters" (Jeffrey 2026-10-30). */
  function entryTJ(e,root){
    var head=el('div','ehead',null,root),fr=el('div','frow',null,head);el('span','fam',e.family||'',fr);
    OJJShare.attach(fr,{kind:KIND,label:false,title:label(e)+' | '+SHARE_TITLE,url:location.href});
    el('h1',null,label(e),head);
    el('p','sum',e.summary,head);
    var cols=el('div','cols',null,root),main=el('div','main',null,cols),aside=el('div','aside',null,cols);
    var s=el('section','sec',null,main);el('h2',null,'The story',s);el('p',null,e.deepDive,s);
    var rows=[['Who',e.originator],['When',yearText(e)],['Where',e.origin]].filter(function(r){return r[1];});
    var s2=el('section','sec',null,main);el('h2',null,'The details',s2);var dl=el('dl','facts',null,s2);rows.forEach(function(r){el('dt',null,r[0],dl);el('dd',null,r[1],dl);});
    if(e.field){var tg=el('p','tag',null,s2);tg.appendChild(document.createTextNode('Field: '+e.field));}
    if(e.source&&e.source.name){var sc=el('section','src',null,main);el('span','lbl','Source',sc);var p=el('p',null,null,sc);
      if(e.source.url){var a=el('a',null,e.source.name,p);a.href=e.source.url;a.rel='noopener';a.target='_blank';}else p.appendChild(document.createTextNode(e.source.name));}
    var y=yearText(e);if(y){var w=el('div','panel',null,aside);el('span','lbl','When',w);el('span','big',y,w);el('span',null,e.approx?'Approximate date.':'First documented year.',w);w.lastChild.style.cssText='font-size:14px;color:var(--muted)';}
  }
  function entry(list){
    var id=(new URLSearchParams(location.search)).get('id'),e=list.filter(function(x){return x.id===id;})[0],root=$('#entry');
    if(!e){$('#msg').hidden=false;$('#msg').textContent='That entry is not available.';return;}
    try{if(window.OJJQuizPrompt&&document.referrer&&new URL(document.referrer).origin===location.origin&&/jewhate/.test(document.referrer))OJJQuizPrompt.cardOpened(e.id);}catch(x){}   // F-035: opened from a card on the site (a friend's link or a bookmark is not counted)
    document.title=label(e)+' | '+SHARE_TITLE;
    var back=$('#back');back.href=INDEX+Q;
    if(TJ){entryTJ(e,root);return;}
    var head=el('div','ehead',null,root);
    var fr=el('div','frow',null,head);var f=el('span','fam',e.family||'',fr);if(e.status!=='LOCKED')el('span','draft','Draft, not signed off',f);OJJShare.attach(fr,{kind:'jewhate',label:false,title:label(e)+' | The History of JewHate',url:location.href});
    el('h1',null,label(e),head);
    var lie=el('div','lie',null,head);lie.style.padding='22px 26px';el('span','lb','The lie',lie);var lp=el('p',null,e.lie||e.title,lie);lp.style.fontSize='28px';
    var sum=e.cardSummary||e.significance;if(sum)el('p','sum',sum,head);
    var cols=el('div','cols',null,root),main=el('div','main',null,cols),aside=el('div','aside',null,cols);
    function sec(title,build){var s=el('section','sec');el('h2',null,title,s);var ok=build(s);if(ok!==false)main.appendChild(s);}
    sec('What the record shows',function(s){var any=false;if(e.record){el('p','rec',e.record,s);any=true;}if(e.deepDive){el('p',null,e.deepDive,s);any=true;}return any;});
    sec('Where it started, and how it spread',function(s){
      var rows=[['Where',e.geoOrigin],['First documented',yearText(e)],['Who',e.originator],['How it began',e.circumstances],['How it spread',e.spread]].filter(function(r){return r[1];});
      var more=[['Motive shown in the sources',e.documentedMotive],['Motive, as historians interpret it',e.inferredMotive,1],['Major uses',e.uses],['Consequences',e.consequences],['How it changed',e.evolution],['The correction in detail',e.detailedCorrection]].filter(function(r){return r[1];});
      if(!rows.length&&!more.length)return false;
      function dl(rs,parent){var d=el('dl','facts',null,parent);rs.forEach(function(r){el('dt',null,r[0],d);var dd=el('dd',null,r[1],d);if(r[2])el('div','interp','An interpretation, not a documented fact.',dd);});}
      if(rows.length)dl(rows,s);
      if(more.length){var det=el('details','more',null,s);el('summary',null,'More detail',det);dl(more,det);}
    });
    sec('Where you may still hear it',function(s){if(!e.modern)return false;el('p',null,e.modern,s);});
    if(e.sources&&e.sources.length){var sc=el('section','src',null,main);el('span','lbl','Sources',sc);var ol=el('ol',null,null,sc);
      e.sources.forEach(function(x){var li=el('li',null,null,ol);var t=[x.publisher,x.title].filter(Boolean).join(', ');
        if(x.url){var a=el('a',null,t,li);a.href=x.url;a.rel='noopener';a.target='_blank';}else li.appendChild(document.createTextNode(t));
        if(x.type)el('small',null,' ('+x.type+')',li);});}
    var y=yearText(e);if(y){var w=el('div','panel',null,aside);el('span','lbl','When',w);el('span','big',y,w);el('span',null,e.approx?'Approximate date of the first record.':'First documented appearance.',w);w.lastChild.style.cssText='font-size:14px;color:var(--soft)';}
    var rel=(e.related||[]).map(function(r){return list.filter(function(x){return x.id===r;})[0];}).filter(Boolean);
    if(rel.length){var rp=el('div','panel',null,aside);el('span','lbl','Related',rp);var rr=el('div','rel',null,rp);rel.forEach(function(r){var a=el('a',null,label(r),rr);a.href=ENTRY+'?id='+encodeURIComponent(r.id)+(DRAFTS?'&drafts=1':'');});}
  }
  document.addEventListener('DOMContentLoaded',function(){var pg=document.body.getAttribute('data-page');load(function(list){if(pg==='index')index(list);else entry(list);});});
})();
