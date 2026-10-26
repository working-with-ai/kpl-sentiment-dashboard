import {fetchMarket} from './upstream.js';
import {readArchive} from './archive.js';
const memoryCache=new Map();
export async function serveApi(url,seed,{db,sentimentSeed}={}){
 const kind=url.pathname.slice(5),ranking=kind==='rankings',date=url.searchParams.get('date')||seed.ranking.Day[0],realtime=date==='latest',start=url.searchParams.get('start')||'0925',end=url.searchParams.get('end')||'1500';
 if(!['rankings','indexes','sentiment','mood'].includes(kind))return Response.json({error:'Not found'},{status:404});
 if(!realtime&&!/^20\d{2}-\d{2}-\d{2}$/.test(date))return Response.json({error:'请选择有效日期'},{status:400});
 if(ranking&&(!/^\d{4}$/.test(start)||!/^\d{4}$/.test(end)||start<'0925'||end>'1500'||start>=end))return Response.json({error:'请选择有效的交易时间区间'},{status:400});
 if(!realtime&&(!ranking||(start==='0925'&&end==='1500'))){
  try{const archived=await readArchive(db,date,kind);if(archived)return Response.json(archived);}catch(error){console.error('archive_read_failed',date,kind,error.message);}
 }
 const key=url.pathname+'?'+new URLSearchParams({date,start,end}),saved=memoryCache.get(key);
 if(saved&&Date.now()-saved.time<(realtime?10000:300000))return Response.json(saved.data);
 try{
  const data=await fetchMarket(kind,date,{start,end});
  data._source=realtime?'realtime':'history';data._retrievedAt=new Date().toISOString();
  const dataDate=String(data.Day?.[0]||data.date||data.List?.[0]?.day||'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),today=new Date(Date.now()+8*60*60*1000).toISOString().slice(0,10);
  if(realtime&&dataDate&&dataDate<today){data._source='history';data._warning='实时接口已响应，但数据仍为 '+dataDate+'；今日数据尚未更新。';}
  if(memoryCache.size>=6)memoryCache.delete(memoryCache.keys().next().value);memoryCache.set(key,{time:Date.now(),data});return Response.json(data);
 }catch(error){
  console.error(JSON.stringify({event:'upstream_failed',kind,date,error:error.message,cause:error.cause?.message}));
  const seedDate=seed.ranking.Day[0],fallback={rankings:seed.ranking,indexes:seed.indexes,sentiment:sentimentSeed?.today,mood:sentimentSeed?.count}[kind];
  if(fallback&&(date===seedDate||realtime)&&(!ranking||(start==='0925'&&end==='1500'))){const data={...fallback,_source:'snapshot',_warning:realtime?'实时查询未取得可用数据（'+error.message+'），展示 '+seedDate+' 最近收盘快照；这不是实时行情。':'本次上游请求未成功，展示已获取的 '+seedDate+' 收盘快照。'};return Response.json(data);}
  return Response.json({error:'查询失败：'+(error.message||'上游连接未成功')},{status:502});
 }
}
