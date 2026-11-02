// Post-build checks: internal links resolve, JSON-LD parses, canonicals and core files exist.
import fs from 'node:fs'; import path from 'node:path';
const D='dist', SITE='https://codingagent.in'; const errs=[]; let pages=0, links=0;
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const files=walk(D); const exists=u=>{const p=path.join(D,decodeURI(u.split('#')[0].split('?')[0]));return fs.existsSync(p)&&(fs.statSync(p).isFile()||fs.existsSync(path.join(p,'index.html')));};
for(const f of ['index.html','404.html','sitemap.xml','robots.txt','llms.txt','llms-full.txt'])if(!fs.existsSync(path.join(D,f)))errs.push('missing '+f);
for(const f of files.filter(f=>f.endsWith('.html')&&!f.endsWith('milo-sample.html'))){pages++;const h=fs.readFileSync(f,'utf8');
  if(!f.endsWith('404.html')&&!h.includes(`<link rel="canonical" href="${SITE}`))errs.push(f+': no canonical');
  for(const m of h.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)){try{JSON.parse(m[1])}catch{errs.push(f+': bad JSON-LD')}}
  for(const m of h.matchAll(/href="(\/[^"]*)"/g)){links++;if(!exists(m[1]))errs.push(f+': broken '+m[1]);}
  if((h.match(/<h1[\s>]/g)||[]).length!==1)errs.push(f+': h1 count');}
const sm=fs.readFileSync(path.join(D,'sitemap.xml'),'utf8');for(const m of sm.matchAll(/<loc>([^<]+)<\/loc>/g)){if(!exists(m[1].replace(SITE,'')))errs.push('sitemap: '+m[1]);}
console.log(`pages ${pages}, internal links ${links}, errors ${errs.length}`);if(errs.length){console.error(errs.join('\n'));process.exit(1);}
