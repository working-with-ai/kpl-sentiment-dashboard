import {mkdir,cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await cp('index.html','dist/index.html');
await cp('src','dist/src',{recursive:true});
await mkdir('dist/src/vendor',{recursive:true});
await cp('node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.mjs','dist/src/vendor/lightweight-charts.mjs');
console.log('Built both modules into dist/');
