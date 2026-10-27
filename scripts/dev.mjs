import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('dist'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:8766');
  if(url.pathname.startsWith('/api/')){
   const response=await fetch('https://kpl-market-api.kpl-market-dashboard.workers.dev'+url.pathname+url.search);const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');headers.delete('transfer-encoding');res.writeHead(response.status,Object.fromEntries(headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!path.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  const body=await readFile(path);res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'});res.end(body);
 }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end(error.code==='ENOENT'?'Not found':'Request failed');}
}).listen(8766,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:8766'));
