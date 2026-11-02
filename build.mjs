import fs from 'node:fs'; import path from 'node:path';
import { SITE_URL, SITE_NAME, REPO_URL, UPDATED } from './config.mjs';
import { pillars } from './content/index.mjs';
const OUT='dist'; fs.rmSync(OUT,{recursive:true,force:true});
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const css=fs.readFileSync('style.css','utf8');
const pages=[]; const llmsFull=[];
const ORG={'@type':'Organization','@id':SITE_URL+'/#org',name:SITE_NAME,url:SITE_URL+'/',sameAs:[REPO_URL]};
const side=s=>`<aside class="side" aria-label="On this page"><div class="box"><h2>On this page</h2><ol>${s.map((x,i)=>`<li><a href="#s${i}">${esc(x.h)}</a></li>`).join('')}</ol></div></aside>`;
const words=t=>t.split(/\s+/).filter(Boolean).length;
const BOLT='<svg viewBox="0 0 24 32" aria-hidden="true"><path d="M15 0 L2 18 h8 L7 32 L22 13 h-8z"/></svg>';
const SEAL=`<span class="seal" aria-hidden="true">${BOLT}</span>`;
const bf=t=>{let i=0;return `<span class="sr-only">${t}</span><span class="bf" aria-hidden="true">${t.split(' ').map(w=>`<span class="w">${[...w].map(c=>`<span class="c" style="--i:${i++}">${c}</span>`).join('')}</span>`).join(' ')}</span>`;};
const ROT=['-1.2deg','.9deg','-.6deg','1.4deg','-1deg','.5deg'];const CH=['','c','p','g'];
const cart=(href,title,desc,chips,i,h='h3')=>`<li class="cart reveal" style="--r:${ROT[i%6]}"><div class="shell"><div class="sa-body"></div><div class="label"><div class="chips">${chips.map((c,j)=>`<span class="chip ${CH[(i+j)%4]}">${esc(c)}</span>`).join('')}</div><${h}><a href="${href}">${esc(title)}</a></${h}><p>${esc(desc)}</p><div class="redact" aria-hidden="true"><b></b><b></b><b></b></div></div></div><span class="peel" aria-hidden="true"></span>${SEAL}</li>`;
const HEADJS=home=>`<script>(function(){var d=document.documentElement,r=matchMedia('(prefers-reduced-motion: reduce)').matches,o=false,s=false;try{o=localStorage.getItem('bc-motion')==='off';s=sessionStorage.getItem('intro-seen')}catch(e){}d.classList.add('js',(r||o)?'no-motion':'anim');${home?"if(!r&&!o&&!s)d.classList.add('intro');":''}})()</script>`;
const FOOTJS=fs.readFileSync('content/site.js','utf8').trim();const HOMEJS=fs.readFileSync('content/home.js','utf8').trim();
function md(p){return esc(p).replace(/`([^`]+)`/g,'<code>$1</code>');}
function layout({url,title,desc,body,ld=[],type='website'}){
  const canon=SITE_URL+url;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canon}">
<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large"><meta name="theme-color" content="#080b0d">
<meta property="og:type" content="${type}"><meta property="og:site_name" content="${SITE_NAME}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canon}"><meta property="og:image" content="${SITE_URL}/og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${SITE_URL}/og.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt">
<link rel="preload" href="/fonts/anybody-xx-900.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/anybody-var.woff2" as="font" type="font/woff2" crossorigin>
${HEADJS(url==='/')}<style>${css}</style>
${ld.length?`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':ld})}</script>`:''}
</head><body><a class="skip" href="#main">Skip to content</a>
<div class="fx fx-grain" aria-hidden="true"></div><div class="fx fx-lantern" aria-hidden="true"></div><div class="fx fx-frame" aria-hidden="true"></div>
<header class="hdr"><div class="wrap hrow"><a class="logo" href="/" aria-label="BroCODE home">${BOLT}Bro<b>CODE</b></a><nav class="hnav" aria-label="Primary"><a href="/guides/">Guides</a><a href="/faq/">FAQ</a><a href="/about/">About</a><button class="mt" id="mt" type="button" aria-pressed="true" aria-label="Motion"><i></i><i></i><i></i><span>Motion</span></button></nav></div></header>
<main id="main" class="wrap">${body}</main>
<footer class="ftr"><div class="wrap"><svg class="fword" viewBox="0 0 1180 140" role="img" aria-label="BroCODE"><text x="0" y="122" font-family="Anybody XX,Impact,sans-serif" font-weight="900" font-size="150" fill="#161a1e" stroke="#2a3036" stroke-width="3">Bro<tspan fill="#ffe62b" stroke="none">CODE</tspan></text></svg>
<nav aria-label="Footer"><ul class="fins"><li><a href="/guides/">Learning paths</a></li><li><a href="/faq/">FAQ</a></li><li><a href="/about/">About</a></li><li><a href="/editorial-policy/">Editorial policy</a></li><li><a href="/privacy/">Privacy</a></li><li><a href="/llms.txt">Indexing</a></li><li><a href="/sitemap.xml">Site map</a></li><li><a href="${REPO_URL}" rel="noopener">GitHub ↗</a></li></ul></nav>
<p class="mono small">Your idea. Your source. Your call.</p><p class="mono small muted">© 2026 BroCODE · Source-grounded guides · Android release in preparation</p><p class="small muted">Documentation basis: supplied V3 source snapshot; repository HEAD and a production release are not verified.</p></div></footer>
<script>${FOOTJS}</script>${url==='/'?`<script>${HOMEJS}</script>`:''}
</body></html>`;}
function emit(url,html,meta){const f=path.join(OUT,url,url.endsWith('/')?'index.html':'');fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,html);if(meta)pages.push({url,...meta});}
const crumbsLd=items=>({'@type':'BreadcrumbList',itemListElement:items.map((c,i)=>({'@type':'ListItem',position:i+1,name:c[0],item:SITE_URL+c[1]}))});
const crumbsHtml=items=>`<nav aria-label="Breadcrumb" class="crumbs mono"><ol>${items.map((c,i)=>i<items.length-1?`<li><a href="${c[1]}">${esc(c[0])}</a></li>`:`<li aria-current="page">${esc(c[0])}</li>`).join('')}</ol></nav>`;
const faqLd=f=>({'@type':'FAQPage',mainEntity:f.map(x=>({'@type':'Question',name:x.q,acceptedAnswer:{'@type':'Answer',text:x.a}}))});
const faqHtml=f=>`<section aria-labelledby="faq-h"><h2 id="faq-h">Frequently asked questions</h2><div class="faqx">${f.map(x=>`<details><summary>${esc(x.q)}</summary><p>${md(x.a)}</p></details>`).join('')}</div></section>`;
function sectionsHtml(s){return s.map((x,i)=>`<section><h2 id="s${i}">${esc(x.h)}</h2>${(x.p||[]).map(p=>`<p>${md(p)}</p>`).join('')}${x.list?`<ul>${x.list.map(l=>`<li>${md(l)}</li>`).join('')}</ul>`:''}</section>`).join('');}
function stepsHtml(st){return st?`<section><h2>${esc(st.title)}</h2><ol class="steps">${st.steps.map(s=>`<li><strong>${esc(s[0])}.</strong> ${md(s[1])}</li>`).join('')}</ol></section>`:'';}
const howLd=(st,url)=>st?[{'@type':'HowTo',name:st.title,url:SITE_URL+url,step:st.steps.map((s,i)=>({'@type':'HowToStep',position:i+1,name:s[0],text:s[1]}))}]:[];
const art=(url,title,desc)=>({'@type':'TechArticle','@id':SITE_URL+url+'#article',headline:title,description:desc,url:SITE_URL+url,dateModified:UPDATED,datePublished:UPDATED,author:{'@id':SITE_URL+'/#org'},publisher:{'@id':SITE_URL+'/#org'},about:{'@id':SITE_URL+'/#app'},inLanguage:'en'});
const plain=x=>[x.summary,...x.sections.flatMap(s=>['## '+s.h,...(s.p||[]),...(s.list||[]).map(l=>'- '+l)]),...(x.steps?['## '+x.steps.title,...x.steps.steps.map((s,i)=>`${i+1}. ${s[0]}: ${s[1]}`)]:[]),'## FAQ',...x.faqs.flatMap(f=>['Q: '+f.q,'A: '+f.a])].join('\n\n');
const report=[];
// pillars & clusters
for(const [pi,P] of pillars.entries()){
  const purl=`/guides/${P.slug}/`;
  for(const C of P.clusters){
    const curl=purl+C.slug+'/'; const cr=[['Home','/'],['Guides','/guides/'],[P.title,purl],[C.title,curl]];
    const sib=P.clusters.filter(x=>x!==C);
    const body=`${crumbsHtml(cr)}<header class="filehead"><p class="stamp">File ${P.n} · cluster guide</p><p class="eyebrow y">${esc(P.title)}</p><h1>${esc(C.h1||C.title)}</h1><p class="meta">Last updated <time datetime="${UPDATED}">${UPDATED}</time> · Part of <a href="${purl}">${esc(P.title)}</a></p></header><div class="doc"><article>
<div class="answer">${SEAL}<p class="eyebrow">Short answer</p><p>${md(C.summary)}</p></div>${sectionsHtml(C.sections)}${stepsHtml(C.steps)}${faqHtml(C.faqs)}
<aside class="related" aria-labelledby="rel"><h2 id="rel">Keep going</h2><p>Back to the pillar guide: <a href="${purl}">${esc(P.title)}: the complete guide</a>.</p><ul>${sib.map(s=>`<li><a href="${purl+s.slug}/">${esc(s.title)}</a></li>`).join('')}</ul></aside></article>${side(C.sections)}</div>`;
    const ld=[ORG,art(curl,C.title,C.desc),crumbsLd(cr),faqLd(C.faqs),...howLd(C.steps,curl)];
    emit(curl,layout({url:curl,title:`${C.title} | ${SITE_NAME} Guides`,desc:C.desc,body,ld,type:'article'}),{title:C.title,desc:C.desc});
    llmsFull.push(`# ${C.title}\nURL: ${SITE_URL+curl}\n\n${plain(C)}`); report.push([curl,words(plain(C))]);
  }
  const cr=[['Home','/'],['Guides','/guides/'],[P.title,purl]];
  const prev=pillars[pi-1],next=pillars[pi+1];
  const body=`${crumbsHtml(cr)}<header class="filehead"><p class="stamp">File ${P.n} / ${pillars.length} · pillar guide</p><h1>${esc(P.h1)}</h1><p class="meta">Last updated <time datetime="${UPDATED}">${UPDATED}</time> · ${P.clusters.length} focused articles</p></header>
<nav aria-labelledby="inguide" class="toc"><h2 id="inguide" class="eyebrow y">In this guide cluster</h2><ul class="carts">${P.clusters.map((c,i)=>cart(purl+c.slug+'/',c.title,c.desc,[`${P.n}.${i+1}`,'Cluster'],i)).join('')}</ul></nav>
<div class="doc"><article><div class="answer">${SEAL}<p class="eyebrow">Short answer</p><p>${md(P.summary)}</p></div>
${sectionsHtml(P.sections)}${stepsHtml(P.steps)}${faqHtml(P.faqs)}
<nav aria-label="Pillar navigation" class="pn">${prev?`<a href="/guides/${prev.slug}/">← ${esc(prev.title)}</a>`:'<span></span>'}${next?`<a href="/guides/${next.slug}/">${esc(next.title)} →</a>`:''}</nav></article>${side(P.sections)}</div>`;
  const ld=[ORG,art(purl,P.h1,P.desc),crumbsLd(cr),faqLd(P.faqs),...howLd(P.steps,purl),{'@type':'ItemList',name:P.title+' cluster',itemListElement:P.clusters.map((c,i)=>({'@type':'ListItem',position:i+1,url:SITE_URL+purl+c.slug+'/',name:c.title}))}];
  emit(purl,layout({url:purl,title:`${P.title}: The Complete Guide | ${SITE_NAME}`,desc:P.desc,body,ld,type:'article'}),{title:P.title,desc:P.desc});
  llmsFull.push(`# ${P.h1}\nURL: ${SITE_URL+purl}\n\n${plain(P)}`); report.push([purl,words(plain(P))]);
}
// guides index
{const url='/guides/';const cr=[['Home','/'],['Guides',url]];
const body=`${crumbsHtml(cr)}<header class="filehead"><p class="stamp">The vault · ${pillars.length} files</p><h1>BroCODE guides: eleven learning paths</h1></header><div class="answer" style="max-width:72ch">${SEAL}<p class="eyebrow">Short answer</p><p>The BroCODE field guide is eleven pillar guides, each with focused cluster articles, covering the full workflow: from a first idea and a bounded prompt, through editing, review, checkpoints and static preview, to export, privacy, Android preparation, publishing and agent safety and verification.</p></div>
<ol class="glist">${pillars.map((P,i)=>`<li class="cart reveal" style="--r:${ROT[i%6]}"><div class="shell"><div class="sa-body"></div><div class="label"><div class="chips"><span class="chip">File ${P.n} / ${pillars.length}</span><span class="chip ${CH[(i+1)%4]}">${P.clusters.length} articles</span></div><h2><a href="/guides/${P.slug}/">${esc(P.title)}</a></h2><p>${esc(P.card)}</p><ul>${P.clusters.map(c=>`<li><a href="/guides/${P.slug}/${c.slug}/">${esc(c.title)}</a></li>`).join('')}</ul></div></div>${SEAL}</li>`).join('')}</ol>`;
emit(url,layout({url,title:'Guides: 11 Learning Paths for AI-Assisted Coding | BroCODE',desc:'Eleven pillar guides and focused articles on prompting, editing, reviewing AI changes, checkpoints, static preview, exports, privacy, Android, publishing and agent safety.',body,ld:[ORG,crumbsLd(cr),{'@type':'CollectionPage',name:'BroCODE guides',url:SITE_URL+url,dateModified:UPDATED}]}),{title:'Guides',desc:'index'});}
// simple pages
const {simple,homeFaq}=await import('./content/pages.mjs');
for(const S of simple){const cr=[['Home','/'],[S.title,S.url]];
 const body=`${crumbsHtml(cr)}<header class="filehead"><p class="stamp">Case file · ${esc(S.title)}</p><h1>${esc(S.h1)}</h1><p class="meta">Last updated <time datetime="${UPDATED}">${UPDATED}</time></p></header><div class="doc"><article><div class="answer">${SEAL}<p class="eyebrow">Short answer</p><p>${md(S.summary)}</p></div>${sectionsHtml(S.sections)}${S.faqs?faqHtml(S.faqs):''}</article>${side(S.sections)}</div>`;
 emit(S.url,layout({url:S.url,title:`${S.title} | ${SITE_NAME}`,desc:S.desc,body,ld:[ORG,crumbsLd(cr),S.faqs?faqLd(S.faqs):{'@type':'WebPage',name:S.title,url:SITE_URL+S.url,dateModified:UPDATED}]}),{title:S.title,desc:S.desc});
 llmsFull.push(`# ${S.h1}\nURL: ${SITE_URL+S.url}\n\n${plain({...S,faqs:S.faqs||[]})}`);}
// home
{const home=fs.readFileSync('content/home.html','utf8').replace('{{GUIDES}}',pillars.map((P,i)=>cart(`/guides/${P.slug}/`,P.title,P.card,[`File ${P.n}`,`${P.clusters.length} articles`],i)).join('')).replace(/\{\{TAPE\}\}/g,pillars.slice(0,6).map(P=>`<span>${esc(P.title)}</span>`).join('')).replace(/\{\{TAPE2\}\}/g,pillars.slice(6).map(P=>`<span>${esc(P.title)}</span>`).join('')).replace('{{TOPICS}}',pillars.map(P=>esc(P.title)).join(', ')).replace('{{N}}',pillars.length).replace(/\{\{BF:(.*?)\}\}/g,(m,t)=>bf(t)).replace('{{FAQ}}',homeFaq.map(x=>`<details><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join(''));
const ld=[ORG,{'@type':'WebSite','@id':SITE_URL+'/#site',name:SITE_NAME,url:SITE_URL+'/',publisher:{'@id':SITE_URL+'/#org'},inLanguage:'en'},
{'@type':'SoftwareApplication','@id':SITE_URL+'/#app',name:'BroCODE',applicationCategory:'DeveloperApplication',operatingSystem:'Android (release in preparation)',softwareVersion:'V3',description:'BroCODE is an AI-assisted coding workspace for editable source, reviewable changes and local projects, with local checkpoints, ZIP and JSON exports, a script-disabled static preview and consent before source is sent for AI help.',publisher:{'@id':SITE_URL+'/#org'}},faqLd(homeFaq)];
emit('/',layout({url:'/',title:'BroCODE — AI-Assisted Coding Workspace for Editable Source',desc:'BroCODE is an AI-assisted coding workspace: editable source files, reviewable AI diffs, local checkpoints, ZIP/JSON exports and consent before sending code. Android release in preparation.',body:home,ld}),{title:'Home',desc:'home'});}
// 404
fs.writeFileSync(path.join(OUT,'404.html'),layout({url:'/404.html',title:'Page not found | BroCODE',desc:'This page does not exist.',body:`<header class="filehead"><p class="stamp">File missing</p><h1>404 — nothing here.</h1></header><p>That page doesn't exist. Try the <a href="/guides/">guides</a>, the <a href="/faq/">FAQ</a> or the <a href="/">homepage</a>.</p>`}).replace('index,follow','noindex'));
// assets
fs.copyFileSync('static/favicon.svg',OUT+'/favicon.svg');fs.copyFileSync('static/og.png',OUT+'/og.png');fs.copyFileSync('static/milo-sample.html',OUT+'/milo-sample.html');fs.cpSync('static/fonts',OUT+'/fonts',{recursive:true});
fs.writeFileSync(OUT+'/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p=>`<url><loc>${SITE_URL+p.url}</loc><lastmod>${UPDATED}</lastmod></url>`).join('\n')}\n</urlset>\n`);
const bots=['GPTBot','OAI-SearchBot','ChatGPT-User','ClaudeBot','Claude-Web','anthropic-ai','PerplexityBot','Perplexity-User','Google-Extended','Googlebot','Bingbot','Applebot','Applebot-Extended','CCBot','Meta-ExternalAgent','Amazonbot','DuckAssistBot','cohere-ai'];
fs.writeFileSync(OUT+'/robots.txt',bots.map(b=>`User-agent: ${b}\nAllow: /\n`).join('\n')+`\nUser-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
const intro=`# BroCODE\n\n> BroCODE is an AI-assisted coding workspace for editable source, reviewable changes and local projects (V3). AI proposals are reviewable diffs; local edits are preserved; local checkpoints allow restoring earlier versions; files export as ZIP or JSON (exports omit conversation and snapshot history); the mobile static preview is script-disabled HTML inspection; source is sent for AI help only with explicit consent. The Android release is in preparation; pricing has not been announced.\n\nLast updated: ${UPDATED}\n`;
fs.writeFileSync(OUT+'/llms.txt',intro+`\n## Guides\n\n${pillars.map(P=>`- [${P.title}](${SITE_URL}/guides/${P.slug}/): ${P.desc}\n${P.clusters.map(c=>`  - [${c.title}](${SITE_URL}/guides/${P.slug}/${c.slug}/): ${c.desc}`).join('\n')}`).join('\n')}\n\n## About\n\n${simple.map(s=>`- [${s.title}](${SITE_URL+s.url}): ${s.desc}`).join('\n')}\n- [Full text for LLMs](${SITE_URL}/llms-full.txt)\n`);
fs.writeFileSync(OUT+'/llms-full.txt',intro+'\n\n'+llmsFull.join('\n\n---\n\n')+'\n');
fs.writeFileSync('wordcounts.txt',report.map(r=>r.join('\t')).join('\n'));
console.log('pages',pages.length+1,'min cluster words',Math.min(...report.filter(r=>r[0].split('/').length>4).map(r=>r[1])),'min pillar',Math.min(...report.filter(r=>r[0].split('/').length==4).map(r=>r[1])));
