/* One Share control for every card on the site (JewHate cards and entry pages, Events and Movements cards, old globe).
   Device share sheet where there is one; otherwise the link is copied and the button says "Link copied".
   Shares a link and a title only, never body text (never the lie on its own), and never a ?drafts=1 link. */
(function(){
  var ICON='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  try{var st=document.createElement('style');st.textContent=
    '.ojj-share{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:44px;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid rgba(239,230,211,.28);background:rgba(239,230,211,.08);color:#EFE6D3;font:600 14px "Instrument Sans",Arial,sans-serif;cursor:pointer;box-sizing:border-box}'+
    '.ojj-share:hover{border-color:#E8B27A}.ojj-share:focus-visible{outline:2px solid #E8B27A;outline-offset:2px}'+
    '.ojj-share.icon{padding:0;width:44px}.ojj-share .t{white-space:nowrap}'+
    '#story>.ojj-share,#story>.shareSlot{position:absolute;top:8px;right:58px;z-index:3;margin:0}.shareSlot[hidden]{display:none}@media (max-width:900px){#story>.ojj-share,#story>.shareSlot{top:0;right:34px}#story h2{padding-right:50px}}'+
    '.ojj-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}';
    document.head.appendChild(st);}catch(e){}
  // Opening line for each kind of page (Jeffrey 10/20). Change the wording here only. The JewHate line stops before any claim, so a lie is never put in a message by itself.
  var MESSAGES={
    jewhate:'I thought you\u2019d enjoy this. Did you know that Jews\u2026',
    thankjews:'Did you know Jews are responsible for this\u2026',
    events:'Take a peek at this event from Jewish history\u2026',
    movements:'Follow the Jewish journey with me\u2026',
    archaeology:'Who said Jewish history wasn\u2019t real? Check this out:'
  };
  /* F-062: every shared link carries utm_source=share (the same tag the quiz share link uses), so Google Analytics can tell a friend's arrival from any other visit. It adds no tracking of the sender or the recipient. */
  function cleanUrl(u){var x=new URL(u,location.href);x.searchParams.delete('drafts');x.searchParams.set('utm_source','share');return x.href;}
  /* F-107: count Share taps in Google Analytics ("Shares started"). Sent when the button is tapped, whether or not the person finishes sharing.
     Only the kind of page and how it shared go out: never the title, the link, the card or any quiz answer. No gtag (blocked, or not the live host) means nothing happens. */
  function track(kind,method){try{if(typeof window.gtag==='function')window.gtag('event','share',{content_type:kind||'card',method:method,page_path:location.pathname});}catch(e){}}
  window.OJJShare={messages:MESSAGES,track:track,
    /* make({title, url|getUrl, getTitle, label:true|false}) returns the button */
    make:function(o){
      var b=document.createElement('button');b.type='button';b.className='ojj-share'+(o.label===false?' icon':'');
      b.innerHTML=ICON+(o.label===false?'':'<span class="t">Share</span>');
      var live=document.createElement('span');live.className='ojj-sr';live.setAttribute('role','status');
      function title(){return o.getTitle?o.getTitle():o.title;}
      function url(){return cleanUrl(o.getUrl?o.getUrl():o.url);}
      function lab(){b.setAttribute('aria-label','Share: '+(title()||'this card'));}
      lab();b.addEventListener('focus',lab);b.addEventListener('mouseenter',lab);
      b.addEventListener('click',function(ev){
        ev.stopPropagation();
        track(o.kind,navigator.share?'share_sheet':'copy_link');
        var u=url(),txt=MESSAGES[o.kind]||'',data={title:title(),url:u};if(txt)data.text=txt;
        function copied(){live.textContent='Link copied';var t=b.querySelector('.t');if(t)t.textContent='Link copied';else b.title='Link copied';
          setTimeout(function(){live.textContent='';if(t)t.textContent='Share';else b.removeAttribute('title');},2000);}
        function copy(){try{navigator.clipboard.writeText(txt?txt+' '+u:u).then(copied,function(){window.prompt('Copy this link',txt?txt+' '+u:u);});}catch(x){window.prompt('Copy this link',txt?txt+' '+u:u);}}
        if(navigator.share){navigator.share(data).catch(function(err){if(err&&err.name!=='AbortError')copy();});}else copy();
      });
      var w=document.createDocumentFragment();w.appendChild(b);w.appendChild(live);b._frag=w;return b;
    },
    attach:function(parent,o){var b=this.make(o);parent.appendChild(b._frag);return b;}
  };
})();
