export async function init(root) {

const snapshot = await (await fetch(new URL("./snapshot.json", import.meta.url))).json();
const days=snapshot.five.days, stats=snapshot.count.list;
const $=id=>root.querySelector("#" + id), fmt=(n,d=3)=>Number(n).toFixed(d), signed=(n,d=3)=>(n>0?'+':'')+fmt(n,d), time=t=>t.slice(0,2)+':'+t.slice(2), short=d=>d.slice(5).replace('-','/');
const all=days.flatMap(d=>d.points.map(p=>({...p,date:d.date,value:Number(p.value)})));
const maximum=all.reduce((a,b)=>a.value>b.value?a:b),minimum=all.reduce((a,b)=>a.value<b.value?a:b);
const last=Number(days.at(-1).current),previous=Number(days.at(-2).current);
$('latest').textContent=signed(last);$('delta').innerHTML=signed(last-previous)+'<small>点</small>';$('highest').textContent=signed(snapshot.five.highest);$('lowest').textContent=signed(snapshot.five.lowest);
$('high-time').textContent=short(maximum.date)+' · '+time(maximum.time);$('low-time').textContent=short(minimum.date)+' · '+time(minimum.time);$('point-count').textContent=all.length.toLocaleString();
const share=stats.SZJS/(stats.SZJS+stats.XDJS)*100;
$('up-share').innerHTML=share.toFixed(1)+'<span>%</span>';$('bar-up').style.width=share+'%';$('bar-down').style.width=(100-share)+'%';$('up-label').textContent=stats.SZJS.toLocaleString();$('down-label').textContent=stats.XDJS.toLocaleString();
$('counts').innerHTML=[['上涨家数',stats.SZJS,'positive'],['下跌家数',stats.XDJS,'negative'],['涨停家数',stats.ZTJS,'positive'],['跌停家数',stats.DTJS,'negative']].map(([label,value,color])=>`<div><span class="label">${label}</span><strong class="${color}">${value.toLocaleString()}</strong></div>`).join('');
let selection='all',chartPoints=[],layout={};
$('tabs').innerHTML=[['all','近五日'],...days.map(d=>[d.date,short(d.date)])].map(([key,label])=>`<button type="button" data-date="${key}" aria-pressed="${key==='all'}">${label}</button>`).join('');
$('day-grid').innerHTML=days.map(d=>{const values=d.points.map(p=>Number(p.value)),lo=Math.min(...values),hi=Math.max(...values),color=Number(d.current)>=0?'#e3565c':'#199b81',path=values.map((v,i)=>(i?'L':'M')+(i/(values.length-1)*160).toFixed(1)+','+(39-(v+4)/9*36).toFixed(1)).join(' ');return `<button type="button" class="day" data-date="${d.date}" aria-pressed="false" aria-label="查看 ${d.date} 分时走势"><div class="day-head">${short(d.date)}<small>${['周日','周一','周二','周三','周四','周五','周六'][new Date(d.date+'T12:00:00').getDay()]}</small></div><div class="day-value ${Number(d.current)>=0?'positive':'negative'}">${signed(Number(d.current))}<small>收盘</small></div><svg class="spark" viewBox="0 0 160 44" preserveAspectRatio="none" aria-hidden="true"><path d="M0 23H160" stroke="#e8edf0" stroke-dasharray="3 3"/><path d="${path}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg><div class="day-range"><span>低 ${fmt(lo,2)}</span><span>高 ${fmt(hi,2)}</span></div></button>`}).join('');
function selectDate(date){selection=date;root.querySelectorAll('[data-date]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.date===date)));renderChart();}
root.querySelectorAll('[data-date]').forEach(b=>b.addEventListener('click',()=>selectDate(b.dataset.date)));
function renderChart(){
 const chosen=selection==='all'?days:days.filter(d=>d.date===selection),svg=$('chart'),W=Math.max(250,svg.clientWidth),H=svg.clientHeight,L=W<400?33:38,R=W<400?11:16,T=23,B=37,pw=W-L-R,ph=H-T-B;
 const points=chosen.flatMap(d=>d.points.map(p=>({...p,date:d.date,value:Number(p.value)}))),y=v=>T+(5.5-v)/9.5*ph,x=i=>L+i/(points.length-1)*pw;
 chartPoints=points;layout={W,H,L,R,T,B,pw,ph,x,y};
 svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('aria-label',`${selection==='all'?'2026年10月19日至23日':selection}情绪分时走势，最高${fmt(Math.max(...points.map(p=>p.value)))}，最低${fmt(Math.min(...points.map(p=>p.value)))}`);
 $('chart-sub').textContent=selection==='all'?`2026.10.19 — 10.23 · ${points.length.toLocaleString()} 个分时点`:`${selection} · ${points.length} 个分时点 · 收盘 ${signed(Number(chosen[0].current))}`;
 let html=`<defs><linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#426aea" stop-opacity=".12"/><stop offset="100%" stop-color="#426aea" stop-opacity=".01"/></linearGradient><clipPath id="plot-clip"><rect x="${L}" y="${T}" width="${pw}" height="${ph}"/></clipPath></defs><rect x="${L}" y="${T}" width="${pw}" height="${y(2)-T}" fill="#fff3f2"/><rect x="${L}" y="${y(-1)}" width="${pw}" height="${H-B-y(-1)}" fill="#edf8f3"/>`;
 for(const v of [-4,-2,0,2,4])html+=`<line class="axis-grid" x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" ${v===0?'stroke-dasharray="4 4"':''}/><text x="${L-9}" y="${y(v)+4}" text-anchor="end">${v>0?'+':''}${v}</text>`;
 for(const v of [2,-1])html+=`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="${v===2?'#e6b4b0':'#b2dacc'}" stroke-dasharray="3 5"/>`;
 let offset=0;
 chosen.forEach((d,di)=>{const vals=d.points.map(p=>Number(p.value)),p=vals.map((v,i)=>(i?'L':'M')+x(offset+i).toFixed(2)+','+y(v).toFixed(2)).join(' '),first=x(offset),end=x(offset+vals.length-1);
  html+=`<path d="${p}L${end},${y(-4)}L${first},${y(-4)}Z" fill="url(#area-fill)" clip-path="url(#plot-clip)"/><path d="${p}" fill="none" stroke="#426aea" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" clip-path="url(#plot-clip)"/>`;
  if(chosen.length>1){if(di>0)html+=`<line class="axis-grid" x1="${first}" y1="${T}" x2="${first}" y2="${H-B}" stroke-dasharray="3 4"/>`;html+=`<text x="${(first+end)/2}" y="${H-12}" text-anchor="middle">${short(d.date)}</text>`;}offset+=vals.length;
 });
 if(chosen.length===1){const tickTargets=['0930','1030','1130','1400','1500'];tickTargets.forEach((t,i)=>{if(W<400&&i===1)return;const j=points.findIndex(p=>p.time===t);if(j>=0)html+=`<text x="${x(j)}" y="${H-12}" text-anchor="${i===0?'start':i===4?'end':'middle'}">${time(t)}</text>`;});}
 const lastP=points.at(-1);html+=`<circle cx="${x(points.length-1)}" cy="${y(lastP.value)}" r="3.8" fill="#426aea" stroke="white" stroke-width="2"/><g id="crosshair" visibility="hidden"><line id="cross-line" y1="${T}" y2="${H-B}" stroke="#8b9ab1" stroke-dasharray="3 3"/><circle id="cross-dot" r="4.5" fill="#426aea" stroke="white" stroke-width="2"/></g>`;svg.innerHTML=html;$('tooltip').style.display='none';
 $('chart-desc').textContent=`当前展示${selection==='all'?'五个交易日':selection}的情绪曲线。活跃阈值为2，冰点阈值为-1。`;
}
function showPoint(e){const box=$('chart').getBoundingClientRect(),{L,pw,x,y,W,H}=layout,px=e.clientX-box.left,i=Math.max(0,Math.min(chartPoints.length-1,Math.round((px-L)/pw*(chartPoints.length-1)))),p=chartPoints[i];
 $('crosshair').setAttribute('visibility','visible');$('cross-line').setAttribute('x1',x(i));$('cross-line').setAttribute('x2',x(i));$('cross-dot').setAttribute('cx',x(i));$('cross-dot').setAttribute('cy',y(p.value));const tip=$('tooltip');tip.innerHTML=`${p.date} · ${time(p.time)}<strong>${signed(p.value)}</strong>`;tip.style.display='block';tip.style.left=Math.max(0,Math.min(W-tip.offsetWidth,x(i)+14))+'px';tip.style.top=Math.max(0,Math.min(H-tip.offsetHeight,y(p.value)-tip.offsetHeight-12))+'px';}
$('chart').addEventListener('pointermove',showPoint);$('chart').addEventListener('pointerdown',showPoint);$('chart').addEventListener('pointerleave',()=>{$('crosshair').setAttribute('visibility','hidden');$('tooltip').style.display='none';});
new ResizeObserver(renderChart).observe($('chart-wrap'));renderChart();

}
