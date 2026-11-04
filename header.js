/* ONE shared header standard (Header_Final_v1, LOCKED by Jeffrey 2026-11-01). Loaded after nav.js on Events, Movements, JewHate, Archaeology, Thank Jews?, Islamic Conquest and Quiz.
   One switch point, 950 px: from 950 px the nav pill sits top right, level with the title; below it the pill sits centred above the title.
   Title is fluid at every width (36 px at 390, 42 at 768, 51 at 1024, 63 at 1366, 64 at 1920) and may wrap to two lines. The tagline follows the title size.
   The pill itself (compact, fluid text 14 to 17 px, items 36 to 40 px, swipe with a gold cue arrow below about 655 px) lives in pill.js and nav.js; nav order is in nav.js.
   Nothing else may set the wide nav position or the title size: subnav.js and jewhate.css used to, and no longer do. */
(function(){
  if(window.OJJHeader)return;
  var BREAK=950;
  /* --oh-title: piecewise linear through the locked points (390, 36) (768, 42) (1024, 51) (1366, 63) (1920, 64) */
  var css=':root{--oh-title:clamp(32px,calc(36px + (100vw - 390px) * .01587),42px)}'+
    '@media (min-width:768px){:root{--oh-title:calc(42px + (100vw - 768px) * .03512)}}'+
    '@media (min-width:1366px){:root{--oh-title:min(64px,calc(63px + (100vw - 1366px) * .0018))}}'+
    'html.nav-glass header.top .brand h1{font-size:var(--oh-title);line-height:1.02}'+
    'html.nav-glass header.top .brand p{font-size:clamp(15px,calc(var(--oh-title) * .45),24px);line-height:1.15;margin-top:4px}'+
    '@media (min-width:'+BREAK+'px){'+
      'html.nav-glass .gn{justify-content:flex-end;padding-right:24px}'+
      'html.nav-glass header.top{margin-top:calc(-1 * var(--gn-h,58px));padding:8px 28px 0;position:relative;z-index:46;pointer-events:none}'+
      'html.nav-glass header.top .tools{pointer-events:auto}'+
      /* the title's first line wraps beside the nav (a float the height of the nav bar); everything below the nav row, including the tagline, uses the full width. The brand block is click-through so the nav under it stays clickable. */
      'html.nav-glass header.top .brand{pointer-events:none}html.nav-glass header.top .brand h1 a,html.nav-glass header.top .brand p{pointer-events:auto}'+
      'html.nav-glass header.top .brand h1::before{content:"";float:right;width:calc(var(--nav-w,640px) + 16px);height:calc(var(--gn-h,58px) - 8px)}'+
    '}';
  /* 901 to 949 px: the layouts are two-column but the header is stacked (nav above the title), so the map is shorter than from 950 */
  css+='@media (min-width:901px) and (max-width:'+(BREAK-1)+'px){html.sub-glass.mapopts.nav-glass body #stage{height:calc(100svh - 261px)}html.nav-glass body.arc .layout #stage{height:calc(100svh - 250px)}}';
  var s=document.createElement('style');s.id='hdr-css';s.textContent=css;document.head.appendChild(s);
  /* measure the nav bar and pill so the title block can sit level with the pill and wrap before it (nav.js builds them after this file loads, so look until they exist) */
  var root=document.documentElement,tries=0,watching=false;
  /* The locked title is bigger than the old one and may wrap, so from 950 px the header is taller than the map heights assumed. Give the map back the difference so the page does not scroll more than before
     (old brand block: about 80 px from 1240 px, 54 px below; the Quiz page's #stage is a card area, not a map, so it is left alone). */
  var isMapPage=location.pathname.indexOf('quiz')<0;
  function fitMap(){var st=document.getElementById('stage'),br=document.querySelector('header.top .brand');if(!st||!br||!isMapPage)return;
    st.style.height='';if(window.innerWidth<BREAK)return;
    var nat=parseFloat(getComputedStyle(st).height),extra=Math.max(0,Math.round(br.offsetHeight-(window.innerWidth>=1240?80:54)));
    if(nat>0&&extra>0)st.style.height=Math.max(300,nat-extra)+'px';}
  function sync(){var bar=document.getElementById('gnBar'),pill=bar&&bar.querySelector('.gp-wrap');if(!pill)return false;
    var tp=document.querySelector('header.top');if(tp)root.style.setProperty('--hdr-h',tp.offsetHeight+'px');   /* F-171: the card panel on Events and Movements is sized from the real header height */
    root.style.setProperty('--gn-h',bar.offsetHeight+'px');root.style.setProperty('--nav-w',Math.ceil(pill.getBoundingClientRect().width)+'px');fitMap();return true;}
  function watch(){if(watching)return;var bar=document.getElementById('gnBar');if(!bar)return;watching=true;
    if(window.ResizeObserver){var ro=new ResizeObserver(sync);ro.observe(bar);var pill=bar.querySelector('.gp-wrap');if(pill)ro.observe(pill);var br=document.querySelector('header.top .brand');if(br)ro.observe(br);}
    window.addEventListener('resize',sync);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(sync);}
  (function poll(){if(sync()){watch();return;}if(++tries<120)requestAnimationFrame(poll);})();
  window.OJJHeader={BREAK:BREAK};
})();
