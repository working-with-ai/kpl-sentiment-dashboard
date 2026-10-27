import {modules} from './modules.js';
const nav=document.getElementById('module-nav'),panels=document.getElementById('module-panels'),alertRoot=document.getElementById('global-alerts'),alertButton=document.getElementById('global-alerts-button'),error=document.getElementById('module-error');
const initialized=new Map(),scrolls=new Map(JSON.parse(sessionStorage.getItem('kpl-module-scroll')||'[]'));let activeId='',routeRequest=0;
const themeButton=document.getElementById('theme-toggle');
function renderTheme(){themeButton.textContent=document.documentElement.dataset.theme==='dark'?'浅色模式':'深色模式';}
renderTheme();themeButton.onclick=()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;localStorage.setItem('kpl-theme',theme);renderTheme();window.dispatchEvent(new Event('themechange'));};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',event=>{if(!localStorage.getItem('kpl-theme')){document.documentElement.dataset.theme=event.matches?'dark':'light';renderTheme();window.dispatchEvent(new Event('themechange'));}});
nav.innerHTML=modules.map(module=>`<a class="shell-nav-link" href="#/${module.id}" data-module="${module.id}"><span class="shell-nav-symbol" aria-hidden="true">${module.symbol}</span>${module.name}</a>`).join('');
for(const module of modules){const panel=document.createElement('section');panel.id='module-'+module.id;panel.className=module.id+'-module';panel.hidden=true;panel.setAttribute('aria-label',module.name);panels.append(panel);}
function navigate(route){location.hash='/'+route;}
function setMonitor({enabled,source,date,count,alertsEnabled,error}){
 const status=document.getElementById('monitor-status');status.textContent=enabled?(error?'监控查询失败 · 保留上次数据':source==='realtime'?'资金监控中 · 每10秒刷新':'资金监控中 · 当前数据 '+date):'资金监控未开启';status.parentElement.dataset.live=String(enabled&&source==='realtime');alertButton.textContent=alertsEnabled?'条件命中 · '+count+' 只':'资金提醒 · 已关闭';
}
function ensureModule(module,route){
 if(!initialized.has(module.id)){
  const panel=document.getElementById('module-'+module.id);panel.innerHTML='<p class="shell-module-loading">正在加载'+module.name+'…</p>';
  initialized.set(module.id,(async()=>{
   const response=await fetch(new URL('./modules/'+module.id+'/view.html',import.meta.url));if(!response.ok)throw new Error('模块加载失败，请刷新重试');panel.innerHTML=await response.text();
   if(module.id==='capital-radar'){const response=await fetch(new URL('./modules/capital-radar/alerts.html',import.meta.url));if(!response.ok)throw new Error('提醒界面加载失败');alertRoot.innerHTML=await response.text();}
   const loaded=await module.load(),instance=await loaded.init(panel,{alertRoot,navigate,setMonitor,initialRoute:route});
   if(module.id==='capital-radar'){alertButton.disabled=false;alertButton.onclick=instance.openAlerts;}return instance;
  })());
 }
 return initialized.get(module.id);
}
async function showRoute(){
 const request=++routeRequest,[path,query='']=location.hash.slice(2).split('?'),parts=path.split('/'),module=modules.find(item=>item.id===parts[0])||modules[0],route={code:parts[1]==='stock'&&/^\d{6}$/.test(parts[2])?parts[2]:null,date:new URLSearchParams(query).get('date')||'latest',period:new URLSearchParams(query).get('period')||'trend'};
 if(!parts[0]||!modules.some(m=>m.id===parts[0]))history.replaceState(null,'','#/'+module.id);
 const changed=activeId!==module.id;if(changed&&activeId){scrolls.set(activeId,window.scrollY);sessionStorage.setItem('kpl-module-scroll',JSON.stringify([...scrolls]));}activeId=module.id;
 for(const item of modules)document.getElementById('module-'+item.id).hidden=item.id!==module.id;
 for(const [id,promise] of initialized)if(id!==module.id)promise.then(instance=>instance.route?.({code:null}));
 nav.querySelectorAll('a').forEach(link=>{if(link.dataset.module===module.id)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
 document.getElementById('module-title').textContent=module.name;document.title='开盘数据 · '+module.name;error.hidden=true;
 try{const instance=await ensureModule(module,route);if(request!==routeRequest)return;await instance.route?.(route);if(changed)requestAnimationFrame(()=>window.scrollTo(0,scrolls.get(module.id)||0));}catch(e){if(request===routeRequest){error.textContent=e.message;error.hidden=false;}}
}
window.addEventListener('pagehide',()=>{if(activeId)scrolls.set(activeId,window.scrollY);sessionStorage.setItem('kpl-module-scroll',JSON.stringify([...scrolls]));});
window.addEventListener('hashchange',showRoute);showRoute();
