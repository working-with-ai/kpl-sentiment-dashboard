import {modules} from './modules.js';
const nav=document.getElementById('module-nav'),panels=document.getElementById('module-panels'),alertRoot=document.getElementById('global-alerts'),alertButton=document.getElementById('global-alerts-button'),error=document.getElementById('module-error');
const initialized=new Map();
nav.innerHTML=modules.map(module=>`<a class="shell-nav-link" href="#/${module.id}" data-module="${module.id}"><span class="shell-nav-symbol" aria-hidden="true">${module.symbol}</span>${module.name}</a>`).join('');
for(const module of modules){const panel=document.createElement('section');panel.id='module-'+module.id;panel.className=module.id+'-module';panel.hidden=true;panel.setAttribute('aria-label',module.name);panels.append(panel);}
function navigate(id){location.hash='/'+id;showRoute();}
function setMonitor({enabled,source,date,count,alertsEnabled,error}){
 const status=document.getElementById('monitor-status');
 status.textContent=enabled?(error?'监控查询失败 · 保留上次数据':source==='realtime'?'实时监控中 · 每10秒刷新':'监控已开启 · 当前为 '+date+' 历史数据'):'实时监控未开启';
 status.parentElement.dataset.live=String(enabled&&source==='realtime');
 alertButton.textContent=alertsEnabled?'资金提醒 · '+count+' 只':'资金提醒 · 已关闭';
}
function ensureModule(module){
 if(!initialized.has(module.id)){
  const panel=document.getElementById('module-'+module.id);
  panel.innerHTML='<p class="shell-module-loading">正在加载'+module.name+'…</p>';
  initialized.set(module.id,(async()=>{
   const response=await fetch(new URL('./modules/'+module.id+'/view.html',import.meta.url));
   if(!response.ok)throw new Error('模块加载失败，请刷新页面重试');
   panel.innerHTML=await response.text();
   if(module.id==='capital-radar'){
    const response=await fetch(new URL('./modules/capital-radar/alerts.html',import.meta.url));
    if(!response.ok)throw new Error('提醒界面加载失败，请刷新页面重试');
    alertRoot.innerHTML=await response.text();
   }
   const loaded=await module.load(),instance=await loaded.init(panel,{alertRoot,navigate,setMonitor});
   if(module.id==='capital-radar'){alertButton.disabled=false;alertButton.onclick=instance.openAlerts;}
   return instance;
  })());
 }
 return initialized.get(module.id);
}
async function showRoute(){
 const id=location.hash.slice(2)||'sentiment',module=modules.find(item=>item.id===id)||modules[0];
 if(location.hash!=='#/'+module.id)history.replaceState(null,'','#/'+module.id);
 for(const item of modules)document.getElementById('module-'+item.id).hidden=item.id!==module.id;
 nav.querySelectorAll('a').forEach(link=>{if(link.dataset.module===module.id)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
 document.getElementById('module-title').textContent=module.name;
 document.title='开盘数据 · '+module.name;
 error.hidden=true;
 try{await ensureModule(module);}catch(e){error.textContent=e.message;error.hidden=false;}
}
window.addEventListener('hashchange',showRoute);
showRoute();
