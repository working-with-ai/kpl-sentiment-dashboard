import {fetchMarket} from './upstream.js';
export async function readArchive(db,date,kind){
 if(!db)return null;
 const day=await db.prepare('SELECT saved_at FROM archive_days WHERE trade_date = ?').bind(date).first();
 if(!day)return null;
 const {results}=await db.prepare('SELECT payload FROM archive_chunks WHERE trade_date = ? AND dataset = ? ORDER BY part').bind(date,kind).all();
 if(!results.length)return null;
 const compressed=new Blob(results.map(row=>new Uint8Array(row.payload)));
 const data=await new Response(compressed.stream().pipeThrough(new DecompressionStream('gzip'))).json();
 return {...data,_source:'archive',_retrievedAt:day.saved_at,_archivedAt:day.saved_at};
}
export async function archiveDay(db,date){
 const existing=await db.prepare('SELECT stock_count FROM archive_days WHERE trade_date = ?').bind(date).first();
 if(existing)return {date,status:'already_archived',stocks:existing.stock_count};
 const ranking=await fetchMarket('rankings',date,{limit:1000});
 const count=Number(ranking.Count);
 if(!Number.isSafeInteger(count)||count<=0)throw new Error('全市场股票总数无效');
 const rows=[...ranking.list],codes=new Set(rows.map(row=>row[0]));
 while(rows.length<count){
  const page=await fetchMarket('rankings',date,{offset:rows.length,limit:1000});
  if(Number(page.Count)!==count||page.list.some(row=>codes.has(row[0])))throw new Error('股票分页不完整或数据发生变化');
  rows.push(...page.list);for(const row of page.list)codes.add(row[0]);
 }
 if(rows.length!==count||new Set(rows.map(row=>row[0])).size!==count||ranking.Min!=='0925'||ranking.Max!=='1500')throw new Error('全市场收盘榜单完整性检查失败');
 ranking.list=rows;
 const indexes=await fetchMarket('indexes',date),sentiment=await fetchMarket('sentiment',date),mood=await fetchMarket('mood',date);
 if(!['SH000001','SZ399001','SZ399006'].every(code=>indexes.List.some(index=>index.code===code&&index.trend?.at(-1)?.[0]==='15:00')))throw new Error('三大指数尚未包含完整收盘分时');
 if(sentiment.points.at(-1)?.time!=='1500')throw new Error('情绪曲线尚未包含收盘数据');
 const savedAt=new Date().toISOString(),statements=[db.prepare('DELETE FROM archive_chunks WHERE trade_date = ?').bind(date)];
 let bytes=0;
 for(const [kind,data] of Object.entries({rankings:ranking,indexes,sentiment,mood})){
  const stream=new Blob([JSON.stringify(data)]).stream().pipeThrough(new CompressionStream('gzip'));
  const compressed=new Uint8Array(await new Response(stream).arrayBuffer());bytes+=compressed.byteLength;
  for(let start=0,part=0;start<compressed.length;start+=131072,part++)statements.push(db.prepare('INSERT INTO archive_chunks (trade_date,dataset,part,payload) VALUES (?,?,?,?)').bind(date,kind,part,compressed.slice(start,start+131072)));
 }
 statements.push(db.prepare('INSERT INTO archive_days (trade_date,saved_at,stock_count,compressed_bytes) VALUES (?,?,?,?) ON CONFLICT(trade_date) DO UPDATE SET saved_at=excluded.saved_at,stock_count=excluded.stock_count,compressed_bytes=excluded.compressed_bytes').bind(date,savedAt,count,bytes));
 await db.batch(statements);
 return {date,status:'archived',stocks:count,bytes};
}
