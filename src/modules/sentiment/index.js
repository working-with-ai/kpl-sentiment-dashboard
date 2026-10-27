import {apiUrl} from '../../config.js';
export async function init(root){
 const $=id=>root.querySelector('#'+id),iso=value=>String(value||'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),today=()=>new Date(Date.now()+28800000).toISOString().slice(0,10),pct=value=>(Number(value)>0?'+':'')+Number(value).toFixed(2)+'%',clock=value=>String(value).replace(/^(\d{2})(\d{2})$/,'$1:$2'),sourceName={realtime:'今日行情',history:'历史行情',archive:'收盘归档',snapshot:'历史快照'};
 let state={date:'latest',mode:'today',...JSON.parse(sessionStorage.getItem('kpl-sentiment-view')||'{}')},requestId=0,controller,loading=false,data=null,mood=null,recent=[],chartPoints=[],geometry=null,touchTimer,touchActive=false,pointIndex=-1;
 const save=()=>sessionStorage.setItem('kpl-sentiment-view',JSON.stringify(state));
 $('date').max=today();
 function controls(){
  $('date').value=state.date==='latest'?today():state.date;
  $('mode-today').setAttribute('aria-pressed',String(state.mode==='today'));$('mode-five').setAttribute('aria-pressed',String(state.mode==='five_days'));
 }
 async function fetchJson(path,signal){const response=await fetch(apiUrl(path),{signal}),value=await response.json();if(!response.ok||value.error)throw new Error(value.error||'查询失败');return value;}
 function notice(text,error=false){$('notice').hidden=!text;$('notice').textContent=text;$('notice').classList.toggle('error',error);}
 async function load(){
  const id=++requestId;controller?.abort();controller=new AbortController();const signal=controller.signal,{date,mode}=state;loading=true;save();controls();$('refresh').disabled=true;notice('');
  try{
   const primary=await fetchJson('/api/sentiment?'+new URLSearchParams({date,mode}),signal);if(id!==requestId)return;
   const actual=iso(primary._dataDate||primary.date||primary.days?.at(-1)?.date),days=mode==='five_days'?primary.days.map(d=>({...d,date:iso(d.date)})):[{...primary,date:actual}];
   if(!days.length||days.some(day=>!day.points?.length))throw new Error('所选日期暂无有效情绪数据');
   data={primary,days,actual};mood=null;render();notice(primary._warning||'');
   const breadthDate=date==='latest'&&primary._source==='realtime'&&actual===today()?'latest':actual;
   const secondary=await Promise.allSettled([fetchJson('/api/mood?date='+breadthDate,signal),mode==='five_days'?Promise.resolve(primary):fetchJson('/api/sentiment?'+new URLSearchParams({date:date==='latest'?'latest':actual,mode:'five_days'}),signal)]);
   if(id!==requestId)return;
   if(secondary[0].status==='fulfilled'){
    const value=secondary[0].value,returned=iso(value._dataDate||actual);if(returned===actual)mood=value;else $('breadth-status').textContent='涨跌统计返回 '+returned+'，未混入当前交易日。';
   }else if(secondary[0].reason.name!=='AbortError')$('breadth-status').textContent='该日涨跌统计暂不可用，点击刷新重试。';
   recent=secondary[1].status==='fulfilled'?(secondary[1].value.days||[]).map(d=>({...d,date:iso(d.date)})):days;
   renderBreadth();renderRecent();renderMetrics();
  }catch(error){if(id===requestId&&error.name!=='AbortError')notice(error.message+(data?'；仍显示 '+data.actual+' 上次成功数据。':''),true);}
  finally{if(id===requestId){loading=false;$('refresh').disabled=false;}}
 }
 function renderMetrics(){
  if(!data)return;const selected=data.days.at(-1),values=data.days.flatMap(d=>d.points.map(p=>Number(p.value))),last=Number(selected.points.at(-1).value),prior=recent.find((d,i)=>recent[i+1]?.date===selected.date),delta=prior?last-Number(prior.current??prior.points.at(-1).value):null;
  $('current-label').textContent=(state.mode==='five_days'?'截止日情绪':'当日情绪')+' · '+clock(selected.points.at(-1).time);$('current').textContent=pct(last);$('current').className=last>=0?'positive':'negative';
  $('delta').textContent=delta===null?'—':(delta>0?'+':'')+delta.toFixed(2)+' 个百分点';$('delta').className=delta===null?'muted':delta>=0?'positive':'negative';$('delta').style.fontSize='';
  $('highest').textContent=pct(Math.max(...values));$('lowest').textContent=pct(Math.min(...values));
 }
 function renderBreadth(){
  $('breadth-date').textContent=data.actual;$('counts').innerHTML=['上涨','下跌','涨停','跌停'].map((label,i)=>{const value=mood?.list?.[['SZJS','XDJS','ZTJS','DTJS'][i]];return `<div><span>${label}家数</span><strong class="${i%2?'negative':'positive'}">${value==null?'—':Number(value).toLocaleString()}</strong></div>`;}).join('');
  const up=Number(mood?.list?.SZJS||0),down=Number(mood?.list?.XDJS||0),share=up+down?up/(up+down)*100:null;$('up-share').textContent=share===null?'—':share.toFixed(1)+'%';$('bar-up').style.width=(share||0)+'%';
  $('download-mood').disabled=!mood;if(mood)$('breadth-status').textContent=mood._warning||'上涨 ÷（上涨＋下跌）；接口未提供平盘家数。';else if(!$('breadth-status').textContent)$('breadth-status').textContent='正在获取该交易日统计…';
 }
 function renderRecent(){
  const days=recent.filter(d=>d.date<=data.actual);$('recent-days').innerHTML=days.map(d=>`<button type="button" data-date="${d.date}" aria-pressed="${state.mode==='today'&&d.date===data.actual}">${d.date.slice(5).replace('-','/')}</button>`).join('');
  $('day-grid').innerHTML=days.map(d=>{const values=d.points.map(p=>Number(p.value)),low=Math.min(...values),high=Math.max(...values),last=values.at(-1),span=high-low||1,path=values.map((v,i)=>(i?'L':'M')+(i/Math.max(1,values.length-1)*140).toFixed(1)+','+(32-(v-low)/span*30).toFixed(1)).join(' ');return `<button class="day" type="button" data-date="${d.date}" aria-label="查看 ${d.date} 情绪分时" aria-pressed="${state.mode==='today'&&d.date===data.actual}"><span>${d.date.slice(5)} · ${d._source==='archive'?'已归档':'行情'}</span><strong class="${last>=0?'positive':'negative'}">${pct(last)}</strong><svg viewBox="0 0 140 34" aria-hidden="true"><path d="${path}" fill="none" stroke="${last>=0?'var(--red)':'var(--green)'}" stroke-width="1.4"/></svg><small>高 ${pct(high)} · 低 ${pct(low)}</small></button>`;}).join('');
  root.querySelectorAll('[data-date]').forEach(button=>button.onclick=()=>{state.date=button.dataset.date;state.mode='today';load();});
 }
 function render(){
  const {primary,days,actual}=data;const count=days.reduce((n,d)=>n+d.points.length,0);$('chart-title').textContent=state.mode==='five_days'?'五日情绪走势':'情绪分时';$('chart-period').textContent=(days.length>1?days[0].date+' — ':'')+actual;
  $('data-state').textContent='查询 '+(state.date==='latest'?'今日':state.date)+' · 行情 '+actual+' '+clock(days.at(-1).points.at(-1).time)+' · '+(sourceName[primary._source]||'行情')+' · 读取 '+new Date(primary._retrievedAt||Date.now()).toLocaleTimeString('zh-CN',{hour12:false});
  $('source-info').textContent='来源：开盘啦 '+(state.mode==='five_days'?'五日':'单日')+'情绪接口 · '+count+' 个分时点';$('download-chart').disabled=false;$('breadth-status').textContent='';renderMetrics();renderBreadth();renderChart();
 }
 function renderChart(){
  if(!data)return;const svg=$('chart'),W=Math.max(260,svg.clientWidth),H=svg.clientHeight,L=42,R=14,T=16,B=34,days=data.days,thresholds=data.primary.thresholds||days.at(-1).thresholds||{},active=Number(thresholds.active),frozen=Number(thresholds.frozen),values=days.flatMap(d=>d.points.map(p=>Number(p.value))),bounds=[...values,0,...[active,frozen].filter(Number.isFinite)],min=Math.min(...bounds),max=Math.max(...bounds),pad=Math.max(.3,(max-min)*.12),lo=min-pad,hi=max+pad,pw=W-L-R,ph=H-T-B;
  chartPoints=days.flatMap(d=>d.points.map(p=>({date:d.date,time:clock(p.time),value:Number(p.value)})));const x=i=>L+i/Math.max(1,chartPoints.length-1)*pw,y=v=>T+(hi-v)/(hi-lo)*ph;geometry={W,H,L,R,T,B,x,y};
  $('legend').innerHTML='<span><i style="background:var(--accent)"></i>情绪值</span>'+(Number.isFinite(active)?'<span><i style="background:var(--red);opacity:.3"></i>活跃 ≥ '+active+'%</span>':'')+(Number.isFinite(frozen)?'<span><i style="background:var(--green);opacity:.3"></i>冰点 ≤ '+frozen+'%</span>':'');
  let html=Number.isFinite(active)?`<rect x="${L}" y="${T}" width="${pw}" height="${Math.max(0,y(active)-T)}" fill="var(--red)" opacity=".055"/>`:'';if(Number.isFinite(frozen))html+=`<rect x="${L}" y="${y(frozen)}" width="${pw}" height="${Math.max(0,H-B-y(frozen))}" fill="var(--green)" opacity=".07"/>`;
  for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;html+=`<line class="axis-grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-label" x="${L-7}" y="${y(v)+4}" text-anchor="end">${v.toFixed(1)}%</text>`;}
  for(const v of [active,frozen].filter(Number.isFinite))html+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--muted)" opacity=".45" stroke-dasharray="3 4"/>`;
  let offset=0;for(const d of days){const path=d.points.map((p,i)=>(i?'L':'M')+x(offset+i).toFixed(1)+','+y(Number(p.value)).toFixed(1)).join(' ');html+=`<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="1.8"/>`;if(days.length>1){html+=`<text class="axis-label" x="${x(offset+(d.points.length-1)/2)}" y="${H-9}" text-anchor="middle">${d.date.slice(5).replace('-','/')}</text>`;if(offset)html+=`<line class="axis-grid" x1="${x(offset)}" x2="${x(offset)}" y1="${T}" y2="${H-B}" stroke-dasharray="3 4"/>`;}offset+=d.points.length;}
  if(days.length===1)for(const [i,label] of [[0,chartPoints[0].time],[Math.floor((chartPoints.length-1)/2),'11:30 / 13:00'],[chartPoints.length-1,chartPoints.at(-1).time]])html+=`<text class="axis-label" x="${x(i)}" y="${H-9}" text-anchor="${i===0?'start':i===chartPoints.length-1?'end':'middle'}">${label}</text>`;
  html+='<g id="crosshair" visibility="hidden"><line id="cross-line" stroke="var(--muted)" stroke-dasharray="3 3"/><circle id="cross-dot" r="4" fill="var(--accent)" stroke="var(--panel)" stroke-width="2"/></g>';svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=html;svg.setAttribute('aria-label',`${days[0].date} 至 ${data.actual}情绪走势，最高 ${pct(Math.max(...values))}，最低 ${pct(Math.min(...values))}`);hidePoint();
 }
 function showPoint(index){
  if(!geometry||!chartPoints.length)return;pointIndex=Math.max(0,Math.min(chartPoints.length-1,index));const p=chartPoints[pointIndex],g=geometry,x=g.x(pointIndex),y=g.y(p.value);$('crosshair').setAttribute('visibility','visible');for(const [k,v] of Object.entries({x1:x,x2:x,y1:g.T,y2:g.H-g.B}))$('cross-line').setAttribute(k,v);$('cross-dot').setAttribute('cx',x);$('cross-dot').setAttribute('cy',y);const tip=$('tooltip');tip.hidden=false;tip.innerHTML=p.date+' '+p.time+'<strong>'+pct(p.value)+'</strong>';tip.style.left=Math.max(0,Math.min(g.W-tip.offsetWidth,x+12))+'px';tip.style.top=Math.max(0,Math.min(g.H-tip.offsetHeight,y-tip.offsetHeight-10))+'px';
 }
 function fromEvent(event){if(!geometry)return;const rect=$('chart').getBoundingClientRect();showPoint(Math.round((event.clientX-rect.left-geometry.L)/(geometry.W-geometry.L-geometry.R)*(chartPoints.length-1)));}
 function hidePoint(){if($('crosshair'))$('crosshair').setAttribute('visibility','hidden');$('tooltip').hidden=true;}
 $('chart').onpointerdown=event=>{if(event.pointerType==='touch'){touchActive=false;clearTimeout(touchTimer);touchTimer=setTimeout(()=>{touchActive=true;fromEvent(event);},300);}else fromEvent(event);};
 $('chart').onpointermove=event=>{if(event.pointerType!=='touch'||touchActive)fromEvent(event);};
 $('chart').addEventListener('touchmove',event=>{if(touchActive)event.preventDefault();else clearTimeout(touchTimer);},{passive:false});
 for(const name of ['pointerup','pointercancel','pointerleave'])$('chart').addEventListener(name,event=>{clearTimeout(touchTimer);if(event.pointerType==='touch'||name==='pointerleave'){touchActive=false;hidePoint();}});
 $('chart').onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End','Escape'].includes(event.key)){event.preventDefault();if(event.key==='Escape')hidePoint();else showPoint(event.key==='Home'?0:event.key==='End'?chartPoints.length-1:(pointIndex<0?chartPoints.length-1:pointIndex)+(event.key==='ArrowRight'?1:-1));}};
 $('mode-today').onclick=()=>{state.mode='today';load();};$('mode-five').onclick=()=>{state.mode='five_days';load();};$('date').onchange=()=>{state.date=$('date').value;load();};$('today').onclick=()=>{state.date='latest';load();};$('refresh').onclick=load;
 function download(value,label){const href=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=href;link.download=label+'-'+data.actual+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}
 $('download-chart').onclick=()=>download(data.primary,state.mode==='five_days'?'五日情绪':'情绪分时');$('download-mood').onclick=()=>download(mood,'涨跌统计');
 new ResizeObserver(renderChart).observe($('chart-wrap'));window.addEventListener('themechange',renderChart);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!root.hidden&&state.date==='latest')load();});setInterval(()=>{if(!document.hidden&&!root.hidden&&state.date==='latest'&&!loading)load();},10000);
 controls();load();return {};
}
