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
    'html.nav-glass header.top .brand h1{font-size:var(--oh-title);line-height:1.02;text-wrap:balance}'+
    'html.nav-glass header.top .brand p{font-size:clamp(15px,calc(var(--oh-title) * .45),24px);line-height:1.15;margin-top:4px}'+
    '@media (min-width:'+BREAK+'px){'+
      'html.nav-glass .gn{justify-content:flex-end;padding-right:24px}'+
      'html.nav-glass header.top{margin-top:calc(-1 * var(--gn-h,58px));padding:8px 28px 0;position:relative;z-index:46;pointer-events:none}'+
      'html.nav-glass header.top .brand,html.nav-glass header.top .tools{pointer-events:auto}'+
      'html.nav-glass header.top .brand{padding-right:calc(var(--nav-w,640px) + 16px)}'+
    '}';
  /* 901 to 949 px: the layouts are two-column but the header is stacked (nav above the title), so the map is shorter than from 950 */
  css+='@media (min-width:901px) and (max-width:'+(BREAK-1)+'px){html.sub-glass.mapopts.nav-glass body #stage{height:calc(100svh - 261px)}html.nav-glass body.arc .layout #stage{height:calc(100svh - 250px)}}';
  var s=document.createElement('style');s.id='hdr-css';s.textContent=css;document.head.appendChild(s);
  /* measure the nav bar and pill so the title block can sit level with the pill and wrap before it (nav.js builds them after this file loads, so look until they exist) */
  var root=document.documentElement,tries=0,watching=false;
  function sync(){var bar=document.getElementById('gnBar'),pill=bar&&bar.querySelector('.gp-wrap');if(!pill)return false;
    root.style.setProperty('--gn-h',bar.offsetHeight+'px');root.style.setProperty('--nav-w',Math.ceil(pill.getBoundingClientRect().width)+'px');return true;}
  function watch(){if(watching)return;var bar=document.getElementById('gnBar');if(!bar)return;watching=true;
    if(window.ResizeObserver){var ro=new ResizeObserver(sync);ro.observe(bar);var pill=bar.querySelector('.gp-wrap');if(pill)ro.observe(pill);}
    window.addEventListener('resize',sync);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(sync);}
  (function poll(){if(sync()){watch();return;}if(++tries<120)requestAnimationFrame(poll);})();
  window.OJJHeader={BREAK:BREAK};
})();
