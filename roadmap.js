/* Roadmap page. Rows, the allowed lists and the version history all come from the gated Worker route; nothing about the roadmap is in this file or the page source.
   The allowed lists live in ONE place, the Worker (RM_CONFIG), and arrive with the rows. Text from the database is only ever put on the page as plain text. */
(function(){
  var ALL=[['id','ID'],['feature','Feature'],['about','About the feature'],['area','Area'],['rec','Recommended version'],['mine','My version'],['status','Status'],['priority','Priority'],['deps','Depends on'],['gate','Gate'],['effort','Effort'],['owner','Owner'],['source','Source'],['notes','Notes']];
  var PUB=[['id','ID'],['feature','Feature'],['about','About the feature'],['rec','Recommended version'],['status','Status']];
  var CMT=['comments','Comments'];
  var COLS=ALL;   // the columns used for search and the admin chooser (the page shows PUB + Comments to visitors, ALL + Comments to the admin)
  var EDIT=['feature','about','area','rec','mine','status','deps','gate','effort','owner','source','notes','priority'];
  var LONG={about:1,notes:1};
  var st={rows:[],cfg:null,version:0,admin:false,hidden:{},comments:{},adminView:false,sort:null},api=function(p,o){return OJJ_GATE.api(p,o);};
  function $(i){return document.getElementById(i);}
  function h(tag,props,kids){var e=document.createElement(tag);for(var k in (props||{})){if(k==='text')e.textContent=props[k];else if(k==='class')e.className=props[k];else e.setAttribute(k,props[k]);}(kids||[]).forEach(function(c){e.appendChild(c);});return e;}
  function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}}
  function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  var et=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'});
  function eastern(iso){try{return et.format(new Date(iso))+' ET';}catch(e){return iso;}}
  function say(t,cls){var m=$('gmsg');m.textContent=t||'';m.className='msg'+(cls?' '+cls:'');}

  function opts(sel,label,list,keepBlank){sel.innerHTML='';sel.appendChild(h('option',{value:'',text:label}));list.forEach(function(v){sel.appendChild(h('option',{value:v,text:v}));});}
  function buildFilters(){var L=st.cfg.lists;opts($('fArea'),'All areas',L.area);opts($('fStatus'),'All statuses',L.status);opts($('fVer'),'All versions',L.version);opts($('fOwner'),'All owners',L.owner);}
  function cmts(id){return st.comments[id]||[];}
  function visible(r){
    var q=$('q').value.trim().toLowerCase(),a=$('fArea').value,s=$('fStatus').value,v=$('fVer').value,o=$('fOwner').value;
    if(a&&r.area!==a)return false;if(s&&r.status!==s)return false;if(o&&r.owner!==o)return false;if(v&&r.rec!==v&&r.mine!==v)return false;
    if(q){var t=COLS.map(function(c){return r[c[0]]||'';}).join(' ').toLowerCase()+' '+cmts(r.id).map(function(c){return c.comment;}).join(' ').toLowerCase();if(t.indexOf(q)<0)return false;}return true;}
  function sortVal(r,k){if(k==='comments')return cmts(r.id).length;var v=r[k];return v==null?'':String(v);}
  function sorted(){
    var rows=st.rows.slice();if(!st.sort)return rows;var k=st.sort.k,d=st.sort.dir==='desc'?-1:1;
    rows.sort(function(x,y){var a=sortVal(x,k),b=sortVal(y,k),r;
      if(k==='comments')r=a-b;else{if(a===''&&b==='')r=0;else if(a==='')return 1;else if(b==='')return -1;else r=a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'});}
      return r*d||(x.sort_order-y.sort_order);});
    return rows;}
  function setSort(k){var s=st.sort;if(!s||s.k!==k)st.sort={k:k,dir:'asc'};else if(s.dir==='asc')st.sort={k:k,dir:'desc'};else st.sort=null;render();}
  // ---------- inline edit (admin) ----------
  function editCell(td,r,f){
    if(td.querySelector('.ed'))return;var spec=st.cfg.fields[f],ctl;
    if(spec.list){ctl=h('select',{class:'ed','aria-label':st.cfg.labels[f]});if(spec.blank)ctl.appendChild(h('option',{value:'',text:'(blank)'}));st.cfg.lists[spec.list].forEach(function(v){ctl.appendChild(h('option',{value:v,text:v}));});}
    else if(LONG[f])ctl=h('textarea',{class:'ed',maxlength:String(spec.max),rows:'4','aria-label':st.cfg.labels[f]});
    else ctl=h('input',{class:'ed',type:'text',maxlength:String(spec.max),'aria-label':st.cfg.labels[f]});
    ctl.value=r[f]==null?'':r[f];td.textContent='';td.classList.add('editing');td.appendChild(ctl);ctl.focus();
    var done=false;
    function finish(save){if(done)return;done=true;var v=ctl.value.trim();
      if(!save||v===(r[f]==null?'':r[f])){render();return;}
      td.textContent='Saving…';
      api('/roadmap/save',{method:'POST',body:{base_version:st.version,name:'',changes:[{id:r.id,field:f,value:v}]}}).then(function(x){
        if(x.status===200){if(x.data.stale){load('Someone saved a newer version first. Your change was added on top, and the page has been reloaded.');}else{r[f]=v;st.version=x.data.version;render();say('Saved as version '+x.data.version+'.','ok');}}
        else{render();say(x.data&&x.data.error==='bad_value'?'That value is not allowed for '+st.cfg.labels[f]+'.':'Could not save. Please try again.','bad');}
      }).catch(function(){render();say('Could not reach the server.','bad');});}
    ctl.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();finish(false);}else if(e.key==='Enter'&&(ctl.tagName!=='TEXTAREA'||e.ctrlKey||e.metaKey)){e.preventDefault();finish(true);}});
    ctl.addEventListener('blur',function(){finish(true);});
    if(ctl.tagName==='SELECT')ctl.addEventListener('change',function(){finish(true);});
  }
  function render(){
    var adm=st.adminView&&st.admin,base=adm?ALL:PUB,cols=base.filter(function(c){return !(adm&&st.hidden[c[0]]);}),tr=h('tr');if(adm)cols.push(CMT);else cols.splice(1,0,CMT);
    cols.forEach(function(c){var on=st.sort&&st.sort.k===c[0],th=h('th',{scope:'col','aria-sort':on?(st.sort.dir==='asc'?'ascending':'descending'):'none'});
      var b=h('button',{type:'button',class:'sortb',text:c[1]+(on?(st.sort.dir==='asc'?' ▲':' ▼'):''),'aria-label':'Sort by '+c[1]});b.onclick=function(){setSort(c[0]);};th.appendChild(b);tr.appendChild(th);});
    $('thead').innerHTML='';$('thead').appendChild(tr);
    var tb=$('tbody');tb.innerHTML='';var n=0;
    sorted().forEach(function(r){if(!visible(r))return;n++;
      var row=h('tr',{class:'row'});
      if(!adm){row.setAttribute('tabindex','0');row.setAttribute('role','button');row.setAttribute('aria-label','Open '+r.id+' '+r.feature);}
      cols.forEach(function(c){var k=c[0],td=h('td',{class:k});
        if(k==='comments'){var cc=cmts(r.id);if(cc.length){td.appendChild(h('b',{text:cc.length+(cc.length===1?' comment':' comments')}));td.appendChild(document.createTextNode(': '+cc[cc.length-1].comment.slice(0,90)+(cc[cc.length-1].comment.length>90?'…':'')));}else td.textContent=adm?'None':'Tap to comment';}
        else td.textContent=r[k]==null?'':r[k];
        if(adm){
          if(k==='comments'){td.setAttribute('tabindex','0');td.classList.add('clk');td.onclick=function(){openRow(r);};td.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();openRow(r);}};}
          else if(EDIT.indexOf(k)>=0){td.setAttribute('tabindex','0');td.classList.add('clk');td.title='Click to edit';td.onclick=function(){editCell(td,r,k);};td.onkeydown=function(e){if(e.key==='Enter'&&e.target===td){e.preventDefault();editCell(td,r,k);}};}
        }
        row.appendChild(td);});
      if(!adm){var go=function(){openRow(r);};row.addEventListener('click',go);row.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});}
      tb.appendChild(row);});
    $('meta').textContent=n+' of '+st.rows.length+' features · '+(adm?'click a cell to edit it, a column heading to sort':'tap a feature to read or add a comment')+(adm?' · admin unlocked · version '+st.version:'');
    var ab=$('admBar');ab.hidden=!st.adminView;
    $('qbar').hidden=!st.adminView;$('q').hidden=!st.adminView;$('fOwner').hidden=!st.adminView;
    $('admBtn').textContent=st.admin?'Admin unlocked':'Admin unlock';$('admBtn').disabled=st.admin;
    var imp=$('impLbl');imp.hidden=!st.admin;imp.style.display=st.admin?'inline-flex':'none';
  }
  function load(msg){
    return api('/roadmap').then(function(r){
      if(r.status===200){st.rows=r.data.rows;st.comments=r.data.comments||{};st.cfg=r.data.config;st.version=r.data.version;st.admin=!!r.data.admin;if(!st.admin&&OJJ_GATE.getAdmin())OJJ_GATE.setAdmin('');st.adminView=/[?&]admin\b/.test(location.search)||st.admin;buildFilters();render();say(msg||'');loadCounts();}
      else if(r.status!==401){say('Could not load the roadmap. Please try again.','bad');}
    }).catch(function(){say('Could not reach the server. Check your connection.','bad');});}

  // ---------- panel helpers ----------
  function panel(title,nodes){var s=$('sheet');s.innerHTML='';s.appendChild(h('h2',{id:'shT',text:title}));nodes.forEach(function(n){s.appendChild(n);});$('pnl').hidden=false;var f=s.querySelector('input,select,textarea,button');if(f)try{f.focus({preventScroll:true});}catch(e){}}
  function closePanel(){$('pnl').hidden=true;$('sheet').innerHTML='';}
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(!$('pnl').hidden)closePanel();$('colsPop').hidden=true;}});
  $('pnl').addEventListener('click',function(e){if(e.target===$('pnl'))closePanel();});

  // ---------- visitor view: read a row, add a comment ----------
  function arch(kind,id,flag,again){return api('/roadmap/archive',{method:'POST',body:{kind:kind,id:id,archived:flag}}).then(function(){return load();}).then(again);}
  function archBtn(kind,id,again){var x=h('button',{type:'button',text:'Archive'});x.onclick=function(){x.disabled=true;arch(kind,id,1,again);};return x;}
  function commentsBlock(r,canDelete,reload){
    var box=h('div'),list=cmts(r.id);
    box.appendChild(h('label',{text:'Comments ('+list.length+')'}));
    if(!list.length)box.appendChild(h('p',{class:'meta',text:'No comments yet. Be the first.'}));
    list.forEach(function(c){var d=h('div',{class:'cm'});
      if(canDelete){var x=h('button',{type:'button',text:'Delete'});x.onclick=function(){x.disabled=true;api('/roadmap/comment/delete',{method:'POST',body:{id:c.id}}).then(function(){reload();});};d.appendChild(x);d.appendChild(archBtn('comment',c.id,function(){reload();}));}
      d.appendChild(document.createTextNode(c.comment));d.appendChild(h('span',{class:'w',text:(c.name?c.name+' · ':'')+eastern(c.ts)}));box.appendChild(d);});
    return box;}
  function openRow(r){if(st.admin&&st.adminView)return openCmts(r);
    var dl=h('dl'),pairs=[['Feature',r.feature],['About the feature',r.about],['Recommended version',r.rec],['Status',r.status]];
    pairs.forEach(function(p){dl.appendChild(h('dt',{text:p[0]}));dl.appendChild(h('dd',{text:p[1]||''}));});
    var nodes=[h('p',{class:'meta',text:r.id}),dl,commentsBlock(r,false,function(){})];
    nodes.push(h('label',{for:'c_text',text:'Add a comment'}),h('textarea',{id:'c_text',maxlength:'500',placeholder:'What do you think of this feature? (up to 500 characters)'}),h('label',{for:'c_name',text:'Your name (optional)'}),h('input',{id:'c_name',type:'text',maxlength:'60',autocomplete:'off'}));
    var send=h('button',{class:'btn pri',type:'button',text:'Send comment'}),close=h('button',{class:'btn',type:'button',text:'Close'}),msg=h('p',{class:'msg',role:'status'});
    nodes.push(h('div',{class:'acts'},[send,close]),msg);panel(r.id+' · '+r.feature,nodes);close.onclick=closePanel;
    send.onclick=function(){var t=$('c_text').value.trim();if(t.length<2){msg.className='msg bad';msg.textContent='Please write a comment first.';return;}
      send.disabled=true;msg.className='msg';msg.textContent='Sending…';
      api('/roadmap/comment',{method:'POST',body:{feature_id:r.id,name:$('c_name').value,comment:t}}).then(function(x){
        if(x.status===200){closePanel();load('Thank you. Your comment was added.').then(function(){say('Thank you. Your comment was added.','ok');});}
        else{send.disabled=false;msg.className='msg bad';msg.textContent=x.status===429?'Too many comments right now. Please try again later.':'Could not send. Please try again.';}
      }).catch(function(){send.disabled=false;msg.className='msg bad';msg.textContent='Could not reach the server.';});};}
  // ---------- recommend a feature ----------
  $('sugBtn').onclick=function(){
    var f=[['s_feature','Feature name','input',150],['s_acc','What the feature accomplishes','textarea',600],['s_about','About the feature','textarea',1000],['s_vision','Your vision for how it works','textarea',1000],['s_name','Your name (optional)','input',60]],nodes=[h('p',{class:'meta',text:'Have an idea for the site? Tell us what it is and how you picture it working. The feature name and what it accomplishes are required; the rest helps us understand your vision.'})];
    f.forEach(function(x){nodes.push(h('label',{for:x[0],text:x[1]}));nodes.push(x[2]==='input'?h('input',{id:x[0],type:'text',maxlength:String(x[3]),autocomplete:'off'}):h('textarea',{id:x[0],maxlength:String(x[3])}));});
    var send=h('button',{class:'btn pri',type:'button',text:'Send'}),cancel=h('button',{class:'btn',type:'button',text:'Cancel'}),msg=h('p',{class:'msg',role:'status'});
    nodes.push(h('div',{class:'acts'},[send,cancel]),msg);panel('Recommend a feature',nodes);cancel.onclick=closePanel;
    send.onclick=function(){var b={feature:$('s_feature').value,accomplishes:$('s_acc').value,about:$('s_about').value,vision:$('s_vision').value,name:$('s_name').value};
      if(b.feature.trim().length<3||b.accomplishes.trim().length<3){msg.className='msg bad';msg.textContent='Please fill in the feature name and what it accomplishes.';return;}
      send.disabled=true;msg.className='msg';msg.textContent='Sending…';
      api('/roadmap/suggest',{method:'POST',body:b}).then(function(x){
        if(x.status===200){closePanel();say('Thank you. Your feature idea was sent.','ok');}
        else{send.disabled=false;msg.className='msg bad';msg.textContent=x.status===429?'Too many ideas right now. Please try again later.':'Could not send. Please try again.';}
      }).catch(function(){send.disabled=false;msg.className='msg bad';msg.textContent='Could not reach the server.';});};};
  // ---------- new / total counts (admin, F-081) ----------
  var NB={cmtListBtn:'comment',sugListBtn:'suggestion',fbListBtn:'feedback'},seen={comment:0,suggestion:0,feedback:0};
  function loadCounts(){if(!st.admin)return Promise.resolve();
    return api('/roadmap/counts').then(function(r){if(r.status!==200)return;
      Object.keys(NB).forEach(function(id){var b=$(id),c=r.data[NB[id]];if(!b||!c)return;seen[NB[id]]=c.last_id;
        var sp=b.querySelector('.nb');if(!sp){sp=h('span',{class:'nb'});b.appendChild(sp);}
        sp.textContent=' '+c.fresh+'/'+c.total;sp.setAttribute('aria-label',c.fresh+' new of '+c.total+' total');sp.style.cssText='margin-left:6px;font-size:.85em;opacity:'+(c.fresh?'1':'.7')+';font-weight:'+(c.fresh?'700':'400');});
      if(window.OJJ_NAV_COUNTS)window.OJJ_NAV_COUNTS();}).catch(function(){});}
  function markSeen(kind){api('/roadmap/seen',{method:'POST',body:{kinds:[kind]}}).then(loadCounts);}
  function newTag(){return h('span',{class:'w',text:'NEW',style:'color:#f2a65a;font-weight:700;margin-right:6px'});}
  function closeBtn(){var c=h('button',{class:'btn',type:'button',text:'Close'});c.onclick=closePanel;return h('div',{class:'acts'},[c]);}
  $('sugListBtn').onclick=function(){needAdmin(function(){
    var was=seen.suggestion;api('/roadmap/suggestions').then(function(r){if(r.status!==200){say('Could not load suggested features.','bad');return;}
      var nodes=[];if(!r.data.suggestions.length)nodes.push(h('p',{class:'meta',text:'No suggested features yet.'}));
      r.data.suggestions.forEach(function(x){var d=h('div',{class:'cm'});d.appendChild(archBtn('suggestion',x.id,function(){$('sugListBtn').click();}));var hh=h('h3',{});if(x.id>was)hh.appendChild(newTag());hh.appendChild(document.createTextNode(x.feature));d.appendChild(hh);
        [['What it accomplishes',x.accomplishes],['About',x.about],['Vision',x.vision]].forEach(function(p){if(p[1]){d.appendChild(h('span',{class:'w',text:p[0]+': '+p[1]}));}});
        d.appendChild(h('span',{class:'w',text:(x.name?x.name+' · ':'')+eastern(x.ts)}));nodes.push(d);});
      nodes.push(closeBtn());panel('Suggested features ('+r.data.suggestions.length+')',nodes);markSeen('suggestion');});});};
  $('cmtListBtn').onclick=function(){needAdmin(function(){
    var byId={};st.rows.forEach(function(r){byId[r.id]=r;});var was=seen.comment,isNew=function(i){return st.comments[i].some(function(c){return c.id>was;});},ids=Object.keys(st.comments).filter(function(i){return st.comments[i].length;}).sort(function(a,b){return (isNew(b)-isNew(a))||(a<b?-1:a>b?1:0);}),nodes=[],total=0;
    if(!ids.length)nodes.push(h('p',{class:'meta',text:'No comments yet.'}));
    ids.forEach(function(id){var d=h('div',{class:'cm'});d.appendChild(h('h3',{text:id+' · '+(byId[id]?byId[id].feature:'')}));
      st.comments[id].forEach(function(c){total++;var line=h('div',{class:'cm'});var x=h('button',{type:'button',text:'Delete'});x.onclick=function(){x.disabled=true;api('/roadmap/comment/delete',{method:'POST',body:{id:c.id}}).then(function(){load().then(function(){$('cmtListBtn').click();});});};line.appendChild(x);line.appendChild(archBtn('comment',c.id,function(){$('cmtListBtn').click();}));if(c.id>was)line.appendChild(newTag());line.appendChild(document.createTextNode(c.comment));line.appendChild(h('span',{class:'w',text:(c.name?c.name+' · ':'')+eastern(c.ts)}));d.appendChild(line);});nodes.push(d);});
    nodes.push(closeBtn());panel('Comments ('+total+')',nodes);markSeen('comment');});};
  $('fbListBtn').onclick=function(){needAdmin(function(){
    var was=seen.feedback;api('/roadmap/feedback').then(function(r){if(r.status!==200){say('Could not load feedback.','bad');return;}
      var nodes=[];if(!r.data.feedback.length)nodes.push(h('p',{class:'meta',text:'No feedback yet.'}));
      r.data.feedback.forEach(function(f){var d=h('div',{class:'cm'});d.appendChild(archBtn('feedback',f.id,function(){$('fbListBtn').click();}));var hf=h('h3',{});if(f.id>was)hf.appendChild(newTag());hf.appendChild(document.createTextNode(f.topic+' · '+eastern(f.ts)));d.appendChild(hf);d.appendChild(document.createTextNode(f.message));
        if(f.has_image){var b=h('button',{type:'button',text:'Show photo',style:'float:none;margin:8px 0 0;display:block'});b.onclick=function(){b.disabled=true;api('/roadmap/feedback/image?id='+f.id).then(function(x){if(x.status===200&&/^data:image\/jpeg;base64,/.test(x.data.image)){var im=h('img',{alt:'Photo sent with this feedback'});im.src=x.data.image;d.appendChild(im);b.remove();}else{b.disabled=false;b.textContent='Photo not available';}});};d.appendChild(b);}
        nodes.push(d);});
      nodes.push(closeBtn());panel('Feedback results ('+r.data.feedback.length+')',nodes);markSeen('feedback');});});};

  $('arcListBtn').onclick=function(){needAdmin(function(){
    api('/roadmap/archive').then(function(r){if(r.status!==200){say('Could not load the archive.','bad');return;}
      var nodes=[],n=0,again=function(){$('arcListBtn').click();};
      function item(kind,id,head,text,meta){n++;var d=h('div',{class:'cm'});
        var del=h('button',{type:'button',text:'Delete forever'});del.onclick=function(){if(!del.dataset.a){del.dataset.a='1';del.textContent='Tap again to delete forever';return;}del.disabled=true;api('/roadmap/archive/delete',{method:'POST',body:{kind:kind,id:id}}).then(again);};
        var res=h('button',{type:'button',text:'Restore'});res.onclick=function(){res.disabled=true;arch(kind,id,0,again);};
        d.appendChild(del);d.appendChild(res);d.appendChild(h('h3',{text:head}));d.appendChild(document.createTextNode(text));d.appendChild(h('span',{class:'w',text:meta}));nodes.push(d);}
      r.data.comments.forEach(function(c){item('comment',c.id,c.feature_id+' · comment',c.comment,(c.name?c.name+' · ':'')+eastern(c.ts));});
      r.data.suggestions.forEach(function(x){item('suggestion',x.id,x.feature+' · suggested feature',x.accomplishes,(x.name?x.name+' · ':'')+eastern(x.ts));});
      r.data.feedback.forEach(function(f){item('feedback',f.id,f.topic+' · feedback',f.message,eastern(f.ts));});
      if(!n)nodes.push(h('p',{class:'meta',text:'The archive is empty.'}));
      nodes.push(closeBtn());panel('Archive ('+n+')',nodes);});});};

  // ---------- edit (admin) ----------
  $('statsBtn').onclick=function(){needAdmin(function(){
    api('/roadmap/stats').then(function(x){
      if(x.status!==200){panel('Quiz and visitor results',[h('p',{class:'msg bad',text:'Could not load the results.'}),closeBtn()]);return;}
      var d=x.data,q=d.quiz||{},v=d.visits||{},nodes=[];
      function pct(a,b){return b?Math.round(100*a/b)+'%':'n/a';}
      function big(list){var w=h('div',{class:'big'});list.forEach(function(p){w.appendChild(h('div',{},[h('b',{text:String(p[1])}),h('span',{text:p[0]})]));});return w;}
      function tbl(title,rows,cols){nodes.push(h('h3',{class:'sh',text:title}));if(!rows||!rows.length){nodes.push(h('p',{class:'meta',text:'Nothing yet.'}));return;}
        var t=h('table',{class:'st'});rows.forEach(function(r){var tr=h('tr');cols.forEach(function(c){tr.appendChild(h('td',{text:String(c(r))}));});t.appendChild(tr);});nodes.push(t);}
      nodes.push(big([['People who answered',q.people||0],['Answers',q.answers||0],['Rounds played',q.rounds||0],['Right answers',pct(q.right||0,q.answers||0)]]));
      nodes.push(h('h3',{class:'sh',text:'Visits'}));
      if(d.visits_table)nodes.push(big([['Visits recorded',v.visits||0],['Different devices',v.devices||0],['Devices that came back',d.returning||0],['Visits, last 7 days',(d.last7||{}).visits||0]]));
      else nodes.push(h('p',{class:'meta',text:'Visit details are not available yet (the visits table is missing).'}));
      var kn=function(r){return r.k;},nn=function(r){return r.n;};
      tbl('How they rated it',d.survey,[kn,nn]);
      tbl('Right answers by era',d.eras,[kn,function(r){return r.n+' answers';},function(r){return pct(r.right||0,r.n);}]);
      tbl('Hardest questions (5 or more answers)',d.hardest,[kn,function(r){return r.n+' answers';},function(r){return pct(r.right||0,r.n);}]);
      if(d.visits_table){tbl('Countries',d.where.country,[kn,nn]);tbl('Regions',d.where.region,[kn,nn]);tbl('Cities',d.where.city,[kn,nn]);
        tbl('Device type',d.using.device,[kn,nn]);tbl('Browsers',d.using.browser,[kn,nn]);tbl('Operating systems',d.using.os,[kn,nn]);tbl('Languages',d.using.lang,[kn,nn]);tbl('Where they came from',d.ref,[kn,nn]);}
      nodes.push(h('p',{class:'meta',text:'Test visits are left out. Visit details are saved only when someone answers a question or taps the rating.'}));
      nodes.push(closeBtn());panel('Quiz and visitor results',nodes);
    }).catch(function(){panel('Quiz and visitor results',[h('p',{class:'msg bad',text:'Could not reach the server.'}),closeBtn()]);});
  });};
  function openCmts(r){
    var close=h('button',{class:'btn',type:'button',text:'Close'});
    panel(r.id+' · '+r.feature+' · comments',[commentsBlock(r,true,function(){closePanel();load();}),h('div',{class:'acts'},[close])]);close.onclick=closePanel;}

  // ---------- version history ----------
  function snapTable(rows){var t=h('table'),hd=h('tr');['ID','Feature','Status','Rec.','Mine','Priority'].forEach(function(x){hd.appendChild(h('th',{text:x}));});t.appendChild(hd);
    rows.forEach(function(r){var tr=h('tr');[r.id,r.feature,r.status,r.rec,r.mine,r.priority].forEach(function(x){tr.appendChild(h('td',{text:x||''}));});t.appendChild(tr);});
    var w=h('div',{class:'tw',style:'max-height:50vh'});w.appendChild(t);return w;}
  function openHistory(){
    if(!st.admin){say('Unlock admin first.','bad');return;}
    api('/roadmap/versions').then(function(r){
      if(r.status!==200){say('Could not load the history.','bad');return;}
      var ul=h('ul',{class:'vl'});
      r.data.versions.forEach(function(v){var b=h('button',{type:'button'});b.appendChild(h('span',{text:'Version '+v.version_id+(v.saved_by_label?' · '+v.saved_by_label:'')}));b.appendChild(h('span',{class:'d',text:eastern(v.saved_at)}));b.appendChild(h('span',{class:'d',text:v.summary}));
        b.onclick=function(){showVersion(v.version_id);};ul.appendChild(h('li',{},[b]));});
      var close=h('button',{class:'btn',type:'button',text:'Close'});close.onclick=closePanel;
      panel('Version history',[ul,h('div',{class:'acts'},[close])]);});}
  function showVersion(id){
    api('/roadmap/version?id='+id).then(function(r){
      if(r.status!==200){return;}var v=r.data,back=h('button',{class:'btn',type:'button',text:'Back'}),rest=h('button',{class:'btn pri',type:'button',text:'Restore this version'}),msg=h('p',{class:'msg',role:'status'});
      back.onclick=openHistory;var armed=false;
      rest.onclick=function(){
        if(!armed){armed=true;rest.textContent='Tap again to confirm restore';msg.textContent='This creates a new version that copies version '+id+'. History is never deleted.';return;}
        rest.disabled=true;api('/roadmap/restore',{method:'POST',body:{version_id:id,name:$('f_n')?$('f_n').value:''}}).then(function(x){if(x.status===200){closePanel();load('Restored. Saved as version '+x.data.version+'.').then(function(){say('Restored. Saved as version '+x.data.version+'.','ok');});}else{rest.disabled=false;msg.className='msg bad';msg.textContent='Could not restore.';}});};
      panel('Version '+v.version_id+' · '+eastern(v.saved_at),[h('p',{class:'meta',text:(v.saved_by_label?v.saved_by_label+' · ':'')+v.summary+' (read only)'}),snapTable(v.rows),
        h('label',{for:'f_n',text:'Your name (optional)'}),h('input',{id:'f_n',type:'text',maxlength:'60',autocomplete:'off'}),h('div',{class:'acts'},[rest,back]),msg]);});}

  // ---------- columns, export, priority admin, import ----------
  function buildCols(){var p=$('colsPop');p.innerHTML='';COLS.forEach(function(c){var cb=h('input',{type:'checkbox'});cb.checked=!st.hidden[c[0]];cb.onchange=function(){if(cb.checked)delete st.hidden[c[0]];else st.hidden[c[0]]=1;lsSet('ojj-rm-hidden',st.hidden);render();};var l=h('label');l.appendChild(cb);l.appendChild(document.createTextNode(c[1]));p.appendChild(l);});}
  $('colsBtn').onclick=function(e){var p=$('colsPop');if(!p.hidden){p.hidden=true;$('colsBtn').setAttribute('aria-expanded','false');return;}buildCols();var b=$('colsBtn').getBoundingClientRect();p.hidden=false;p.style.left=Math.max(8,Math.min(b.left,innerWidth-p.offsetWidth-8))+'px';p.style.top=(b.bottom+6)+'px';$('colsBtn').setAttribute('aria-expanded','true');e.stopPropagation();};
  document.addEventListener('click',function(e){var p=$('colsPop');if(!p.hidden&&!p.contains(e.target)){p.hidden=true;$('colsBtn').setAttribute('aria-expanded','false');}});
  function csvCell(v){v=String(v==null?'':v);return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
  $('expBtn').onclick=function(){if(!st.admin){say('Unlock admin first.','bad');return;}var H=['id','feature','about','area','rec','mine','status','deps','gate','effort','owner','source','notes','order','priority'];
    var out=[H.join(',')].concat(st.rows.map(function(r){return H.map(function(k){return csvCell(k==='order'?r.sort_order:r[k]);}).join(',');})).join('\r\n');
    var a=h('a',{href:URL.createObjectURL(new Blob([out+'\r\n'],{type:'text/csv'})),download:'roadmap-v'+st.version+'.csv'});document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);};
  function askAdmin(then){
    var inp=h('input',{id:'f_adm',type:'password',autocomplete:'off',autocapitalize:'off',spellcheck:'false'}),go=h('button',{class:'btn pri',type:'button',text:'Unlock'}),cancel=h('button',{class:'btn',type:'button',text:'Cancel'}),msg=h('p',{class:'msg',role:'status'});
    panel('Admin unlock',[h('p',{class:'meta',text:'This is for the site admin. Enter the admin code to continue.'}),h('label',{for:'f_adm',text:'Admin code'}),inp,h('div',{class:'acts'},[go,cancel]),msg]);cancel.onclick=closePanel;
    var run=function(){go.disabled=true;api('/admin',{method:'POST',body:{code:inp.value}}).then(function(x){if(x.status===200&&x.data.admin_token){OJJ_GATE.setAdmin(x.data.admin_token);closePanel();load('Admin unlocked.').then(function(){if(then)then();});}else{go.disabled=false;inp.value='';msg.className='msg bad';msg.textContent=x.status===401?'Incorrect admin code.':'Could not check the code right now.';}}).catch(function(){go.disabled=false;msg.className='msg bad';msg.textContent='Could not reach the server.';});};
    go.onclick=run;inp.addEventListener('keydown',function(e){if(e.key==='Enter')run();});}
  function needAdmin(fn){if(st.admin)fn();else askAdmin(fn);}
  $('admBtn').onclick=function(){askAdmin();};
  function parseCsv(t){var rows=[],row=[],f='',q=false;t=t.replace(/^﻿/,'');for(var i=0;i<t.length;i++){var c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(f);f='';if(row.length>1||row[0]!=='')rows.push(row);row=[];}else f+=c;}row.push(f);if(row.length>1||row[0]!=='')rows.push(row);return rows;}
  $('impFile').addEventListener('change',function(){
    var file=this.files&&this.files[0];this.value='';if(!file)return;
    file.text().then(function(txt){
      var t=parseCsv(txt),H=t[0]||[],need=['id','feature','about','area','rec','mine','status','deps','gate','effort','owner','source','notes','order','priority'];
      if(need.some(function(k){return H.indexOf(k)<0;})){say('That CSV does not have the expected header: '+need.join(','),'bad');return;}
      var rows=t.slice(1).map(function(r){var o={};H.forEach(function(k,i){o[k]=r[i]||'';});o.sort_order=/^\d+$/.test(o.order)?parseInt(o.order,10):0;delete o.order;return o;});
      var name=((window.prompt?prompt('Your name (optional):'):'')||'');
      say('Importing '+rows.length+' rows…');
      api('/roadmap/import',{method:'POST',body:{rows:rows,name:name}}).then(function(x){if(x.status===200)load('Imported '+x.data.count+' rows as version '+x.data.version+'.').then(function(){say('Imported '+x.data.count+' rows as version '+x.data.version+'.','ok');});else say(x.status===403?'Only the admin can import.':'Import refused: '+(x.data.error||'error')+(x.data.id?' ('+x.data.id+(x.data.field?' '+x.data.field:'')+')':'')+'. Nothing was changed.','bad');});
    });});
  $('histBtn').onclick=openHistory;
  ['q'].forEach(function(i){$(i).addEventListener('input',render);});['fArea','fStatus','fVer','fOwner'].forEach(function(i){$(i).addEventListener('change',render);});
  window.onGateOpen=function(){st.hidden=lsGet('ojj-rm-hidden')||{};load();};
})();
