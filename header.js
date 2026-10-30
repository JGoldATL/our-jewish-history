/* ONE shared header standard (Creative Design comp 10/27, CEO-approved). Loaded after nav.js on Events, Movements, JewHate and Archaeology.
   Wide (1140 px and up: with six nav items the nav is 544 px wide and the widest title, "The History of JewHate" at 50 px, needs about 560 px beside it): the nav pill sits top right and level with the title; one title size everywhere.
   Narrower: the nav pill stays centered above the title (nav.js default). Phones are not changed here (the v2.2.0 dock replaces the top nav on phones).
   Nothing else may set the wide nav position or the title size: subnav.js and jewhate.css used to, and no longer do. */
(function(){
  if(window.OJJHeader)return;
  var BREAK=1140,TITLE=50,TAG=23;   // 1140: with six items (Thank Jews added) the nav is 544 px wide and the widest title needs about 560 px beside it
  var css='@media (min-width:'+BREAK+'px){'+
    'html.nav-glass .gn{justify-content:flex-end;padding-right:24px}'+
    'html.nav-glass header.top{margin-top:-54px;padding:8px 28px 0;position:relative;z-index:46;pointer-events:none}'+
    'html.nav-glass header.top .brand,html.nav-glass header.top .tools{pointer-events:auto}'+
    'html.nav-glass header.top .brand h1{font-size:'+TITLE+'px}html.nav-glass header.top .brand p{font-size:'+TAG+'px}'+
  '}';
  /* 901-1139 px: the layouts are two-column but the header is stacked (nav above the title), so the map is 54 px shorter than at 1000 and up */
  css+='@media (min-width:901px) and (max-width:'+(BREAK-1)+'px){html.sub-glass.mapopts.nav-glass body #stage{height:calc(100svh - 261px)}html.nav-glass body.arc .layout #stage{height:calc(100svh - 250px)}}';
  var s=document.createElement('style');s.id='hdr-css';s.textContent=css;document.head.appendChild(s);
  window.OJJHeader={BREAK:BREAK,TITLE:TITLE,TAG:TAG};
})();
