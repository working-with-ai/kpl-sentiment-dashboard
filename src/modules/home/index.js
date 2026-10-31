import {apiUrl} from '../../config.js';

export async function init(root,{navigate,openAlerts,toggleTheme}){
 const $=id=>root.querySelector('#'+id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),asset=name=>'src/modules/home/assets/'+name;
 const names={menu:'功能入口',banners:'横幅',tomorrow:'明天炒什么',themes:'题材库',articles:'推荐文章',popularity:'开盘啦人气榜',abnormal:'严重异动提醒',ai:'AI快讯',strongest:'最强风口',mood:'市场情绪',topics:'最新主题',vane:'风向标',active:'近期活跃板块',wind:'市场风口'};
 let data={},loading=false,controller,queryController,queryVersion=0,stockRequest=0,searchTimer,toastTimer,menuPage=0,bannerPage=0,lastPoll=0;
 const groups={};
 const color=v=>parseFloat(v)>0?'home-up':parseFloat(v)<0?'home-down':'home-neutral';
 const percent=v=>v===null||v===undefined||v===''?'—':(Number(v)>0?'+':'')+Number(v).toFixed(2)+'%';
 const fixed=v=>v===null||v===undefined||v===''?'—':Number(v).toFixed(2);
 const stamp=(value,format='date')=>{if(!value)return '';const d=/^\d+$/.test(String(value))?new Date(Number(value)*1000):new Date(String(value)+'T00:00:00+08:00');return Number.isNaN(d.valueOf())?'':format==='time'?d.toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):d.toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit'}).replace('/','-')+(format==='full'?' '+d.toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false,hour:'2-digit',minute:'2-digit'}):'');};
 const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
 const imageUrl=value=>{const url=safeUrl(value);return url?apiUrl('/api/home/image?'+new URLSearchParams({url})):'';};
 const img=(url,cls='',alt='')=>url?`<img class="${cls}" src="${esc(imageUrl(url))}" alt="${esc(alt)}" loading="lazy">`:'';
 function toast(text){clearTimeout(toastTimer);$('home-toast').textContent=text;$('home-toast').hidden=false;toastTimer=setTimeout(()=>$('home-toast').hidden=true,3500);}
 const notReady=name=>toast(name+'详情尚未接入');
 function external(url){const target=safeUrl(url);if(target)window.open(target,'_blank','noopener,noreferrer');else notReady('该内容');}
 function remember(key,rows){groups[key]=[...new Map(rows.filter(r=>/^(?!80|88)\d{6}$/.test(String(r[0]))).map(r=>[r[0],r])).values()];sessionStorage.setItem('kpl-home-stocks',JSON.stringify(groups));}
 function stock(code,name,group,cls=''){if(!/^(?!80|88)\d{6}$/.test(String(code)))return `<span class="${cls}">${esc(name)}</span>`;return `<button class="home-stock-button ${cls}" type="button" data-stock="${esc(code)}" data-group="${group}">${esc(name)}</button>`;}
 async function goStock(code,group){
  const request=++stockRequest,section=data[group];let actual=section?._stockDate||section?._dataDate||data.popularity?._dataDate||data.mood?._dataDate||'latest';
  try{
   if(group==='search'){const response=await fetch(apiUrl('/api/stock/quote?'+new URLSearchParams({code,date:'latest'})),{signal:AbortSignal.timeout(15000)}),quote=await response.json();if(!response.ok||quote.error)throw new Error(quote.error||'该代码暂无行情');actual=quote._dataDate||actual;}
   if(request!==stockRequest||root.hidden)return;const today=new Date(Date.now()+28800000).toISOString().slice(0,10),date=actual===today?'latest':actual;navigate('capital-radar/stock/'+code+'?'+new URLSearchParams({date,period:'trend',from:'home',group}));
  }catch(error){if(request===stockRequest)toast(error.message);}
 }
 function tags(rows,group){return `<div class="home-tags">${(rows||[]).slice(0,2).map(r=>`<${/^(?!80|88)\d{6}$/.test(String(r[0]))?'button type="button" data-stock="'+esc(r[0])+'" data-group="'+group+'"':'span'}>${esc(r[1])} <b class="${color(r[2])}">${esc(String(r[2]).includes('%')?r[2]:percent(r[2]))}</b></${/^(?!80|88)\d{6}$/.test(String(r[0]))?'button':'span'}>`).join('')}</div>`;}
 function empty(section){return `<div class="home-unavailable"><span>${section._state==='empty'?'暂无数据':'该区域暂未取得数据'}</span><button type="button" data-retry>重试</button></div>`;}
 function menu(section){
  if(!section.data?.length){$('home-menu-pages').innerHTML=empty(section);return;}
  const entries=section.data.filter(item=>String(item.IsShow)!=='0'),pages=[];
  for(let i=0;i<entries.length;i+=10)pages.push(entries.slice(i,i+10));
  const dark=document.documentElement.dataset.theme==='dark';
  $('home-menu-pages').innerHTML=pages.map(items=>`<div class="home-menu-page">${items.map(item=>`<button class="home-menu-item" type="button" data-menu="${esc(item.id)}" data-name="${esc(item.name)}">${img(dark?item.image.replace(/(\.\w+)(\?.*)?$/,'_dark$1$2'):item.image)}${Number(item.LogoType)===2?'<img class="home-menu-hot" src="'+asset('menu-hot.png')+'" alt="热门">':''}<span>${esc(item.name)}</span></button>`).join('')}</div>`).join('');
  dots($('home-menu-dots'),pages.length,menuPage,index=>{$('home-menu-pages').scrollTo({left:index*$('home-menu-pages').clientWidth,behavior:'smooth'});});
  $('home-menu-pages').scrollLeft=menuPage*$('home-menu-pages').clientWidth;
 }
 function dots(target,count,current,action){target.innerHTML=Array.from({length:count},(_,i)=>`<button type="button" aria-label="第${i+1}页" aria-current="${current===i}" data-page="${i}"></button>`).join('');target.querySelectorAll('button').forEach(b=>b.onclick=()=>action(Number(b.dataset.page)));}
 function banners(section){
  const rows=section.data||[];if(!rows.length){$('home-banners').innerHTML=empty(section);return;}
  $('home-banners').innerHTML=`<div class="home-banner-track">${rows.map(r=>`<button class="home-banner-item" type="button" data-external="${esc(safeUrl(r.jump_url))}" aria-label="${esc(r.name||r.title)}">${img(r.img_url,'',r.name||r.title)}</button>`).join('')}</div><div class="home-dots" aria-label="横幅分页"></div>`;
  const track=$('home-banners').firstElementChild,dot=$('home-banners').lastElementChild;dots(dot,rows.length,bannerPage,index=>track.scrollTo({left:index*track.clientWidth,behavior:'smooth'}));track.scrollLeft=bannerPage*track.clientWidth;track.onscroll=()=>{bannerPage=Math.round(track.scrollLeft/track.clientWidth);dot.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-current',String(i===bannerPage)));};
 }
 function render(key,section){
  if(key==='menu'){menu(section);return;}if(key==='banners'){banners(section);return;}
  const box=root.querySelector('[data-section="'+key+'"]'),body=box.querySelector('.home-section-content'),date=box.querySelector('.home-date'),status=box.querySelector('.home-section-state'),rows=section.data;
  if(date)date.textContent=key==='popularity'?section.label||stamp(section._dataDate):key==='abnormal'&&section.dataSource&&section.dataSource!=='today'?'次日评估':stamp(section._dataDate);
  status.textContent=section._warning||'';status.dataset.state=section._state;
  if(rows===null||rows===undefined||Array.isArray(rows)&&!rows.length){body.innerHTML=empty(section);return;}
  if(key==='tomorrow')body.innerHTML=rows.map((r,i)=>`<div class="home-hot-topic"><span class="topic-number">${i+1}.</span><button type="button" data-more="tomorrow">${esc(r.Title)}</button><div class="home-heat">${esc(r.HotVal)}<img src="${asset('icon_hottalk_fire.png')}" alt="热度"></div></div>`).join('');
  if(key==='themes')body.innerHTML=rows.map(r=>`<div class="home-theme-row"><span class="home-theme-icon">${r.New?'新':'热'}</span><button type="button" data-more="themes">${esc(r.Name)}${Number(r.ZTNum)>0?'<span class="home-zt">'+esc(r.ZTNum)+'个涨停</span>':''}</button>${r.Hot?'<img class="home-hot-tag" src="'+asset('theme-hot.png')+'" alt="持续火爆">':r.UpNum?'<span class="home-theme-up">'+esc(r.UpNum)+' ↑</span>':''}</div>`).join('');
  if(key==='articles'){
   remember(key,rows.flatMap(r=>r.Stock||[]));
   body.innerHTML=rows.map(r=>{const picture=r.img?.List?.[0]||r.imgList?.List?.[0],url=safeUrl(r.Url||r.ShareUrl||r.url),id=r.TopicID?r.TopicID+';'+r.SpecType+';'+r.IsEditContent:r.ID;return `<article class="home-article ${picture?'':'no-image'}"><button type="button" class="home-article-title" ${url?'data-external="'+esc(url)+'"':'data-article="'+esc(id)+'"'}>${esc(r.Title)}</button>${img(picture,'home-article-image')}${tags(r.Stock,key)}<div class="home-article-info"><span>${esc(r.Account||'')}</span><time>${stamp(r.CreateTime,'full')}</time></div></article>`;}).join('');
  }
  if(key==='popularity'){
   remember(key,rows);body.innerHTML=rows.slice(0,3).map((r,i)=>`<div class="home-popularity-row"><div class="home-popularity-main"><span class="home-rank">${i+1}</span><div>${stock(r[0],r[1],key)}<span class="home-stock-code">${esc(r[0])}</span></div><span class="home-stock-rate ${color(r[2])}">${percent(r[2])}</span><span class="home-heat">${esc(r[7])}<img src="${asset('icon_hottalk_fire.png')}" alt="人气"></span></div><div class="home-popularity-tags">${Number(r[3])?'<b class="home-rank-change '+color(r[3])+'">'+(Number(r[3])>0?'↑':'↓')+Math.abs(Number(r[3]))+'</b>':''}${String(r[6]||'').split('|').filter(Boolean).map(s=>'<span class="'+(s.split(';')[1]==='4'?'home-tag-green':'')+'">'+esc(s.split(';')[0])+'</span>').join('')}</div>${r[10]?'<p class="home-popularity-description">'+esc(r[10])+'</p>':''}</div>`).join('');
  }
  if(key==='abnormal'){
   remember(key,[...rows,...(section.monitor||[]).map(s=>[s.StockID,s.StockName])]);const next=section.dataSource!=='today';body.innerHTML=`<table class="home-table"><thead><tr><th>股票名称</th><th>${next?'次日涨幅':'涨幅'}</th><th>触发异动涨幅<br>股票价格</th><th>次日触发异动<br>偏离值空间</th></tr></thead><tbody>${rows.slice(0,3).map(r=>`<tr><td>${stock(r[0],r[1],key)}<small>${esc(r[0])} <span class="home-abnormal-tag">${esc(String(r[10]||'').split('、')[0])}</span></small></td><td>${next?'0%':percent(r[3])}<small>${esc(r[19])}</small></td><td class="home-up">${percent(r[5])}<small>${fixed(r[6])}</small></td><td>${percent(r[9])}<small>${esc(r[12])}</small></td></tr>`).join('')}</tbody></table>${section.many?'<button type="button" class="home-abnormal-more" data-more="abnormal">查看更多异动个股（'+esc(section.many)+'） <span>›</span></button>':''}${section.monitor?.length?'<div class="home-monitor-line"><img src="'+asset('icon_plz_shouye_zdjk.png')+'" alt=""><span>新增重点监控：'+section.monitor.slice(0,2).map(r=>stock(r.StockID,r.StockName,key)).join('、')+'…</span></div>':''}`;
  }
  if(key==='ai'){
   const r=rows[0];remember(key,r.Stocks||[]);body.innerHTML=`<button class="home-ai-text" type="button" ${safeUrl(r.PushUrl)?'data-external="'+esc(safeUrl(r.PushUrl))+'"':'data-more="ai"'}><time class="home-up">${stamp(r.Time,'time')}</time> ${esc(r.Content||r.Title)}</button>${tags(r.Stocks,key)}<div class="home-ai-footer"><span>${r.Source?'来源：'+esc(r.Source):''}</span><button type="button" data-more="ai"><img src="${asset('img_ai_decode.png')}" alt="AI解读"></button></div>`;
  }
  if(key==='strongest'){
   remember(key,rows);body.innerHTML=`<table class="home-table"><thead><tr><th>股票名称</th><th>强度</th><th>涨跌幅</th><th>板块</th></tr></thead><tbody>${rows.slice(0,2).map(r=>`<tr><td>${stock(r[0],r[1],key)}<small>${esc(r[0])}</small></td><td>${esc(r[2])}</td><td class="${color(r[3])}">${percent(r[3])}</td><td style="color:var(--home-blue)">${esc(r[4])}</td></tr>`).join('')}</tbody></table>${section.locked?'<button type="button" class="home-lock" data-more="strongest"><img src="'+asset('icon_lock_red.png')+'" alt="">解锁查看更多数据</button>':''}`;
  }
  if(key==='mood'){
   const r=rows,up=Number(r.SZJS)||0,down=Number(r.XDJS)||0,total=up+down+(Number(r.PPJS)||0),billions=v=>v==null?'—':(Number(v)/10000).toFixed(0)+'亿';
   body.innerHTML=`<div class="home-mood-grid">${[['涨停板',r.tZhangTing,r.lZhangTing,'home-up'],['封板率',r.tFengBan==null?null:Number(r.tFengBan).toFixed(0)+'%',r.lFengBan==null?null:Number(r.lFengBan).toFixed(0)+'%','home-up'],['跌停板',r.tDieTing,r.lDieTing,'home-down']].map(([n,v,last,cls])=>`<div><div class="home-mood-title">${n}</div><div class="home-mood-value ${cls}">${esc(v??'—')} <small>/ ${esc(last??'—')}</small></div><div class="home-mood-labels">今日 昨日</div></div>`).join('')}</div><div class="home-breadth-bar"><span style="width:${total?up/total*100:0}%"></span><span style="width:${total?down/total*100:0}%"></span></div><div class="home-breadth-labels"><span class="home-up">涨${up}家</span><span class="home-down">跌${down}家</span></div>${[['上证量能',r.szln,r.s_zrcs,r.s_zrtj],['沪深京量能',r.hsjln,r.hsj_zrcs,r.hsj_zrtj]].map(([label,v,prior,all])=>`<div class="home-volume-row"><span>${label}</span><b class="${color(Number(v)-Number(prior))}">${billions(v)}</b><span>昨日此时 ${billions(prior)}</span><span>昨日总计 ${billions(all)}</span></div>`).join('')}`;
  }
  if(key==='topics'){
   remember(key,rows.flatMap(r=>(r.Stocks||[]).map(s=>[s.Code,s.Name,s.Rate])));
   body.innerHTML=rows.map(r=>`<div class="home-topic-row"><div class="home-topic-tile">${esc(r.ZSName||r.Kword)}</div><div class="home-topic-body"><button class="home-topic-title" type="button" data-more="topics">${esc(r.Title)}</button>${tags((r.Stocks||[]).map(s=>[s.Code,s.Name,s.Rate]),key)}</div></div>`).join('');
  }
  if(key==='vane'){
   const list=[...(rows.SZ||[]).slice(0,3),...(rows.XD||[]).slice(0,3)];remember(key,list);body.innerHTML=`<div class="home-vane-grid">${list.map(r=>`<button type="button" data-stock="${esc(r[0])}" data-group="${key}"><small>${esc(r[3])}</small><span>${esc(r[1])}</span><strong class="${color(r[2])}">${percent(r[2])}</strong></button>`).join('')}</div>`;
  }
  if(key==='active')body.innerHTML=`<div class="home-active-grid">${rows.slice(0,4).map(r=>`<div><button type="button" data-more="active">${esc(r[0])}</button><strong class="${color(r[1])}">${percent(r[1])}</strong></div>`).join('')}</div>`;
  if(key==='wind'){
   remember(key,rows.map(r=>[r.StockID,r.StockName,r.zhangfu]));body.innerHTML=`<div class="home-wind-cloud">${rows.map(r=>`<button type="button" class="${color(r.zhangfu)}" data-stock="${esc(r.StockID)}" data-group="${key}">${esc(r.StockName)}</button>`).join('')}</div>`;
  }
 }
 async function load(){
  if(loading||root.hidden||document.hidden)return;loading=true;lastPoll=Date.now();$('home-refresh').disabled=true;controller=new AbortController();
  try{
   const response=await fetch(apiUrl('/api/home'),{signal:controller.signal});if(!response.ok)throw new Error('首页查询失败');const result=await response.json();
   for(const [key,next] of Object.entries(result.sections)){
    const prior=data[key];if(prior?.data&&['unavailable','empty'].includes(next._state)&&next._state!=='empty'){next.data=prior.data;next._dataDate=prior._dataDate;next._retrievedAt=prior._retrievedAt;next._state='stale';}
    if(JSON.stringify(prior)!==JSON.stringify(next)){const changed=['data','_state','_dataDate','_stockDate','label','dataSource','many','monitor','locked'].some(field=>JSON.stringify(prior?.[field])!==JSON.stringify(next[field]));data[key]=next;if(changed)render(key,next);else if(!['menu','banners'].includes(key)){const box=root.querySelector('[data-section="'+key+'"]');box.querySelector('.home-section-state').textContent=next._warning||'';}}
   }
   const unavailable=Object.values(data).filter(s=>s._state==='unavailable'||s._state==='partial').length;$('home-asof').textContent='读取 '+new Date(result._retrievedAt).toLocaleTimeString('zh-CN',{hour12:false})+(unavailable?' · '+unavailable+' 个区域数据不完整':'');
   $('home-sources').innerHTML=Object.entries(data).map(([key,s])=>`<p>${names[key]} · ${s._dataDate||'未提供数据日期'} · ${esc(s._state)} · 读取 ${new Date(s._retrievedAt).toLocaleTimeString('zh-CN',{hour12:false})}${s._warning?' · '+esc(s._warning):''}</p>`).join('');
   root.querySelectorAll('.home-section-content img').forEach(i=>i.onerror=()=>{i.hidden=true;});
  }catch(error){if(error.name!=='AbortError')$('home-asof').textContent=error.message+(Object.keys(data).length?'，保留上次成功内容':'，点击刷新重试');}
  finally{loading=false;$('home-refresh').disabled=false;}
 }
 async function search(){
  const q=$('home-search-input').value.trim(),version=++queryVersion;queryController?.abort();$('home-search-results').replaceChildren();if(!q){$('home-search-status').textContent='';return;}queryController=new AbortController();$('home-search-status').textContent='正在搜索…';
  try{
   const response=await fetch(apiUrl('/api/stock/search?'+new URLSearchParams({q})),{signal:queryController.signal}),result=await response.json();if(version!==queryVersion)return;if(!response.ok)throw new Error(result.error||'搜索失败');
   const rows=result.items.map(item=>[item.code,item.name]);if(/^(?!80|88)\d{6}$/.test(q)&&!rows.some(r=>r[0]===q))rows.unshift([q,'查看 '+q+' 行情']);remember('search',rows);
   $('home-search-results').innerHTML=rows.map(([code,name])=>`<button type="button" class="home-search-result" data-stock="${esc(code)}" data-group="search"><strong>${esc(name)}</strong><span>${esc(code)} ›</span></button>`).join('');
   $('home-search-status').textContent=(rows.length?'找到 '+rows.length+' 条结果。':'未找到股票，可输入六位代码直接查询。')+' '+(result._warning||'');
  }catch(error){if(version===queryVersion&&error.name!=='AbortError')$('home-search-status').textContent=error.message;}
 }
 root.addEventListener('click',async event=>{
  const target=event.target.closest('button,a');if(!target)return;
  if(target.dataset.stock){$('home-search-dialog').close();goStock(target.dataset.stock,target.dataset.group);}
  else if(target.dataset.close)$(target.dataset.close).close();
  else if(target.dataset.menu){const id=target.dataset.menu;if(id==='1')navigate('capital-radar');else if(id==='3')navigate('sentiment');else notReady(target.dataset.name);}
  else if('external'in target.dataset)external(target.dataset.external);
  else if(target.dataset.article)external('https://apppage.longhuvip.com/w48/community/PContent2.html?AID='+target.dataset.article);
  else if(target.dataset.more==='strongest'&&data.strongest?.locked)toast('该内容需原APP会员权限，网页版暂不提供解锁');
  else if(target.dataset.more)notReady(names[target.dataset.more]);
  else if(target.dataset.unavailable)notReady(target.dataset.unavailable);
  else if('retry'in target.dataset){lastPoll=0;await load();}
 });
 $('home-refresh').onclick=load;$('home-to-top').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});$('home-my-page').onclick=()=>notReady('我的版面');
 $('home-account').onclick=()=>$('home-account-dialog').showModal();$('home-account-dialog').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>$('home-account-dialog').close()));$('home-theme').onclick=toggleTheme;
 $('home-message').onclick=async()=>{try{await openAlerts();}catch(error){toast(error.message);}};
 $('home-search-launch').onclick=()=>{$('home-search-dialog').showModal();$('home-search-input').focus();};
 $('home-search-form').onsubmit=event=>{event.preventDefault();clearTimeout(searchTimer);search();};$('home-search-input').oninput=()=>{queryVersion++;queryController?.abort();clearTimeout(searchTimer);searchTimer=setTimeout(search,300);};
 $('home-search-dialog').addEventListener('close',()=>{queryVersion++;queryController?.abort();clearTimeout(searchTimer);});
 $('home-menu-pages').onscroll=()=>{menuPage=Math.round($('home-menu-pages').scrollLeft/$('home-menu-pages').clientWidth);$('home-menu-dots').querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-current',String(i===menuPage)));};
 window.addEventListener('themechange',()=>{if(data.menu)menu(data.menu);});
 const visible=()=>{if(!root.hidden&&!document.hidden&&Date.now()-lastPoll>=10000)load();};setInterval(visible,10000);document.addEventListener('visibilitychange',()=>{if(document.hidden)controller?.abort();else visible();});
 for(const box of root.querySelectorAll('[data-section] .home-section-content'))box.innerHTML='<p class="home-empty">正在加载…</p>';
 load();
 return {route:()=>{if(root.hidden){stockRequest++;controller?.abort();$('home-account-dialog').close();$('home-search-dialog').close();}else visible();}};
}
