const memoryCache=new Map();
export async function serveApi(url,seed){
 const ranking=url.pathname==='/api/rankings',date=url.searchParams.get('date')||seed.ranking.Day[0],realtime=date==='latest',start=url.searchParams.get('start')||'0925',end=url.searchParams.get('end')||'1500';
 if(!realtime&&!/^20\d{2}-\d{2}-\d{2}$/.test(date))return Response.json({error:'请选择有效日期'},{status:400});
 if(ranking&&(!/^\d{4}$/.test(start)||!/^\d{4}$/.test(end)||start<'0925'||end>'1500'||start>=end))return Response.json({error:'请选择有效的交易时间区间'},{status:400});
 const key=url.pathname+'?'+new URLSearchParams({date,start,end}),saved=memoryCache.get(key);
 if(saved&&Date.now()-saved.time<(realtime?10000:300000))return Response.json(saved.data);
 const base={apiv:'w48',PhoneOSNew:'1',VerSion:'6.3.20.2',Red:'0',DeviceID:''};
 const params=ranking?{c:realtime?'NewStockRanking':'HisStockRanking',a:realtime?'RealRankingInfo_W8':'HisRankingInfo_W8',Date:realtime?'':date,Type:'1',Ratio:'6',Order:'1',Filter:'0',Isst:'0',index:'0',st:'6000',FilterMotherboard:'0',FilterGem:'0',FilterTIB:'0',FilterBJS:'0',...base}:{c:'StockL2History',a:'GetZsTrend_Narrow',Day:date,...base};
 if(ranking&&(start!=='0925'||end!=='1500')){params.RStart=start;params.REnd=end;}
 try{
  const endpoint=realtime?'https://apphq.longhuvip.com/w1/api/index.php':'https://apphis.longhuvip.com/w1/api/index.php';
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'curl/8.7.1','Accept':'*/*'},body:new URLSearchParams(params),signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error('上游 HTTP '+response.status);
  const data=await response.json();
  if(String(data.errcode)!=='0')throw new Error(data.errmsg||'接口返回错误 '+data.errcode);
  if(ranking&&(!Array.isArray(data.list)||data.list.length===0))throw new Error('该日期没有可用榜单，请选择交易日');
  if(!ranking&&(!Array.isArray(data.List)||data.List.length===0))throw new Error('该日期没有可用指数走势');
  data._source=realtime?'realtime':'history';data._retrievedAt=new Date().toISOString();
  if(memoryCache.size>=6)memoryCache.delete(memoryCache.keys().next().value);memoryCache.set(key,{time:Date.now(),data});return Response.json(data);
 }catch(error){
  const seedDate=seed.ranking.Day[0];
  if((date===seedDate||realtime)&&(!ranking||(start==='0925'&&end==='1500'))){const data={...(ranking?seed.ranking:seed.indexes),_source:'snapshot',_warning:realtime?'实时接口暂不可达，展示 '+seedDate+' 最近收盘快照；这不是实时行情。':'本次上游请求未成功，展示已获取的 '+seedDate+' 收盘快照。'};return Response.json(data);}
  return Response.json({error:'查询失败：'+(error.message||'上游连接未成功')},{status:502});
 }
}
