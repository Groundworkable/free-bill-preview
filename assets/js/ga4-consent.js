/* Groundwork GA4 restoration (historical ID independently verified).
   Consent-first: no Google requests before explicit permission; no ad signals.
   This review code is NOT deployed or authorized for publication. */
(function(){
"use strict";
if(!["groundworkbyable.online","www.groundworkbyable.online"].includes(location.hostname))return;
const MEASUREMENT="G-KZSJ1W4PXH", KEY="groundwork-analytics-consent-v1";
const gpc=navigator.globalPrivacyControl===true;
let choice=null, loaded=false;
try{const v=localStorage.getItem(KEY);if(v==="granted"||v==="denied")choice=v}catch(_){}
function setChoice(v){choice=v;try{localStorage.setItem(KEY,v)}catch(_){}}
function consent(storage){return {analytics_storage:storage,ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied"}}
function loadGa(){
 if(gpc||choice!=="granted"||loaded||typeof window.gtag==="function")return;
 loaded=true;
 window.dataLayer=window.dataLayer||[];
 window.gtag=function(){window.dataLayer.push(arguments)};
 window.gtag("consent","default",consent("denied"));
 window.gtag("consent","update",consent("granted"));
 window.gtag("js",new Date());
 window.gtag("config",MEASUREMENT,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
 const tag=document.createElement("script");
 tag.async=true;tag.id="groundwork-ga4-consented";tag.src="https://www.googletagmanager.com/gtag/js?id="+MEASUREMENT;
 document.head.appendChild(tag);
 // Never send the query string, hash, calculator amounts, or entered details.
 window.gtag("event","page_view",{page_location:location.origin+location.pathname,page_path:location.pathname,page_title:document.title});
}
function dropGaCookies(){
 const names=document.cookie.split(";").map(s=>s.trim().split("=")[0]).filter(n=>/^_ga($|_)/.test(n));
 for(const name of names)for(const domain of ["","domain="+location.hostname+";","domain=.groundworkbyable.online;"])
  document.cookie=name+"=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;"+domain+"SameSite=Lax";
}
function setup(){
 if(document.getElementById("groundwork-consent-ui"))return;
 const host=document.createElement("div");host.id="groundwork-consent-ui";
 const shadow=host.attachShadow({mode:"open"});
 shadow.innerHTML=[
 '<style>:host{all:initial;font-family:Arial,sans-serif;color:#f9f3e5}',
 '.switch{position:fixed;z-index:2147483000;bottom:10px;right:10px;background:#08352b;color:#fff4dc;border:1px solid #c0a568;padding:7px 12px;border-radius:17px;font:600 12px Arial;cursor:pointer}',
 '.panel{position:fixed;z-index:2147483001;right:10px;bottom:48px;width:min(390px,calc(100vw - 20px));box-sizing:border-box;background:#092e25;color:#f9f3e5;border:1px solid #d3b476;box-shadow:0 6px 24px #0008;padding:14px 16px;border-radius:11px;font:14px/1.5 Arial,sans-serif}',
 '.panel[hidden]{display:none}.heading{font-weight:700;font-size:15px;margin-bottom:6px}.copy{margin-bottom:12px}',
 'a{color:#f5d792}.actions{display:flex;flex-wrap:wrap;gap:9px}.actions button{cursor:pointer;border:1px solid #e1c986;border-radius:6px;padding:8px 12px;font:600 13px Arial,sans-serif}',
 '.decline{background:#204e3c;color:#fff}.accept{background:#e3c878;color:#07362a}',
 'button:focus-visible{outline:3px solid white;outline-offset:2px}</style>',
 '<button type="button" class="switch" aria-expanded="false">Privacy choices</button>',
 '<section class="panel" role="region" aria-label="Optional website analytics" hidden>',
 '<div class="heading">Optional website analytics</div>',
 '<div class="copy">Groundwork uses Google Analytics only if you allow it. ',
 'No calculator or financial inputs are collected by this feature. ',
 '<a href="/privacy.html">Privacy Policy</a>.</div>',
 '<div class="actions"><button class="decline" type="button">Decline analytics</button>',
 '<button class="accept" type="button">Allow analytics</button></div></section>'
 ].join("");
 document.body.appendChild(host);
 // The Tour uses a fixed bottom action bar. Place optional privacy controls above it.
 if(/^\/tour(?:\/|\.html|$)/.test(location.pathname)){
  const style=document.createElement("style");
  style.textContent=".switch{bottom:84px;right:12px}.panel{bottom:124px}@media(max-width:830px){.switch{bottom:81px;right:10px}.panel{bottom:118px}}";
  shadow.appendChild(style);
 }
 const toggle=shadow.querySelector(".switch"), panel=shadow.querySelector(".panel");
 const allow=shadow.querySelector(".accept"), decline=shadow.querySelector(".decline");
 function show(value){panel.hidden=!value;toggle.setAttribute("aria-expanded",String(value));if(gpc){allow.disabled=true;allow.title="Your browser's Global Privacy Control signal is honored";}}
 toggle.addEventListener("click",()=>show(panel.hidden));
 allow.addEventListener("click",()=>{if(gpc)return;setChoice("granted");show(false);loadGa()});
 decline.addEventListener("click",()=>{
  if(loaded&&typeof window.gtag==="function")window.gtag("consent","update",consent("denied"));
  const wasLoaded=loaded;setChoice("denied");dropGaCookies();show(false);
  if(wasLoaded)location.reload();
 });
 if(choice===null&&!gpc)show(true);
 loadGa();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup,{once:true});else setup();
}());
