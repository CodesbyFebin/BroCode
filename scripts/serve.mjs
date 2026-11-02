// Local preview server that applies the production security headers from dist/_headers (global block).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const D=path.resolve('dist'), PORT=+process.env.PORT||8787;
const H=Object.fromEntries(fs.readFileSync(path.join(D,'_headers'),'utf8').split('\n\n')[0].split('\n').slice(1).map(l=>l.trim().split(/:\s(.+)/).slice(0,2)));
delete H['Strict-Transport-Security'];delete H['Content-Security-Policy'];H['Content-Security-Policy']=fs.readFileSync(path.join(D,'_headers'),'utf8').match(/Content-Security-Policy: (.+)/)[1].replace(' upgrade-insecure-requests','');
const T={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.xml':'application/xml','.webmanifest':'application/manifest+json'};
http.createServer((q,r)=>{let p=path.join(D,decodeURIComponent(q.url.split('?')[0]));if(!p.startsWith(D))p=D;if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');
const ok=fs.existsSync(p);if(!ok)p=path.join(D,'404.html');r.writeHead(ok?200:404,{...H,'Content-Type':T[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r);}).listen(PORT,()=>console.log('http://localhost:'+PORT));
