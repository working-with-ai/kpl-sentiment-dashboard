import {serveApi} from './api.js';
import seed from '../src/modules/capital-radar/snapshot.json';
const allowedOrigins=new Set(['https://working-with-ai.github.io','http://127.0.0.1:8766','http://localhost:8766']);
export default {async fetch(request){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 if(!['/api/rankings','/api/indexes'].includes(url.pathname))return new Response('Not found',{status:404});
 if(origin&&!allowedOrigins.has(origin))return new Response('Origin not allowed',{status:403});
 const headers=new Headers({'Vary':'Origin'});
 if(origin)headers.set('Access-Control-Allow-Origin',origin);
 if(request.method==='OPTIONS'){
  headers.set('Access-Control-Allow-Methods','GET, OPTIONS');
  return new Response(null,{status:204,headers});
 }
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers});
 const response=await serveApi(url,seed);
 const result=new Response(response.body,response);
 for(const [name,value] of headers)result.headers.set(name,value);
 return result;
}};
