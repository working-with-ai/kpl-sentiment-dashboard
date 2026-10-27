import {createChart,CandlestickSeries,LineSeries,HistogramSeries,ColorType} from '../../vendor/lightweight-charts.mjs';
import {apiUrl} from '../../config.js';
export function createStockView(root,{navigate,getContext,onSelect}){
 const dialog=document.createElement('dialog');dialog.className='stock-dialog';dialog.setAttribute('aria-labelledby','quotation-title');
 dialog.innerHTML=`<div class="quotation-top"><button type="button" id="stock-back">返回榜单</button><h2 id="quotation-title">个股行情</h2><div class="quotation-neighbors"><button type="button" id="stock-prev" aria-label="上一只股票">上一只</button><button type="button" id="stock-next" aria-label="下一只股票">下一只</button></div></div><div class="quotation-price" id="stock-quote"></div><div class="data-state" id="stock-meta" role="status"></div><div class="notice" id="stock-notice" hidden></div><div class="quotation-periods" role="group" aria-label="行情周期">${[['trend','分时'],['d','日K'],['w','周K'],['m','月K'],['5','5分'],['15','15分'],['30','30分'],['60','60分']].map(([p,n])=>`<button type="button" data-period="${p}">${n}</button>`).join('')}</div><div class="quotation-readout" id="stock-readout" aria-live="polite"></div><div class="quotation-chart" id="stock-chart" tabindex="0" role="img" aria-label="个股价格与成交量图表"></div><div class="quotation-tools"><button type="button" id="stock-more" hidden>加载更早</button><button type="button" id="stock-zoom-in" aria-label="放大行情图">＋</button><button type="button" id="stock-zoom-out" aria-label="缩小行情图">－</button><button type="button" id="stock-reset">恢复视图</button><button type="button" id="stock-refresh">刷新</button></div><div class="quotation-foot"><span id="stock-basis">成交量单位：手</span><span>拖动平移 · 双指／滚轮缩放 · 长按／方向键查看</span></div>`;
 root.append(dialog);const $=id=>dialog.querySelector('#'+id),number=value=>Number.isFinite(Number(value))?Number(value):0,money=value=>{const n=number(value);return Math.abs(n)>=1e8?(n/1e8).toFixed(2)+'亿':Math.abs(n)>=1e4?(n/1e4).toFixed(1)+'万':n.toFixed(2);};
 let state=null,request=0,controller,chart,priceSeries,averageSeries,volumeSeries,maSeries=[],rows=[],quote=null,nextCursor=null,busy=false,chartKind='',keyboardIndex=-1;
 const timeKey=value=>typeof value==='object'?`${value.year}-${String(value.month).padStart(2,'0')}-${String(value.day).padStart(2,'0')}`:value;
 function timeLabel(value){if(typeof value==='number')return new Date(value*1000).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});return String(timeKey(value));}
 function params(extra={}){return new URLSearchParams({code:state.code,date:state.date,...extra});}
 async function json(kind,extra,signal){const response=await fetch(apiUrl('/api/stock/'+kind+'?'+params(extra)),{signal}),data=await response.json();if(!response.ok||data.error)throw new Error(data.error||'行情查询失败');return data;}
 function showNotice(text){$('stock-notice').hidden=!text;$('stock-notice').textContent=text;}
 function neighbors(){const codes=getContext().rows.map(r=>String(r[0])),index=codes.indexOf(state.code);$('stock-prev').disabled=index<=0;$('stock-next').disabled=index<0||index===codes.length-1;return {codes,index};}
 function goStock(code,period=state.period){onSelect(code);navigate('capital-radar/stock/'+code+'?'+new URLSearchParams({date:state.date,period}));}
 function summary(){
  const row=getContext().rows.find(r=>String(r[0])===state.code),name=quote?.name||row?.[1]||'个股行情';$('quotation-title').textContent=name+' '+state.code;$('stock-chart').setAttribute('aria-label',name+' '+(state.period==='trend'?'分时走势':'K线及成交量'));
  const real=quote?.real,last=number(real?.last_px),change=number(real?.px_change_rate);$('stock-quote').replaceChildren();
  if(real){const price=document.createElement('strong');price.className=change>=0?'up':'down';price.textContent=last>0?last.toFixed(2):'—';$('stock-quote').append(price);const info=document.createElement('span');info.className=change>=0?'up':'down';info.textContent=(change>0?'+':'')+change.toFixed(2)+'%';$('stock-quote').append(info);const metrics=document.createElement('small');metrics.textContent='开 '+(number(real.open_px)>0?number(real.open_px).toFixed(2):'—')+' · 高 '+(number(real.high_px)>0?number(real.high_px).toFixed(2):'—')+' · 低 '+(number(real.low_px)>0?number(real.low_px).toFixed(2):'—')+' · 成交 '+money(real.total_turnover)+' · 行情 '+quote._dataDate;$('stock-quote').append(metrics);}else $('stock-quote').textContent='行情摘要暂不可用';
  neighbors();
 }
 function colors(){const style=getComputedStyle(document.documentElement);return Object.fromEntries(['panel','text','muted','line','red','green','accent'].map(k=>[k,style.getPropertyValue('--'+k).trim()]));}
 function makeChart(){
  chart?.remove();const c=colors();chart=createChart($('stock-chart'),{autoSize:true,layout:{background:{type:ColorType.Solid,color:c.panel},textColor:c.muted,fontSize:11},grid:{vertLines:{color:c.line},horzLines:{color:c.line}},rightPriceScale:{borderColor:c.line},timeScale:{borderColor:c.line,timeVisible:state.period==='trend'||/^\d+$/.test(state.period),secondsVisible:false,rightOffset:3,tickMarkFormatter:(time,type)=>typeof time==='number'?new Date(time*1000).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',...(type<=2?{month:'2-digit',day:'2-digit'}:{hour:'2-digit',minute:'2-digit',hour12:false})}):String(timeKey(time)).slice(5)},localization:{locale:'zh-CN',timeFormatter:timeLabel},crosshair:{mode:0},handleScroll:{vertTouchDrag:false,horzTouchDrag:true},handleScale:{pinch:true,mouseWheel:true},kineticScroll:{touch:true,mouse:false}});
  if(state.period==='trend'){priceSeries=chart.addSeries(LineSeries,{color:c.accent,lineWidth:2,priceLineVisible:false});averageSeries=chart.addSeries(LineSeries,{color:'#d49b2a',lineWidth:1,priceLineVisible:false,lastValueVisible:false});maSeries=[];}
  else{priceSeries=chart.addSeries(CandlestickSeries,{upColor:c.red,downColor:c.green,borderVisible:false,wickUpColor:c.red,wickDownColor:c.green,priceLineVisible:false});averageSeries=null;maSeries=[['MA5','#b98116'],['MA10',c.accent],['MA20','#af7de2']].map(([title,color])=>chart.addSeries(LineSeries,{title,color,lineWidth:1,priceLineVisible:false,lastValueVisible:false}));}
  volumeSeries=chart.addSeries(HistogramSeries,{priceFormat:{type:'custom',formatter:value=>money(value)+'手'},priceLineVisible:false,lastValueVisible:false},1);chart.panes()[1]?.setHeight(100);chartKind=state.period;chart.subscribeCrosshairMove(event=>{const bar=event.seriesData.get(priceSeries);if(!bar)return;readout(timeKey(event.time),bar,event.seriesData.get(volumeSeries));});
 }
 function readout(time,bar,volume){
  const content=state.period==='trend'?'价格 '+number(bar.value).toFixed(2):'开 '+number(bar.open).toFixed(2)+'  高 '+number(bar.high).toFixed(2)+'  低 '+number(bar.low).toFixed(2)+'  收 '+number(bar.close).toFixed(2);
  $('stock-readout').textContent=timeLabel(time)+' · '+content+' · 量 '+money(volume?.value??0)+' 手';
 }
 function paint({reset=false,prepend=0}={}){
  if(!rows.length)return;const previous=chart&&chartKind===state.period?chart.timeScale().getVisibleLogicalRange():null;if(!chart||chartKind!==state.period)makeChart();const c=colors(),trend=state.period==='trend';
  chart.applyOptions({layout:{background:{type:ColorType.Solid,color:c.panel},textColor:c.muted},grid:{vertLines:{color:c.line},horzLines:{color:c.line}},rightPriceScale:{borderColor:c.line},timeScale:{borderColor:c.line}});
  priceSeries.applyOptions(trend?{color:c.accent}:{upColor:c.red,downColor:c.green,wickUpColor:c.red,wickDownColor:c.green});
  priceSeries.setData(rows.map(p=>trend?{time:p.time,value:p.price}:{time:p.time,open:p.open,high:p.high,low:p.low,close:p.close}));
  if(trend)averageSeries.setData(rows.filter(p=>Number.isFinite(p.average)).map(p=>({time:p.time,value:p.average})));
  else for(const [j,n] of [5,10,20].entries()){let sum=0;const averages=[];for(let i=0;i<rows.length;i++){sum+=rows[i].close;if(i>=n)sum-=rows[i-n].close;if(i>=n-1)averages.push({time:rows[i].time,value:sum/n});}maSeries[j].setData(averages);}
  volumeSeries.setData(rows.map((p,i)=>({time:p.time,value:p.volume,color:(trend?p.price>=(rows[i-1]?.price??p.price):p.close>=p.open)?c.red:c.green})));
  if(!reset&&previous)chart.timeScale().setVisibleLogicalRange({from:previous.from+prepend,to:previous.to+prepend});else if(trend)chart.timeScale().fitContent();else chart.timeScale().setVisibleLogicalRange({from:Math.max(0,rows.length-80),to:rows.length+3});
  const last=rows.at(-1);readout(last.time,trend?{value:last.price}:last,{value:last.volume});$('stock-more').hidden=trend||nextCursor===null;keyboardIndex=rows.length-1;
 }
 async function load({background=false,more=false}={}){
  if(!state||more&&nextCursor===null)return;const id=++request;controller?.abort();controller=new AbortController();const signal=controller.signal;busy=true;$('stock-refresh').disabled=true;$('stock-more').disabled=true;if(!background)showNotice('正在查询行情…');
  try{
   const oldCount=rows.length,chartPromise=state.period==='trend'?json('trend',{},signal):json('kline',{period:state.period,...(more?{cursor:String(nextCursor)}:{})},signal),results=await Promise.allSettled([more?Promise.resolve(quote):json('quote',{},signal),chartPromise]);
   if(id!==request||!dialog.open)return;
   if(results[0].status==='fulfilled'){quote=results[0].value;summary();}
   if(results[1].status==='rejected')throw results[1].reason;const data=results[1].value,newRows=state.period==='trend'?data.points:data.candles;
   if(!newRows?.length)throw new Error('当前周期暂无有效行情数据');
   if(more||background&&state.period!=='trend'){
    const key=p=>{if(state.period==='m')return p.date.slice(0,7);if(state.period==='w'){const day=new Date(p.date+'T00:00:00Z');day.setUTCDate(day.getUTCDate()-((day.getUTCDay()+6)%7));return day.toISOString().slice(0,10);}return p.time;};
    const combined=more?[...newRows,...rows]:[...rows,...newRows],map=new Map(combined.map(p=>[key(p),p]));rows=[...map.values()].sort((a,b)=>String(a.time).localeCompare(String(b.time)));
   }else rows=newRows;
   if(more||!background)nextCursor=data.nextCursor??null;const priorRange=chart?.timeScale().getVisibleLogicalRange(),shift=more||background&&priorRange?.to>=oldCount-1?rows.length-oldCount:0;summary();paint({reset:!background&&!more,prepend:shift});
   const source={realtime:'实时行情',history:'历史行情'}[data._source]||'行情';$('stock-meta').textContent='查询 '+(state.date==='latest'?'最新':state.date)+' · 图表 '+data._dataDate+' · '+source+' · 读取 '+new Date(data._retrievedAt).toLocaleTimeString('zh-CN',{hour12:false});
   $('stock-basis').textContent='成交量：'+(data.volumeUnit||'手')+(state.period==='trend'?' · 价格 / 均价':' · MA5 / MA10 / MA20 · '+data.priceBasis);
   showNotice([data._warning,results[0].status==='rejected'?'行情摘要查询失败；图表已成功加载。':''].filter(Boolean).join(' '));
  }catch(error){if(id===request&&error.name!=='AbortError'){showNotice(error.message+(rows.length?'；保留本股票本周期上次成功图表。':''));if(!rows.length)$('stock-meta').textContent='查询 '+(state.date==='latest'?'最新':state.date)+' · '+(quote?'行情摘要 '+quote._dataDate+' · ':'')+'图表暂不可用';}}
  finally{if(id===request){busy=false;$('stock-refresh').disabled=false;$('stock-more').disabled=false;}}
 }
 async function route(next){
  if(!next.code){const code=state?.code;state=null;request++;controller?.abort();if(dialog.open)dialog.close();if(code&&!root.hidden)root.querySelector('[data-stock="'+code+'"]')?.focus({preventScroll:true});return;}
  if(state&&state.code===next.code&&state.date===next.date&&state.period===next.period&&dialog.open)return;
  state={code:next.code,date:next.date||'latest',period:['trend','d','w','m','5','15','30','60'].includes(next.period)?next.period:'trend'};request++;controller?.abort();rows=[];quote=null;nextCursor=null;chart?.remove();chart=null;chartKind='';$('stock-readout').textContent='';$('stock-quote').textContent='';$('stock-meta').textContent='正在加载 '+state.code+'…';$('stock-more').hidden=true;
  dialog.querySelectorAll('[data-period]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.period===state.period)));summary();if(!dialog.open)dialog.showModal();await load();
 }
 $('stock-back').onclick=()=>navigate('capital-radar');dialog.addEventListener('cancel',event=>{event.preventDefault();navigate('capital-radar');});
 $('stock-prev').onclick=()=>{const {codes,index}=neighbors();if(index>0)goStock(codes[index-1]);};$('stock-next').onclick=()=>{const {codes,index}=neighbors();if(index>=0&&index<codes.length-1)goStock(codes[index+1]);};
 dialog.querySelectorAll('[data-period]').forEach(button=>button.onclick=()=>goStock(state.code,button.dataset.period));$('stock-refresh').onclick=()=>load();$('stock-more').onclick=()=>load({more:true});$('stock-reset').onclick=()=>paint({reset:true});
 function zoom(factor){if(!chart)return;const range=chart.timeScale().getVisibleLogicalRange();if(!range)return;const middle=(range.from+range.to)/2,half=Math.max(5,(range.to-range.from)/2*factor);chart.timeScale().setVisibleLogicalRange({from:middle-half,to:middle+half});}
 $('stock-zoom-in').onclick=()=>zoom(.75);$('stock-zoom-out').onclick=()=>zoom(1.35);
 $('stock-chart').onkeydown=event=>{if(!rows.length||!chart)return;if(['+','=','-','_'].includes(event.key)){event.preventDefault();zoom(['+','='].includes(event.key)?0.75:1.35);return;}if(event.key==='Escape'){chart.clearCrosshairPosition();return;}if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();keyboardIndex=event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,keyboardIndex+(event.key==='ArrowRight'?1:-1)));const p=rows[keyboardIndex],value=state.period==='trend'?p.price:p.close,range=chart.timeScale().getVisibleLogicalRange();if(range&&(keyboardIndex<range.from+1||keyboardIndex>range.to-1)){const span=Math.max(10,range.to-range.from),from=Math.max(0,Math.min(keyboardIndex-span/2,rows.length-span+3));chart.timeScale().setVisibleLogicalRange({from,to:from+span});}const activeChart=chart;requestAnimationFrame(()=>{if(chart!==activeChart)return;chart.setCrosshairPosition(value,p.time,priceSeries);readout(p.time,state.period==='trend'?{value}:p,{value:p.volume});});};
 window.addEventListener('themechange',()=>{if(dialog.open)paint();});setInterval(()=>{if(state?.date==='latest'&&dialog.open&&!root.hidden&&!document.hidden&&!busy)load({background:true});},10000);
 return {route};
}
