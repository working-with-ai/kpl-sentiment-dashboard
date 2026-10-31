import {serveStock} from './stock.js';
import {serveApi} from './api.js';
import {archiveDay} from './archive.js';
import {serveHome,searchStocks,serveHomeImage} from './home.js';
import sentimentSeed from '../src/modules/sentiment/snapshot.json';
import seed from '../src/modules/capital-radar/snapshot.json';
const allowedOrigins=new Set(['https://working-with-ai.github.io','http://127.0.0.1:8766','http://localhost:8766']);
export default {async fetch(request,env){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 if(!['/api/home','/api/home/image','/api/stock/search','/api/rankings','/api/indexes','/api/sentiment','/api/mood','/api/stock/quote','/api/stock/trend','/api/stock/kline'].includes(url.pathname))return new Response('Not found',{status:404});
 if(origin&&origin!==url.origin&&!allowedOrigins.has(origin))return new Response('Origin not allowed',{status:403});
 const headers=new Headers({'Vary':'Origin'});
 if(origin)headers.set('Access-Control-Allow-Origin',origin);
 if(request.method==='OPTIONS'){
  headers.set('Access-Control-Allow-Methods','GET, OPTIONS');
  return new Response(null,{status:204,headers});
 }
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers});
 const response=url.pathname==='/api/home'?await serveHome():url.pathname==='/api/home/image'?await serveHomeImage(url):url.pathname==='/api/stock/search'?await searchStocks(url,{db:env.DB}):url.pathname.startsWith('/api/stock/')?await serveStock(url):await serveApi(url,seed,{db:env.DB,sentimentSeed});
 const result=new Response(response.body,response);
 for(const [name,value] of headers)result.headers.set(name,value);
 return result;
},
async scheduled(controller,env){
 const date=new Date(controller.scheduledTime+8*60*60*1000).toISOString().slice(0,10);
 try{console.log(JSON.stringify(await archiveDay(env.DB,date)));}
 catch(error){console.error(JSON.stringify({event:"archive_failed",date,error:error.message}));throw error;}
}};
