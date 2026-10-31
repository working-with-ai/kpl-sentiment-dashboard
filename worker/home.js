import {fetchMarket} from './upstream.js';
import catalog from './stock-catalog.json';
import rankingSnapshot from '../src/modules/capital-radar/snapshot.json';
import {readArchive} from './archive.js';

const cache=new Map();
const day=value=>{
 if(!value)return null;
 if(/^\d{10}$/.test(String(value)))return new Date(Number(value)*1000+28800000).toISOString().slice(0,10);
 return String(value).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3').slice(0,10);
};
const endpoints={
 layout:['applhb',{c:'SysAppVersion',a:'GetLaYout'},300000],
 content:['applhb',{c:'Index',a:'NewGetList'},300000],
 articles:['apparticle',{c:'IndexPlate',a:'GetIndexList',view:'1,2,3,4,6',st:'2',Type:'0'},300000],
 market:['apphq',{c:'Index',a:'GetInfo',View:'2,3,4,5,7,9,10'},10000]
};
async function readGroup(key){
 const saved=cache.get(key),[host,params,ttl]=endpoints[key];
 if(saved&&Date.now()-saved.at<ttl)return saved;
 try{
  const response=await fetch(`https://${host}.longhuvip.com/w1/api/index.php`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'curl/8.7.1','Accept':'*/*'},body:new URLSearchParams({...params,apiv:'w48',PhoneOSNew:'1',VerSion:'6.3.20.2',Red:'0',DeviceID:''}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('上游 HTTP '+response.status);
  const data=await response.json();
  if(String(data.errcode)!=='0')throw new Error(data.errmsg||'接口错误 '+data.errcode);
  const fields={layout:['Index'],content:['Ad_4','Topic','Theme'],articles:['MsgTop','TCop','AiTop'],market:['PHBList','PLZList','ZQFKList','DaBanList','CWeatherVaneList','BaceFaceList','FKYDSixList']}[key];
  if(!fields.some(field=>Object.hasOwn(data,field)))throw new Error('上游未返回首页所需字段');
  const result={data,at:Date.now(),read:new Date().toISOString()};
  cache.set(key,result);return result;
 }catch(error){
  console.error(JSON.stringify({event:'home_upstream_failed',group:key,error:error.message}));
  return saved?{...saved,error:error.message}:{data:{},read:new Date().toISOString(),error:error.message};
 }
}
function section(group,data,date,options={}){
 const present=data!==undefined&&data!==null,empty=Array.isArray(data)&&!data.length;
 return {data:present?data:null,_state:!present?'unavailable':group.error?'stale':empty?'empty':options.locked?'locked':'ok',_source:'upstream',_dataDate:day(date),_retrievedAt:group.read,...(!present||group.error?{_warning:group.error||'上游未返回该区域数据'}:{}),...options};
}
export async function serveHome(){
 const [layout,content,articles,market]=await Promise.all(Object.keys(endpoints).map(readGroup)),l=layout.data,c=content.data,a=articles.data,m=market.data;
 const sections={
  menu:section(layout,l.Index,null),
  banners:section(content,c.Ad_4,Math.max(...(c.Ad_4||[]).map(row=>Number(row.start_time)))||null),
  tomorrow:section(content,c.Topic?.LData?.List,c.Topic?.Day),
  themes:section(content,c.Theme?.List,m.Day),
  articles:section(articles,a.MsgTop?.List,Math.max(...(a.MsgTop?.List||[]).map(row=>Number(row.CreateTime)))||null,{_stockDate:day(m.Day)}),
  popularity:section(market,m.PHBList,m.Day,{label:m.PHBTitle||''}),
  abnormal:section(market,m.PLZList,m.Day,{dataSource:m.DataSource,many:m.Many_Num,monitor:m.ZDJKList||[]}),
  ai:section(articles,a.AiTop?.List,a.AiTop?.List?.[0]?.Time,{_stockDate:day(m.Day)}),
  strongest:section(market,m.ZQFKList,m.Day,{locked:m.ZQFKISDY!=null&&Number(m.ZQFKISDY)!==1}),
  mood:section(market,m.DaBanList,m.Day),
  topics:section(articles,a.TCop?.List,Math.max(...(a.TCop?.List||[]).map(row=>Number(row.TimeStamp)))||null,{_stockDate:day(m.Day)}),
  vane:section(market,m.CWeatherVaneList,m.Day),
  active:section(market,m.BaceFaceList,m.Day),
  wind:section(market,m.FKYDSixList,m.Day)
 };
 if(sections.mood._state==='unavailable'){
  try{
   const counts=await fetchMarket('mood','latest');
   sections.mood={data:{SZJS:counts.list.SZJS,XDJS:counts.list.XDJS,tZhangTing:counts.list.ZTJS,tDieTing:counts.list.DTJS},_state:'partial',_source:'upstream',_dataDate:day(counts.Day?.[0]||counts.date),_retrievedAt:new Date().toISOString(),_warning:'首页行情接口未返回封板率、昨日对比及量能；已展示独立涨跌统计接口可用字段。'};
  }catch(error){sections.mood._warning+='；涨跌统计也暂不可用。';}
 }
 return Response.json({sections,_retrievedAt:new Date().toISOString()});
}
export async function searchStocks(url,{db}={}){
 const q=(url.searchParams.get('q')||'').trim();
 if(!q||q.length>40)return Response.json({error:'请输入1–40个字符的股票名称或代码'},{status:400});
 let directory=cache.get('stocks');
 if(!directory||Date.now()-directory.at>=300000){
  let ranking=rankingSnapshot.ranking,source='snapshot_catalog',date=ranking.Day[0];
  try{
   if(db){const {results}=await db.prepare('SELECT trade_date FROM archive_days ORDER BY trade_date DESC LIMIT 1').all();if(results[0]){const saved=await readArchive(db,results[0].trade_date,'rankings');if(saved?.list?.length){ranking=saved;date=results[0].trade_date;source='archive_catalog';}}}
  }catch(error){console.error(JSON.stringify({event:'home_catalog_archive_failed',error:error.message}));}
  directory={at:Date.now(),ranking,source,date};cache.set('stocks',directory);
 }
 const pinyin=new Map(catalog.map(row=>[row[0],row[2]])),stocks=directory.ranking.list.map(row=>[String(row[0]),String(row[1]),pinyin.get(String(row[0]))||'']);
 const key=q.toUpperCase().replace(/\s/g,''),matches=stocks.filter(([code,name,pinyin])=>code.includes(key)||name.toUpperCase().replace(/\s/g,'').includes(key)||pinyin.includes(key));
 matches.sort((a,b)=>(b[0]===key)-(a[0]===key)||(b[1]===q)-(a[1]===q)||a[0].localeCompare(b[0]));
 return Response.json({items:matches.slice(0,30).map(([code,name])=>({code,name})),_source:directory.source,_catalogVersion:directory.date,_retrievedAt:new Date().toISOString(),_warning:'名称目录截至 '+directory.date+'，拼音沿用原APP目录；后续新股或更名可输入六位代码查询最新行情。'});
}
export async function serveHomeImage(url){
 let target;
 try{target=new URL(url.searchParams.get('url'));}catch{return new Response('Invalid image URL',{status:400});}
 if(target.protocol!=='https:'||target.port||target.username||target.password||!(target.hostname==='appimgcdn.longhuvip.com'&&/^\/(IndexFuncImg|SchoolArticle|GuanggaoStartUp)\//.test(target.pathname)))return new Response('Image not allowed',{status:403});
 const key=new Request(target.href),saved=await caches.default.match(key);
 if(saved)return saved;
 const response=await fetch(target.href,{redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))return new Response('Image unavailable',{status:502});
 const result=new Response(response.body,{headers:{'Content-Type':response.headers.get('content-type'),'Cache-Control':'public,max-age=86400'}});
 await caches.default.put(key,result.clone());return result;
}
