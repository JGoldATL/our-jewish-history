/* Roadmap page. Rows, the allowed lists and the version history all come from the gated Worker route; nothing about the roadmap is in this file or the page source.
   The allowed lists live in ONE place, the Worker (RM_CONFIG), and arrive with the rows. Text from the database is only ever put on the page as plain text. */
(function(){
  var ALL=[['id','ID'],['feature','Feature'],['about','About the feature'],['area','Area'],['rec','Recommended version'],['mine','My version'],['status','Status'],['priority','Priority'],['deps','Depends on'],['gate','Gate'],['effort','Effort'],['owner','Owner'],['source','Source'],['notes','Notes']];
  var PUB=[['id','ID'],['feature','Feature'],['about','About the feature'],['rec','Recommended version'],['status','Status']];
  var CMT=['comments','Comments'];
  var COLS=ALL;   // the columns used for search and the admin chooser (the page shows PUB + Comments to visitors, ALL + Comments to the admin)
  var EDIT=['feature','about','area','rec','mine','status','deps','gate','effort','owner','source','notes','priority'];
  var LONG={about:1,notes:1};
  var st={rows:[],cfg:null,version:0,admin:false,hidden:{},comments:{},adminView:false},api=function(p,o){return OJJ_GATE.api(p,o);};
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
  function render(){
    var base=st.adminView&&st.admin?ALL:PUB,cols=base.filter(function(c){return !(st.adminView&&st.admin&&st.hidden[c[0]]);}).concat([CMT]),tr=h('tr');
    cols.forEach(function(c){tr.appendChild(h('th',{text:c[1],scope:'col'}));});$('thead').innerHTML='';$('thead').appendChild(tr);
    var tb=$('tbody');tb.innerHTML='';var n=0;
    st.rows.forEach(function(r){if(!visible(r))return;n++;
      var row=h('tr',{class:'row',tabindex:'0',role:'button','aria-label':(st.admin&&st.adminView?'Edit ':'Open ')+r.id+' '+r.feature});
      cols.forEach(function(c){var td=h('td',{class:c[0]});
        if(c[0]==='comments'){var cc=cmts(r.id);if(cc.length){td.appendChild(h('b',{text:cc.length+(cc.length===1?' comment':' comments')}));td.appendChild(document.createTextNode(': '+cc[cc.length-1].comment.slice(0,90)+(cc[cc.length-1].comment.length>90?'…':'')));}else td.textContent='Tap to comment';}
        else td.textContent=r[c[0]]==null?'':r[c[0]];
        row.appendChild(td);});
      var go=function(){openRow(r);};row.addEventListener('click',go);row.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});tb.appendChild(row);});
    $('meta').textContent=n+' of '+st.rows.length+' features · tap a row to read or add a comment'+(st.adminView&&st.admin?' · admin unlocked · version '+st.version:'');
    var ab=$('admBar');ab.hidden=!st.adminView;
    $('q').hidden=!st.adminView;$('fOwner').hidden=!st.adminView;
    $('admBtn').textContent=st.admin?'Admin unlocked':'Admin unlock';$('admBtn').disabled=st.admin;
    var imp=$('impLbl');imp.hidden=!st.admin;imp.style.display=st.admin?'inline-flex':'none';
  }
  function load(msg){
    return api('/roadmap').then(function(r){
      if(r.status===200){st.rows=r.data.rows;st.comments=r.data.comments||{};st.cfg=r.data.config;st.version=r.data.version;st.admin=!!r.data.admin;if(!st.admin&&OJJ_GATE.getAdmin())OJJ_GATE.setAdmin('');st.adminView=/[?&]admin\b/.test(location.search)||st.admin;buildFilters();render();say(msg||'');}
      else if(r.status!==401){say('Could not load the roadmap. Please try again.','bad');}
    }).catch(function(){say('Could not reach the server. Check your connection.','bad');});}

  // ---------- panel helpers ----------
  function panel(title,nodes){var s=$('sheet');s.innerHTML='';s.appendChild(h('h2',{id:'shT',text:title}));nodes.forEach(function(n){s.appendChild(n);});$('pnl').hidden=false;var f=s.querySelector('input,select,textarea,button');if(f)try{f.focus({preventScroll:true});}catch(e){}}
  function closePanel(){$('pnl').hidden=true;$('sheet').innerHTML='';}
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(!$('pnl').hidden)closePanel();$('colsPop').hidden=true;}});
  $('pnl').addEventListener('click',function(e){if(e.target===$('pnl'))closePanel();});

  // ---------- visitor view: read a row, add a comment ----------
  function commentsBlock(r,canDelete,reload){
    var box=h('div'),list=cmts(r.id);
    box.appendChild(h('label',{text:'Comments ('+list.length+')'}));
    if(!list.length)box.appendChild(h('p',{class:'meta',text:'No comments yet. Be the first.'}));
    list.forEach(function(c){var d=h('div',{class:'cm'});
      if(canDelete){var x=h('button',{type:'button',text:'Delete'});x.onclick=function(){x.disabled=true;api('/roadmap/comment/delete',{method:'POST',body:{id:c.id}}).then(function(){reload();});};d.appendChild(x);}
      d.appendChild(document.createTextNode(c.comment));d.appendChild(h('span',{class:'w',text:(c.name?c.name+' · ':'')+eastern(c.ts)}));box.appendChild(d);});
    return box;}
  function openRow(r){if(st.admin&&st.adminView)return openEdit(r);
    var dl=h('dl'),pairs=[['Feature',r.feature],['About the feature',r.about],['Recommended version',r.rec],['Status',r.status]];
    pairs.forEach(function(p){dl.appendChild(h('dt',{text:p[0]}));dl.appendChild(h('dd',{text:p[1]||''}));});
    var nodes=[h('p',{class:'meta',text:r.id}),dl,commentsBlock(r,false,function(){})];
    nodes.push(h('label',{for:'c_text',text:'Add a comment'}),h('textarea',{id:'c_text',maxlength:'500',placeholder:'Your comment (up to 500 characters)'}),h('label',{for:'c_name',text:'Your name (optional)'}),h('input',{id:'c_name',type:'text',maxlength:'60',autocomplete:'off'}));
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
    var f=[['s_feature','Feature name','input',150],['s_acc','What the feature accomplishes','textarea',600],['s_about','About the feature','textarea',1000],['s_vision','Your vision for how it works','textarea',1000],['s_name','Your name (optional)','input',60]],nodes=[h('p',{class:'meta',text:'Tell us about a feature you would like to see. The first two boxes are required.'})];
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
  $('sugListBtn').onclick=function(){
    if(!st.admin){say('Unlock admin first.','bad');return;}
    api('/roadmap/suggestions').then(function(r){if(r.status!==200){say('Could not load suggestions.','bad');return;}
      var nodes=[];if(!r.data.suggestions.length)nodes.push(h('p',{class:'meta',text:'No suggestions yet.'}));
      r.data.suggestions.forEach(function(x){var d=h('div',{class:'cm'});d.appendChild(h('b',{text:x.feature}));
        [['Accomplishes',x.accomplishes],['About',x.about],['Vision',x.vision]].forEach(function(p){if(p[1]){d.appendChild(h('span',{class:'w',text:p[0]+': '+p[1]}));}});
        d.appendChild(h('span',{class:'w',text:(x.name?x.name+' · ':'')+eastern(x.ts)}));nodes.push(d);});
      var close=h('button',{class:'btn',type:'button',text:'Close'});close.onclick=closePanel;nodes.push(h('div',{class:'acts'},[close]));panel('Suggestions',nodes);});};

  // ---------- edit (admin) ----------
  function field(f,r){
    var spec=st.cfg.fields[f],id='f_'+f,lab=h('label',{for:id,text:st.cfg.labels[f].replace(/^./,function(c){return c.toUpperCase();})+(f==='priority'&&!st.admin?' (only the admin can change this)':'')}),ctl;
    if(spec.list){ctl=h('select',{id:id});if(spec.blank)ctl.appendChild(h('option',{value:'',text:'(blank)'}));st.cfg.lists[spec.list].forEach(function(v){ctl.appendChild(h('option',{value:v,text:v}));});}
    else if(LONG[f]){ctl=h('textarea',{id:id,maxlength:String(spec.max)});}else{ctl=h('input',{id:id,type:'text',maxlength:String(spec.max)});}
    ctl.value=r[f];if(f==='priority'&&!st.admin)ctl.disabled=true;return [lab,ctl];}
  function openEdit(r){
    var nodes=[h('p',{class:'meta',text:r.id})];
    EDIT.forEach(function(f){field(f,r).forEach(function(n){nodes.push(n);});});
    nodes.push(h('label',{for:'f_name',text:'Your name (optional, saved with the change)'}),h('input',{id:'f_name',type:'text',maxlength:'60',autocomplete:'off'}));
    var save=h('button',{class:'btn pri',type:'button',text:'Save'}),cancel=h('button',{class:'btn',type:'button',text:'Cancel'}),msg=h('p',{class:'msg',role:'status'});
    nodes.push(h('div',{class:'acts'},[save,cancel]),msg);nodes.push(commentsBlock(r,true,function(){closePanel();load();}));panel('Edit '+r.id,nodes);cancel.onclick=closePanel;
    save.onclick=function(){
      var ch=[];EDIT.forEach(function(f){var c=$('f_'+f);if(c.disabled)return;var v=c.value.trim();if(v!==r[f])ch.push({id:r.id,field:f,value:v});});
      if(!ch.length){msg.textContent='Nothing changed.';return;}
      save.disabled=true;msg.className='msg';msg.textContent='Saving…';
      api('/roadmap/save',{method:'POST',body:{base_version:st.version,name:$('f_name').value,changes:ch}}).then(function(x){
        if(x.status===200){closePanel();load(x.data.stale?'Someone saved a newer version first. Your change was added on top, and the page has been reloaded.':'Saved as version '+x.data.version+'.').then(function(){if(!x.data.stale)say('Saved as version '+x.data.version+'.','ok');});}
        else{save.disabled=false;msg.className='msg bad';msg.textContent=x.data.error==='priority_locked'?'Only the admin can change Priority.':x.data.error==='bad_value'?'That value is not allowed for '+(x.data.field||'a field')+'.':'Could not save. Please try again.';}
      }).catch(function(){save.disabled=false;msg.className='msg bad';msg.textContent='Could not reach the server.';});};}

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
  $('admBtn').onclick=function(){
    var inp=h('input',{id:'f_adm',type:'password',autocomplete:'off',autocapitalize:'off',spellcheck:'false'}),go=h('button',{class:'btn pri',type:'button',text:'Unlock'}),cancel=h('button',{class:'btn',type:'button',text:'Cancel'}),msg=h('p',{class:'msg',role:'status'});
    panel('Admin unlock',[h('p',{class:'meta',text:'Only the admin can edit rows, set Priority, see history, restore and import. Enter the admin code to unlock this for this visit.'}),h('label',{for:'f_adm',text:'Admin code'}),inp,h('div',{class:'acts'},[go,cancel]),msg]);cancel.onclick=closePanel;
    var run=function(){go.disabled=true;api('/admin',{method:'POST',body:{code:inp.value}}).then(function(x){if(x.status===200&&x.data.admin_token){OJJ_GATE.setAdmin(x.data.admin_token);closePanel();load('Admin unlocked.');}else{go.disabled=false;inp.value='';msg.className='msg bad';msg.textContent=x.status===401?'Incorrect admin code.':'Could not check the code right now.';}}).catch(function(){go.disabled=false;msg.className='msg bad';msg.textContent='Could not reach the server.';});};
    go.onclick=run;inp.addEventListener('keydown',function(e){if(e.key==='Enter')run();});};
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
