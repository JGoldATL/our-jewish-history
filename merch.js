/* Merchandise page (v2.3.0). Display only: no prices, no buy buttons, no capture, no explanation of any joke.
   Wording below is verbatim from the Merchandise package (2026-10-28). Do not edit it without Jeffrey.
   Art tiles are live text styled in CSS, sized from the tile width (cqw), so the layout is identical at every size and the two-line eviction layout stays exact.
   The unapproved brainstorm lines are NOT in this file or anywhere in the site: a static public page cannot protect them. */
(function(){
  var APPROVED='Approved working concept',OPEN='Approved, wording open',EXPLORE='Selected for exploration';
  var SHOFAR='<svg class="mark" viewBox="0 0 60 40" aria-hidden="true"><path d="M3 22c14 0 24-12 34-12 12 0 20 8 20 14 0 5-5 8-10 6-4-1-4-6-8-6-8 0-16 14-36 14z" fill="currentColor"/></svg>';
  var DOOR='<svg class="door" viewBox="0 0 60 80" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="34" height="72"/><circle cx="46" cy="30" r="5" fill="currentColor"/><path d="M46 36v18M46 42l-8 8M46 42l7 8M46 54l-7 14M46 54l6 14"/></svg>';
  var C=[
    {id:1,pill:APPROVED,tone:'night',cls:'',lines:[['tour','Billy Ray Sheit']],label:'Billy Ray Sheit'},
    {id:2,pill:APPROVED,tone:'cream',cls:'',lines:[['l big','Shofar So Good']],extra:SHOFAR,label:'Shofar So Good'},
    {id:3,pill:APPROVED,tone:'amber',cls:'',lines:[['l big it','Next Year in Boca?']],label:'Next Year in Boca?'},
    {id:4,pill:APPROVED,tone:'night',cls:'',lines:[['l','Shema Yisrael.'],['l it','We Ain’t Going Nowhere.']],label:'Shema Yisrael. We Ain’t Going Nowhere.'},
    {id:5,pill:APPROVED,tone:'cream',cls:'',lines:[['l it','You’ve Been Trying for 3,000 Years.']],label:'You’ve Been Trying for 3,000 Years.'},
    {id:6,pill:APPROVED,tone:'night',cls:'',lines:[['l','The Chosen People.'],['l it','No Opt-Outs.']],label:'The Chosen People. No Opt-Outs.'},
    {id:7,pill:OPEN,tone:'amber',cls:'',lines:[['l big','Dayenu.'],['l it','But We Keep On Going.']],label:'Dayenu. But We Keep On Going.'},
    {id:8,pill:APPROVED,tone:'cream',cls:'',lines:[['l it','We\u2019ve Been Evicted From Better Countries.']],label:'We\u2019ve Been Evicted From Better Countries.'},
    {id:9,pill:APPROVED,tone:'night',cls:'evict',lines:[['l','3,000 YEARS OF EVICTIONS.'],['l l2','WE KNOW THE MARKET.']],label:'3,000 YEARS OF EVICTIONS. WE KNOW THE MARKET.'},
    {id:10,pill:EXPLORE,tone:'cream',cls:'',lines:[['l big','L’Dor V’Dor']],extra:DOOR,label:'L’Dor V’Dor'},
    {id:11,pill:EXPLORE,tone:'amber',cls:'',lines:[['l it','I Hope You Like My']],shert:true,label:'I Hope You Like My BaSHERT.'}
  ];
  function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;}
  function tile(c){
    var t=el('div','tile '+c.tone+(c.cls?' '+c.cls:''));
    c.lines.forEach(function(l){t.appendChild(el('span',l[0]==='tour'?'l tour':l[0],l[1]));});
    if(c.shert){var s=el('span','l big');s.appendChild(document.createTextNode('Ba'));var sh=el('span','shert','SHERT');s.appendChild(sh);s.appendChild(document.createTextNode('.'));t.appendChild(s);}
    if(c.extra){var w=document.createElement('span');w.innerHTML=c.extra;t.appendChild(w.firstChild);}
    t.setAttribute('role','img');t.setAttribute('aria-label',c.label);
    var w=el('div','tw');w.appendChild(t);return w;
  }
  var grid=document.getElementById('grid'),dlg=document.getElementById('detail'),dT=document.getElementById('dTile'),dP=document.getElementById('dPill'),last=null;
  C.forEach(function(c){
    var li=el('li'),b=el('button','card');b.type='button';b.setAttribute('aria-label',c.label+'. '+c.pill+'. Open larger view.');
    b.appendChild(tile(c));b.appendChild(el('span','pillS',c.pill));
    b.addEventListener('click',function(){last=b;dT.textContent='';dT.appendChild(tile(c));dP.textContent=c.pill;if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','');});
    li.appendChild(b);grid.appendChild(li);
  });
  function close(){if(dlg.close)dlg.close();else dlg.removeAttribute('open');if(last)last.focus();}
  document.getElementById('dClose').addEventListener('click',close);
  dlg.addEventListener('click',function(e){if(e.target===dlg)close();});
  window.OJJMerch={concepts:C.map(function(c){return {id:c.id,label:c.label,pill:c.pill};})};
})();
