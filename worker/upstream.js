export async function requestUpstream(params,realtime){
 const base={apiv:'w48',PhoneOSNew:'1',VerSion:'6.3.20.2',Red:'0',DeviceID:''};
 const response=await fetch(realtime?'https://apphq.longhuvip.com/w1/api/index.php':'https://apphis.longhuvip.com/w1/api/index.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'curl/8.7.1','Accept':'*/*'},body:new URLSearchParams({...params,...base}),signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new Error('上游 HTTP '+response.status);
 const data=await response.json();
 if(String(data.errcode)!=='0')throw new Error(data.errmsg||'接口返回错误 '+data.errcode);
 return data;
}
export async function fetchMarket(kind,date,{start='0925',end='1500',offset=0,limit=6000,mode='today'}={}){
 const realtime=date==='latest';
 let params;
 if(kind==='rankings'){
  params={c:realtime?'NewStockRanking':'HisStockRanking',a:realtime?'RealRankingInfo_W8':'HisRankingInfo_W8',Date:realtime?'':date,Type:'1',Ratio:'6',Order:'1',Filter:'0',Isst:'0',index:String(offset),st:String(limit),FilterMotherboard:'0',FilterGem:'0',FilterTIB:'0',FilterBJS:'0'};
  if(start!=='0925'||end!=='1500'){params.RStart=start;params.REnd=end;params.st=String(Math.min(limit,1000));}
 }else if(kind==='indexes')params=realtime?{c:'StockL2Data',a:'GetZsTrend_Narrow'}:{c:'StockL2History',a:'GetZsTrend_Narrow',Day:date};
 else if(kind==='sentiment')params={c:realtime?'MarketSentiment':'HisMarketSentiment',a:'GetSentimentChart',mode,date:realtime?'':date};
 else if(kind==='mood')params=realtime?{c:'MarketMood',a:'MoodNumCount'}:{c:'Emotion',a:'MoodNumCount',Day:date};
 else throw new Error('未知数据类型');
 const data=await requestUpstream(params,realtime);
 if(kind==='rankings'&&(!Array.isArray(data.list)||!data.list.length))throw new Error(realtime?'上游已响应，但 '+(data.Day?.[0]||'当前')+' 榜单暂无数据':params.RStart?'上游暂无该时段的榜单数据':'该日期没有可用榜单，请选择交易日');
 if(kind==='indexes'&&(!Array.isArray(data.List)||!data.List.length))throw new Error('该日期没有可用指数走势');
 if(kind==='sentiment'&&(mode==='five_days'?!data.days?.length:!data.points?.length))throw new Error('该日期没有可用情绪走势');
 if(kind==='mood'&&(!data.list||!Number.isFinite(Number(data.list.SZJS))||!Number.isFinite(Number(data.list.XDJS))))throw new Error('该日期没有可用涨跌统计');
 if(!realtime&&kind==='rankings'&&data.Day?.[0]!==date)throw new Error('榜单返回日期与查询日期不符');
 if(!realtime&&kind==='sentiment'&&mode==='today'&&String(data.date).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3')!==date)throw new Error('情绪返回日期与查询日期不符');
 return data;
}
