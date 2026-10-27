import {requestUpstream} from './upstream.js';
const iso=value=>String(value??'').replace(/^(\d{4})(\d{2})(\d{2}).*$/,'$1-$2-$3');
const today=()=>new Date(Date.now()+28800000).toISOString().slice(0,10);
function candles(data){
 const points=new Map();
 for(let i=0;i<(data.x?.length||0);i++){
  const stamp=String(data.x[i]),day=iso(stamp),y=data.y?.[i];
  if(!Array.isArray(y)||y.length<4||!y.every(Number.isFinite))continue;
  const time=stamp.length>8?Date.parse(day+'T'+stamp.slice(8,10)+':'+stamp.slice(10,12)+':00+08:00')/1000:day;
  if((typeof time==='number'&&!Number.isFinite(time))||y.every(value=>value===0)||y[2]<Math.max(y[0],y[1])||y[3]>Math.min(y[0],y[1]))continue;
  points.set(time,{time,date:day,open:y[0],close:y[1],high:y[2],low:y[3],volume:Number(data.vol?.[i]||0)});
 }
 return [...points.values()].sort((a,b)=>String(a.time).localeCompare(String(b.time)));
}
async function loadBars(code,period,cursor,cutoff){
 const read=async offset=>{
  const raw=await requestUpstream({c:'StockLineData',a:'GetKLineDay_W14',StockID:code,Type:period,st:'300',Index:String(offset),Is_FS:'1'},false);
  return {raw,rows:candles(raw),cursor:offset};
 };
 let page=await read(cursor);
 if(cursor===0&&page.rows[0]?.date>cutoff){
  let lo=0,hi=300;
  for(let step=0;step<16;step++){
   page=await read(hi);
   if(!page.rows.length||page.rows[0].date<=cutoff)break;
   lo=hi;hi*=2;
  }
  while(hi-lo>300){
   const mid=Math.floor((lo+hi)/600)*300;
   if(mid<=lo)break;
   const candidate=await read(mid);
   if(!candidate.rows.length||candidate.rows[0].date<=cutoff){hi=mid;page=candidate;}else lo=mid;
  }
  if(!page.rows.length){page=await read(lo);}
 }
 return {...page,rows:page.rows.filter(p=>p.date<=cutoff),nextCursor:page.raw.x?.length===300?page.cursor+300:null};
}
function bucket(date,period){
 if(period==='m')return date.slice(0,7);
 const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);
}
export async function serveStock(url){
 const kind=url.pathname.split('/').at(-1),code=url.searchParams.get('code')||'',date=url.searchParams.get('date')||'latest',period=url.searchParams.get('period')||'d',cursor=Number(url.searchParams.get('cursor')||0),realtime=date==='latest',cutoff=realtime?today():date;
 if(!/^\d{6}$/.test(code)||(!realtime&&!/^20\d{2}-\d{2}-\d{2}$/.test(date))||!['quote','trend','kline'].includes(kind)||!['d','w','m','5','15','30','60'].includes(period)||!Number.isSafeInteger(cursor)||cursor<0||date!=='latest'&&date>today())return Response.json({error:'行情查询参数无效'},{status:400});
 try{
  let data,dataDate,dataTime,currentWarning='';
  const readCurrent=async type=>{try{return candles(await requestUpstream({c:'StockLineData',a:'GetKLineToday_W14',StockID:code,Type:type},true)).filter(p=>p.date<=cutoff);}catch(error){currentWarning='当日 K 线增量查询失败（'+error.message+'），图表使用历史接口数据。';return [];}};
  if(kind==='kline'){
   const page=await loadBars(code,period,cursor,cutoff);let rows=page.rows;
   if(cursor===0&&realtime&&!['w','m'].includes(period)){
    const updates=await readCurrent(period),map=new Map(rows.map(p=>[p.time,p]));for(const p of updates)map.set(p.time,p);rows=[...map.values()].sort((a,b)=>String(a.time).localeCompare(String(b.time)));
   }
   if(cursor===0&&['w','m'].includes(period)){
    const daily=await loadBars(code,'d',0,cutoff),target=bucket(cutoff,period);let days=daily.rows;
    if(realtime){const current=await readCurrent('d'),map=new Map(days.map(p=>[p.time,p]));for(const p of current)map.set(p.time,p);days=[...map.values()].sort((a,b)=>String(a.time).localeCompare(String(b.time)));}
    if(days.length&&bucket(days[0].date,period)===target&&daily.nextCursor!==null){const older=await loadBars(code,'d',daily.nextCursor,cutoff);days=[...older.rows,...days];}
    const part=days.filter(p=>bucket(p.date,period)===target);
    if(part.length){rows=rows.filter(p=>bucket(p.date,period)!==target);rows.push({time:part.at(-1).date,date:part.at(-1).date,open:part[0].open,close:part.at(-1).close,high:Math.max(...part.map(p=>p.high)),low:Math.min(...part.map(p=>p.low)),volume:part.reduce((n,p)=>n+p.volume,0)});}
   }
   if(!rows.length)throw new Error('所选日期没有可用 K 线');
   dataDate=rows.at(-1).date;dataTime=typeof rows.at(-1).time==='number'?new Date(rows.at(-1).time*1000).toISOString():null;
   data={code,period,candles:rows,nextCursor:page.nextCursor,volumeUnit:'手',priceBasis:'接口原始价格；上游未注明复权方式'};
  }else{
   const params=kind==='quote'?{c:realtime?'StockL2Data':'StockL2History',a:'GetStockPanKou',StockID:code,...(!realtime?{Day:date}:{})}:{c:realtime?'StockL2Data':'StockL2History',a:realtime?'GetStockTrendIncremental':'GetStockTrend',StockID:code,...(realtime?{Type:'1'}:{Day:date})};
   data=await requestUpstream(params,realtime);dataDate=iso(data.day);dataTime=data.time||data.ts||null;
   if(!realtime&&dataDate!==date)throw new Error('返回行情日期与查询日期不符');
   if(kind==='quote'&&!data.real)throw new Error('该股票暂无行情摘要');
   if(kind==='trend'){
    if(!data.trend?.length)throw new Error('该股票暂无分时数据');
    const points=new Map();for(const p of data.trend){if(!/^\d{2}:\d{2}$/.test(p[0])||!Number.isFinite(Number(p[1])))continue;points.set(p[0],{time:Date.parse(dataDate+'T'+p[0]+':00+08:00')/1000,price:Number(p[1]),...(Number(p[2])>0?{average:Number(p[2])}:{}),volume:Number(p[3]||0)});}
    data={...data,points:[...points.values()].sort((a,b)=>a.time-b.time),volumeUnit:'手'};
   }
  }
  const stale=realtime&&dataDate<today();
  return Response.json({...data,_source:realtime&&!stale&&!currentWarning?'realtime':'history',_dataDate:dataDate,_dataTime:dataTime,_retrievedAt:new Date().toISOString(),...((stale||currentWarning)?{_warning:[currentWarning,stale?'上游最新可用行情为 '+dataDate+'；今日数据尚未更新。':''].filter(Boolean).join(' ')}:{})});
 }catch(error){console.error(JSON.stringify({event:'stock_upstream_failed',kind,code,date,period,error:error.message}));return Response.json({error:'行情查询失败：'+error.message},{status:502});}
}
