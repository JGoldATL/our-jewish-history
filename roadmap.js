/* Roadmap page. Rows, the allowed lists and the version history all come from the gated Worker route; nothing about the roadmap is in this file or the page source.
   The allowed lists live in ONE place, the Worker (RM_CONFIG), and arrive with the rows. Text from the database is only ever put on the page as plain text. */
(function(){
  var COLS=[['id','ID'],['feature','Feature'],['about','About the feature'],['area','Area'],['rec','Recommended version'],['mine','My version'],['status','Status'],['priority','Priority'],['deps','Depends on'],['gate','Gate'],['effort','Effort'],['owner','Owner'],['source','Source'],['notes','Notes']];
  var EDIT=['feature','about','area','rec','mine','status','deps','gate','effort','owner','source','notes','priority'];
  var LONG={about:1,notes:1};
  var st={rows:[],cfg:null,version:0,admin:false,hidden:{}},api=function(p,o){return OJJ_GATE.api(p,o);};
  function $(i){return document.getElementById(i);}
  function h(tag,props,kids){var e=document.createElement(tag);for(var k in (props||{})){if(k==='text')e.textContent=props[k];else if(k==='class')e.className=props[k];else e.setAttribute(k,props[k]);}(kids||[]).forEach(function(c){e.appendChild(c);});return e;}
  function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}}
  function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  var et=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'});
  function eastern(iso){try{return et.format(new Date(iso))+' ET';}catch(e){return iso;}}
  function say(t,cls){var m=$('gmsg');m.textContent=t||'';m.className='msg'+(cls?' '+cls:'');}

  function opts(sel,label,list,keepBlank){sel.innerHTML='';sel.appendChild(h('option',{value:'',text:label}));list.forEach(function(v){sel.appendChild(h('option',{value:v,text:v}));});}
  function buildFilters(){var L=st.cfg.lists;opts($('fArea'),'All areas',L.area);opts($('fStatus'),'All statuses',L.status);opts($('fVer'),'All versions',L.version);opts($('fOwner'),'All owners',L.owner);}
  function visible(r){
    var q=$('q').value.trim().toLowerCase(),a=$('fArea').value,s=$('fStatus').value,v=$('fVer').value,o=$('fOwner').value;
    if(a&&r.area!==a)return false;if(s&&r.status!==s)return false;if(o&&r.owner!==o)return false;if(v&&r.rec!==v&&r.mine!==v)return false;
    if(q){var t=COLS.map(function(c){return r[c[0]];}).join(' ').toLowerCase();if(t.indexOf(q)<0)return false;}return true;}
  function render(){
    var cols=COLS.filter(function(c){return !st.hidden[c[0]];}),tr=h('tr');
    cols.forEach(function(c){tr.appendChild(h('th',{text:c[1],scope:'col'}));});$('thead').innerHTML='';$('thead').appendChild(tr);
    var tb=$('tbody');tb.innerHTML='';var n=0;
    st.rows.forEach(function(r){if(!visible(r))return;n++;
      var row=h('tr',{class:'row',tabindex:'0',role:'button','aria-label':'Edit '+r.id+' '+r.feature});
      cols.forEach(function(c){row.appendChild(h('td',{class:c[0],text:r[c[0]]}));});
      var go=function(){openEdit(r);};row.addEventListener('click',go);row.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});tb.appendChild(row);});
    $('meta').textContent=n+' of '+st.rows.length+' features · version '+st.version+(st.admin?' · priority unlocked':'')+' · tap a row to edit';
    $('admBtn').textContent=st.admin?'Priority unlocked':'Set priority';$('admBtn').disabled=st.admin;
    var imp=$('impLbl');imp.hidden=!st.admin;imp.style.display=st.admin?'inline-flex':'none';
  }
  function load(msg){
    return api('/roadmap').then(function(r){
      if(r.status===200){st.rows=r.data.rows;st.cfg=r.data.config;st.version=r.data.version;st.admin=!!r.data.admin;if(!st.admin&&OJJ_GATE.getAdmin())OJJ_GATE.setAdmin('');buildFilters();render();say(msg||'');}
      else if(r.status!==401){say('Could not load the roadmap. Please try again.','bad');}
    }).catch(function(){say('Could not reach the server. Check your connection.','bad');});}

  // ---------- panel helpers ----------
  function panel(title,nodes){var s=$('sheet');s.innerHTML='';s.appendChild(h('h2',{id:'shT',text:title}));nodes.forEach(function(n){s.appendChild(n);});$('pnl').hidden=false;var f=s.querySelector('input,select,textarea,button');if(f)try{f.focus({preventScroll:true});}catch(e){}}
  function closePanel(){$('pnl').hidden=true;$('sheet').innerHTML='';}
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(!$('pnl').hidden)closePanel();$('colsPop').hidden=true;}});
  $('pnl').addEventListener('click',function(e){if(e.target===$('pnl'))closePanel();});

  // ---------- edit ----------
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
    nodes.push(h('div',{class:'acts'},[save,cancel]),msg);panel('Edit '+r.id,nodes);cancel.onclick=closePanel;
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
  $('expBtn').onclick=function(){var H=['id','feature','about','area','rec','mine','status','deps','gate','effort','owner','source','notes','order','priority'];
    var out=[H.join(',')].concat(st.rows.map(function(r){return H.map(function(k){return csvCell(k==='order'?r.sort_order:r[k]);}).join(',');})).join('\r\n');
    var a=h('a',{href:URL.createObjectURL(new Blob([out+'\r\n'],{type:'text/csv'})),download:'roadmap-v'+st.version+'.csv'});document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);};
  $('admBtn').onclick=function(){
    var inp=h('input',{id:'f_adm',type:'password',autocomplete:'off',autocapitalize:'off',spellcheck:'false'}),go=h('button',{class:'btn pri',type:'button',text:'Unlock'}),cancel=h('button',{class:'btn',type:'button',text:'Cancel'}),msg=h('p',{class:'msg',role:'status'});
    panel('Set priority',[h('p',{class:'meta',text:'Only the admin can set Priority or import a CSV. Enter the admin code to unlock this for this visit.'}),h('label',{for:'f_adm',text:'Admin code'}),inp,h('div',{class:'acts'},[go,cancel]),msg]);cancel.onclick=closePanel;
    var run=function(){go.disabled=true;api('/admin',{method:'POST',body:{code:inp.value}}).then(function(x){if(x.status===200&&x.data.admin_token){OJJ_GATE.setAdmin(x.data.admin_token);closePanel();load('Priority unlocked.');}else{go.disabled=false;inp.value='';msg.className='msg bad';msg.textContent=x.status===401?'Incorrect admin code.':'Could not check the code right now.';}}).catch(function(){go.disabled=false;msg.className='msg bad';msg.textContent='Could not reach the server.';});};
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
