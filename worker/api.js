import {fetchMarket} from './upstream.js';
import {readArchive} from './archive.js';
const memoryCache=new Map(),iso=value=>String(value??'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
export async function serveApi(url,seed,{db,sentimentSeed}={}){
 const kind=url.pathname.slice(5),ranking=kind==='rankings',date=url.searchParams.get('date')||seed.ranking.Day[0],realtime=date==='latest',start=url.searchParams.get('start')||'0925',end=url.searchParams.get('end')||'1500',mode=url.searchParams.get('mode')||'today',today=new Date(Date.now()+28800000).toISOString().slice(0,10);
 if(!['rankings','indexes','sentiment','mood'].includes(kind))return Response.json({error:'Not found'},{status:404});
 if(!['today','five_days'].includes(mode)||!realtime&&(!/^20\d{2}-\d{2}-\d{2}$/.test(date)||date>today))return Response.json({error:'请选择有效日期和查询模式'},{status:400});
 if(ranking&&(!/^\d{4}$/.test(start)||!/^\d{4}$/.test(end)||start<'0925'||end>'1500'||start>=end))return Response.json({error:'请选择有效的交易时间区间'},{status:400});
 if(mode!=='five_days'&&!realtime&&(!ranking||(start==='0925'&&end==='1500'))){
  try{const archived=await readArchive(db,date,kind);if(archived)return Response.json({...archived,_dataDate:date,_dataTime:kind==='sentiment'?archived.points?.at(-1)?.time:ranking?end:kind==='indexes'?archived.List?.[0]?.trend?.at(-1)?.[0]:null});}catch(error){console.error('archive_read_failed',date,kind,error.message);}
 }
 const key=url.pathname+'?'+new URLSearchParams({date,start,end,mode}),saved=memoryCache.get(key);
 if(saved&&Date.now()-saved.time<(realtime?10000:300000))return Response.json(saved.data);
 try{
  const data=await fetchMarket(kind,date,{start,end,mode});
  if(ranking&&(realtime||start!=='0925'||end!=='1500')){
   const rows=new Map(data.list.map(row=>[row[0],row]));let offset=data.list.length;
   while(offset<Number(data.Count)){
    const page=await fetchMarket(kind,date,{start,end,offset,limit:1000});
    if(Number(page.Count)!==Number(data.Count)||page.Day?.[0]!==data.Day?.[0])throw new Error('榜单分页发生变化，请重新查询');
    for(const row of page.list){if(!realtime&&rows.has(row[0]))throw new Error('区间榜单分页发生变化，请重新查询');rows.set(row[0],row);}offset+=page.list.length;
   }
   data.list=[...rows.values()];if(data.list.length<Number(data.Count))data._warning='实时分页更新中，已返回 '+data.list.length+' / '+data.Count+' 只股票。';
  }
  const dataDate=iso(data.Day?.[0]||data.date||data.List?.[0]?.day||data.days?.at(-1)?.date||(kind==='mood'?(realtime?today:date):''));
  if(!realtime&&kind==='sentiment'&&mode==='five_days'&&dataDate!==date)throw new Error('五日走势截止日期与查询日期不符');
  data._source=realtime?'realtime':'history';data._retrievedAt=new Date().toISOString();data._dataDate=dataDate;data._dataTime=ranking?(!realtime||dataDate<today?end:data.Time):data.points?.at(-1)?.time||data.days?.at(-1)?.points?.at(-1)?.time||data.List?.[0]?.trend?.at(-1)?.[0]||null;
  if(kind==='sentiment'&&mode==='five_days'){
   data.days=await Promise.all(data.days.map(async day=>{const dayDate=iso(day.date);try{const archived=await readArchive(db,dayDate,'sentiment');if(archived)return {...archived,date:dayDate,_dataDate:dayDate};}catch(error){console.error('archive_read_failed',dayDate,'sentiment',error.message);}return {...day,date:dayDate,_source:realtime&&dayDate===today?'realtime':'history'};}));
  }
  if(realtime&&dataDate&&dataDate<today){data._source='history';data._warning='实时接口已响应，但数据仍为 '+dataDate+'；今日数据尚未更新。';}
  if(memoryCache.size>=20)memoryCache.delete(memoryCache.keys().next().value);memoryCache.set(key,{time:Date.now(),data});return Response.json(data);
 }catch(error){
  console.error(JSON.stringify({event:'upstream_failed',kind,date,error:error.message,cause:error.cause?.message}));
  if(kind==='sentiment'&&mode==='five_days'&&db){
   const {results}=await db.prepare('SELECT trade_date FROM archive_days WHERE trade_date <= ? ORDER BY trade_date DESC LIMIT 5').bind(realtime?today:date).all();
   if(results.length&&(realtime||results[0].trade_date===date)){
    const days=(await Promise.all(results.reverse().map(row=>readArchive(db,row.trade_date,'sentiment')))).filter(Boolean);
    if(days.length)return Response.json({mode,days,thresholds:days.at(-1).thresholds,_source:'archive',_dataDate:iso(days.at(-1).date),_dataTime:days.at(-1).points?.at(-1)?.time,_retrievedAt:new Date().toISOString(),_warning:'上游查询失败，展示已归档的 '+days.length+' 个交易日；归档范围可能不连续。'});
   }
  }
  const seedDate=seed.ranking.Day[0],fallback={rankings:seed.ranking,indexes:seed.indexes,sentiment:mode==='five_days'?sentimentSeed?.five:sentimentSeed?.today,mood:sentimentSeed?.count}[kind];
  if(fallback&&(date===seedDate||realtime)&&(!ranking||(start==='0925'&&end==='1500')))return Response.json({...fallback,_source:'snapshot',_dataDate:seedDate,_dataTime:kind==='sentiment'||ranking?'1500':null,_retrievedAt:new Date().toISOString(),_warning:'查询未取得可用数据（'+error.message+'），展示 '+seedDate+' 收盘快照；这不是实时行情。'});
  return Response.json({error:'查询失败：'+(error.message||'上游连接未成功')},{status:502});
 }
}
