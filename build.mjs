import fs from 'node:fs'; import path from 'node:path';
import { SITE_URL, SITE_NAME, REPO_URL, UPDATED } from './config.mjs';
import { muzeBody } from './content/muze.mjs';
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
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt"><link rel="alternate" type="application/atom+xml" href="/feed.xml" title="BroCODE guides"><link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" href="/fonts/anybody-xx-900.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/anybody-var.woff2" as="font" type="font/woff2" crossorigin>
${HEADJS(url==='/')}<style>${css}</style>
${ld.length?`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':ld})}</script>`:''}
</head><body><a class="skip" href="#main">Skip to content</a>
<div class="fx fx-grain" aria-hidden="true"></div><div class="fx fx-lantern" aria-hidden="true"></div><div class="fx fx-frame" aria-hidden="true"></div>
<header class="hdr"><div class="wrap hrow"><a class="logo" href="/" aria-label="BroCODE home">${BOLT}Bro<b>CODE</b></a><nav class="hnav" aria-label="Primary"><a href="/guides/">Guides</a><a href="/faq/">FAQ</a><a href="/roadmap/">Roadmap</a><a href="/about/">About</a><button class="mt" id="mt" type="button" aria-pressed="true" aria-label="Motion"><i></i><i></i><i></i><span>Motion</span></button></nav></div></header>
<main id="main" class="wrap">${body}</main>
<footer class="ftr"><div class="wrap"><svg class="fword" viewBox="0 0 1180 140" role="img" aria-label="BroCODE"><text x="0" y="122" font-family="Anybody XX,Impact,sans-serif" font-weight="900" font-size="150" fill="#161a1e" stroke="#2a3036" stroke-width="3">Bro<tspan fill="#ffe62b" stroke="none">CODE</tspan></text></svg>
<nav aria-label="Footer"><ul class="fins"><li><a href="/guides/">Learning paths</a></li><li><a href="/faq/">FAQ</a></li><li><a href="/roadmap/">Roadmap</a></li><li><a href="/about/">About</a></li><li><a href="/editorial-policy/">Editorial policy</a></li><li><a href="/privacy/">Privacy</a></li><li><a href="/muze/">MuZe judge demo</a></li><li><a href="/llms.txt">Indexing</a></li><li><a href="/sitemap.xml">Site map</a></li><li><a href="${REPO_URL}" rel="noopener">GitHub ↗</a></li></ul></nav>
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
// roadmap
const RM=await import('./content/roadmap.mjs');
{const url='/roadmap/';const cr=[['Home','/'],['Roadmap',url]];
const card=(f,i,I)=>`<li class="cart reveal" id="${f.slug}" style="--r:${ROT[i%6]}"><div class="shell"><div class="sa-body"></div><div class="label"><div class="chips"><span class="chip p">Planned</span><span class="chip ${CH[(i+1)%4]}">${esc(f.tag)}</span><span class="chip c">${I.n}.${i+1}</span></div><h4>${esc(f.name)}</h4><p><strong>What it is.</strong> ${esc(f.what)}</p><p><strong>Why it matters.</strong> ${esc(f.why)}</p><p><strong>You stay in control.</strong> ${esc(f.control)}</p>${f.slug==='acceptance-checklist'?'<p><a href="/guides/prompting-for-code/">Read the Prompting for code guide ↗</a></p>':''}</div></div><span class="pstamp" aria-hidden="true">Planned</span></li>`;
const iters=RM.iterations.map(I=>`<section class="iter" id="${I.slug}" aria-labelledby="${I.slug}-h"><div class="ihead"><p class="eyebrow y">Iteration ${I.n} · target ${esc(I.weeks.toLowerCase())} from start</p><h3 id="${I.slug}-h" class="itit">${esc(I.name)}</h3><p class="lede"><strong>Goal:</strong> ${esc(I.goal)}</p>${I.note?`<p class="muted">${esc(I.note)}</p>`:''}</div><ul class="carts rmcarts">${I.features.map((f,i)=>card(f,i,I)).join('')}</ul></section>`).join('');
const body=`${crumbsHtml(cr)}<header class="filehead"><p class="stamp">Roadmap · planned, not shipped</p><p class="eyebrow y">The manifesto</p><h1>${esc(RM.PRINCIPLE)}</h1><p class="meta">Last updated <time datetime="${UPDATED}">${UPDATED}</time> · Target sequence, not dates</p></header>
<div class="answer" role="note" style="max-width:72ch">${SEAL}<p class="eyebrow">Status</p><p>${esc(RM.STATUS)}</p></div>
<nav class="seq" aria-label="Iterations"><ol>${RM.iterations.map(I=>`<li><a href="#${I.slug}"><span class="mono">${esc(I.weeks)}</span> ${I.n}. ${esc(I.name)}</a></li>`).join('')}</ol></nav>
<section class="sec" aria-labelledby="plan-h"><p class="eyebrow y">Five iterations · weeks from start are targets, not commitments</p><h2 id="plan-h" class="h2x">The plan</h2>${iters}</section>
<div style="max-width:72ch">${faqHtml(RM.faqs)}</div>
<p class="sec"><a class="btn" href="/guides/">What BroCODE does today ↗</a></p>`;
const all=RM.iterations.flatMap(I=>I.features.map(f=>({I,f})));
const ld=[ORG,crumbsLd(cr),{'@type':'WebPage','@id':SITE_URL+url+'#page',name:'BroCODE roadmap',url:SITE_URL+url,description:'Planned, not shipped: the BroCODE roadmap. '+RM.PRINCIPLE,dateModified:UPDATED,inLanguage:'en'},
{'@type':'ItemList',name:'BroCODE roadmap iterations (planned, not shipped; target sequence, not dates)',itemListOrder:'https://schema.org/ItemListOrderAscending',numberOfItems:RM.iterations.length,itemListElement:RM.iterations.map((I,i)=>({'@type':'ListItem',position:i+1,url:SITE_URL+url+'#'+I.slug,item:{'@type':'ItemList','@id':SITE_URL+url+'#'+I.slug,name:`Iteration ${I.n}: ${I.name} (planned; target ${I.weeks.toLowerCase()} from start)`,description:I.goal,numberOfItems:I.features.length,itemListElement:I.features.map((f,j)=>({'@type':'ListItem',position:j+1,name:f.name+' (planned)',description:f.what,url:SITE_URL+url+'#'+f.slug}))}}))},faqLd(RM.faqs)];
emit(url,layout({url,title:'Roadmap: Planned Features (Not Shipped) | BroCODE',desc:'BroCODE roadmap, planned and not shipped: five iterations from transparency and reversibility to verification, workflow, local-first intelligence and polish. Target weeks, not dates.',body,ld}),{title:'Roadmap',desc:'Planned, not shipped. '+RM.PRINCIPLE});
llmsFull.push(`# BroCODE roadmap (planned, not shipped)\nURL: ${SITE_URL+url}\n\nPrinciple: ${RM.PRINCIPLE}\n\n${RM.STATUS}\n\n${RM.iterations.map(I=>`## Iteration ${I.n}: ${I.name} (target ${I.weeks.toLowerCase()} from start; planned)\n\nGoal: ${I.goal}${I.note?'\n\n'+I.note:''}\n\n${I.features.map(f=>`- ${f.name} (planned): ${f.what} Why: ${f.why} Control: ${f.control}`).join('\n')}`).join('\n\n')}\n\n## FAQ\n\n${RM.faqs.map(f=>'Q: '+f.q+'\n\nA: '+f.a).join('\n\n')}`);}
// home
{const home=fs.readFileSync('content/home.html','utf8').replace('{{GUIDES}}',pillars.map((P,i)=>cart(`/guides/${P.slug}/`,P.title,P.card,[`File ${P.n}`,`${P.clusters.length} articles`],i)).join('')).replace(/\{\{TAPE\}\}/g,pillars.slice(0,6).map(P=>`<span>${esc(P.title)}</span>`).join('')).replace(/\{\{TAPE2\}\}/g,pillars.slice(6).map(P=>`<span>${esc(P.title)}</span>`).join('')).replace('{{TOPICS}}',pillars.map(P=>esc(P.title)).join(', ')).replace('{{N}}',pillars.length).replace(/\{\{BF:(.*?)\}\}/g,(m,t)=>bf(t)).replace('{{FAQ}}',homeFaq.map(x=>`<details><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join(''));
const ld=[ORG,{'@type':'WebSite','@id':SITE_URL+'/#site',name:SITE_NAME,url:SITE_URL+'/',publisher:{'@id':SITE_URL+'/#org'},inLanguage:'en'},
{'@type':'SoftwareApplication','@id':SITE_URL+'/#app',name:'BroCODE',applicationCategory:'DeveloperApplication',operatingSystem:'Android (release in preparation)',softwareVersion:'V3',description:'BroCODE is an AI-assisted coding workspace for editable source, reviewable changes and local projects, with local checkpoints, ZIP and JSON exports, a script-disabled static preview and consent before source is sent for AI help.',publisher:{'@id':SITE_URL+'/#org'}},faqLd(homeFaq)];
emit('/',layout({url:'/',title:'BroCODE — AI-Assisted Coding Workspace for Editable Source',desc:'BroCODE is an AI-assisted coding workspace: editable source files, reviewable AI diffs, local checkpoints, ZIP/JSON exports and consent before sending code. Android release in preparation.',body:home,ld}),{title:'Home',desc:'home'});}
// MuZe judge walkthrough and sample atlas
{
  const url = '/muze/';
  const title = 'MuZe V6 Judge Walkthrough | BroCODE';
  const desc = 'Explore the MuZe protocol map and run the self-hosted draft, approval and evidence demo.';
  emit(url, layout({url, title, desc, body: muzeBody}), {title, desc});
  fs.cpSync('static/muze', OUT + '/muze', {recursive: true});

  const catalogUrl = '/meta-500/';
  const catalogTitle = 'MuZe Sample Repository Atlas | BroCODE';
  const catalogDesc = 'Browse the supplied sample atlas and its 100-row shortlist.';
  const catalogBody = `<link rel="stylesheet" href="/muze/judge.css">
  <section class="muze" aria-labelledby="atlas-title"><p class="muze-kicker">MUZE V6 / SAMPLE CATALOG</p>
  <h1 id="atlas-title">Repository atlas</h1>
  <p>Supplied prototype data includes synthetic entries. Treat names and metadata as unverified sample content.</p>
  <p><a href="/muze/">Back to judge walkthrough</a></p>
  <label>Search sample entries<input id="muze-search" type="search"></label>
  <label class="muze-inline"><input id="muze-shortlist" type="checkbox"> Browse first 100 sample entries</label>
  <p id="muze-count" role="status">Loading sample catalog…</p>
  <ul id="muze-results" class="muze-grid muze-results"></ul></section><script src="/muze/catalog.js" defer></script>`;
  emit(catalogUrl, layout({url: catalogUrl, title: catalogTitle, desc: catalogDesc, body: catalogBody}), {title: catalogTitle, desc: catalogDesc});
}
// 404
fs.writeFileSync(path.join(OUT,'404.html'),layout({url:'/404.html',title:'Page not found | BroCODE',desc:'This page does not exist.',body:`<header class="filehead"><p class="stamp">File missing</p><h1>404 — nothing here.</h1></header><p>That page doesn't exist. Try the <a href="/guides/">guides</a>, the <a href="/faq/">FAQ</a> or the <a href="/">homepage</a>.</p>`}).replace('index,follow','noindex'));
// assets
fs.copyFileSync('static/favicon.svg',OUT+'/favicon.svg');fs.copyFileSync('static/og.png',OUT+'/og.png');fs.copyFileSync('static/milo-sample.html',OUT+'/milo-sample.html');fs.cpSync('static/fonts',OUT+'/fonts',{recursive:true});
fs.writeFileSync(OUT+'/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p=>`<url><loc>${SITE_URL+p.url}</loc><lastmod>${UPDATED}</lastmod></url>`).join('\n')}\n</urlset>\n`);
const bots=['GPTBot','OAI-SearchBot','ChatGPT-User','ClaudeBot','Claude-Web','anthropic-ai','PerplexityBot','Perplexity-User','Google-Extended','Googlebot','Bingbot','Applebot','Applebot-Extended','CCBot','Meta-ExternalAgent','Amazonbot','DuckAssistBot','cohere-ai'];
fs.writeFileSync(OUT+'/robots.txt',bots.map(b=>`User-agent: ${b}\nAllow: /\n`).join('\n')+`\nUser-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
const intro=`# BroCODE\n\n> BroCODE is an AI-assisted coding workspace for editable source, reviewable changes and local projects (V3). AI proposals are reviewable diffs; local edits are preserved; local checkpoints allow restoring earlier versions; files export as ZIP or JSON (exports omit conversation and snapshot history); the mobile static preview is script-disabled HTML inspection; source is sent for AI help only with explicit consent. The Android release is in preparation; pricing has not been announced.\n\nLast updated: ${UPDATED}\n`;
fs.writeFileSync(OUT+'/llms.txt',intro+`\n## Guides\n\n${pillars.map(P=>`- [${P.title}](${SITE_URL}/guides/${P.slug}/): ${P.desc}\n${P.clusters.map(c=>`  - [${c.title}](${SITE_URL}/guides/${P.slug}/${c.slug}/): ${c.desc}`).join('\n')}`).join('\n')}\n\n## About\n\n${simple.map(s=>`- [${s.title}](${SITE_URL+s.url}): ${s.desc}`).join('\n')}\n- [Roadmap](${SITE_URL}/roadmap/): planned, not shipped; five iterations with target weeks from start, not dates. Principle: ${RM.PRINCIPLE}
- [Full text for LLMs](${SITE_URL}/llms-full.txt)\n`);
fs.writeFileSync(OUT+'/llms-full.txt',intro+'\n\n'+llmsFull.join('\n\n---\n\n')+'\n');
fs.writeFileSync('wordcounts.txt',report.map(r=>r.join('\t')).join('\n'));
console.log('pages',pages.length+1,'min cluster words',Math.min(...report.filter(r=>r[0].split('/').length>4).map(r=>r[1])),'min pillar',Math.min(...report.filter(r=>r[0].split('/').length==4).map(r=>r[1])));
// ---- hardening + discovery files (generated from built output) ----
{const crypto=await import('node:crypto');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const htmls=walk(OUT).filter(f=>f.endsWith('.html'));const hashes=new Set();
for(const f of htmls){if(f.endsWith('milo-sample.html'))continue;for(const m of fs.readFileSync(f,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g))hashes.add(`'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);}
// Inline executable scripts are allowed only by hash; JSON-LD data blocks are not executed. Inline style attributes (per-character animation offsets) require style-src 'unsafe-inline'.
const CSP=`default-src 'none'; script-src 'self' ${[...hashes].join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests`;
const SEC={'Content-Security-Policy':CSP,'Strict-Transport-Security':'max-age=63072000; includeSubDomains; preload','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Resource-Policy':'same-origin','X-Frame-Options':'DENY'};
const LONG='public, max-age=31536000, immutable', SHORT='public, max-age=0, must-revalidate';
// milo-sample.html is a static preview sample: lock it down fully (no scripts at all).
const SAMPLE=CSP.replace(/script-src [^;]+;/,"script-src 'none';");
fs.writeFileSync(OUT+'/_headers',`/*\n${Object.entries(SEC).map(([k,v])=>`  ${k}: ${v}`).join('\n')}\n  Cache-Control: ${SHORT}\n\n/milo-sample.html\n  ! Content-Security-Policy\n  Content-Security-Policy: ${SAMPLE}\n\n/fonts/*\n  Cache-Control: ${LONG}\n  Access-Control-Allow-Origin: https://codingagent.in\n\n/favicon.svg\n  Cache-Control: public, max-age=604800\n\n/og.png\n  Cache-Control: public, max-age=604800\n  Cross-Origin-Resource-Policy: cross-origin\n\n/*.txt\n  Content-Type: text/plain; charset=utf-8\n\n/feed.xml\n  Content-Type: application/atom+xml; charset=utf-8\n`);
const vercel={$schema:'https://openapi.vercel.sh/vercel.json',buildCommand:'npm run build',outputDirectory:'dist',cleanUrls:false,trailingSlash:true,
headers:[{source:'/(.*)',headers:[...Object.entries(SEC).map(([key,value])=>({key,value})),{key:'Cache-Control',value:SHORT}]},
{source:'/milo-sample.html',headers:[{key:'Content-Security-Policy',value:SAMPLE}]},
{source:'/fonts/(.*)',headers:[{key:'Cache-Control',value:LONG}]},
{source:'/og.png',headers:[{key:'Cross-Origin-Resource-Policy',value:'cross-origin'},{key:'Cache-Control',value:'public, max-age=604800'}]}]};
fs.writeFileSync('vercel.json',JSON.stringify(vercel,null,2)+'\n');
fs.writeFileSync('netlify.toml',`# Generated by build.mjs. Headers live in dist/_headers.\n[build]\n  command = "npm run build"\n  publish = "dist"\n\n[build.environment]\n  NODE_VERSION = "20"\n`);
fs.mkdirSync(OUT+'/.well-known',{recursive:true});
const sec=`Contact: https://github.com/CodesbyFebin/BroCode/security/advisories/new\nExpires: 2027-11-01T00:00:00.000Z\nPreferred-Languages: en\nCanonical: ${SITE_URL}/.well-known/security.txt\nPolicy: ${REPO_URL}/blob/main/SECURITY.md\n`;
fs.writeFileSync(OUT+'/.well-known/security.txt',sec);fs.writeFileSync(OUT+'/security.txt',sec);
fs.writeFileSync(OUT+'/humans.txt',`/* TEAM */\nMaintainer: CodesbyFebin\nGitHub: https://github.com/CodesbyFebin\n\n/* SITE */\nLast update: ${UPDATED}\nStandards: HTML5, CSS3, schema.org JSON-LD, llms.txt\nComponents: none (dependency-free static generator)\nFonts: Anybody, Roboto Mono (SIL OFL, self-hosted)\nSource: ${REPO_URL}\n`);
fs.writeFileSync(OUT+'/ai.txt',`# ai.txt for ${SITE_URL}\n# AI crawlers and answer engines may read, index, summarise and cite this site.\n# Please attribute: "BroCODE (${SITE_URL})" and link the source page.\n# Roadmap items at /roadmap/ are PLANNED, not shipped. Do not describe them as available.\n# Pricing has not been announced. The Android release is in preparation.\n\nUser-Agent: *\nAllow: /\n\nSummary: ${SITE_URL}/llms.txt\nFull-text: ${SITE_URL}/llms-full.txt\nSitemap: ${SITE_URL}/sitemap_index.xml\n`);
fs.writeFileSync(OUT+'/manifest.webmanifest',JSON.stringify({name:'BroCODE',short_name:'BroCODE',description:'Source-grounded guides for BroCODE, an AI-assisted coding workspace.',start_url:'/',scope:'/',display:'browser',background_color:'#080b0d',theme_color:'#080b0d',icons:[{src:'/favicon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]},null,2));
const IDX='b7c0de5e0a1f4c2d9e3b6a8f1c4d7e20';fs.writeFileSync(OUT+`/${IDX}.txt`,IDX);
const posts=pages.filter(p=>p.url.split('/').length>4);
fs.writeFileSync(OUT+'/feed.xml',`<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><title>BroCODE guides</title><id>${SITE_URL}/</id><link href="${SITE_URL}/feed.xml" rel="self"/><link href="${SITE_URL}/"/><updated>${UPDATED}T00:00:00Z</updated><author><name>BroCODE</name></author>\n${posts.map(p=>`<entry><title>${esc(p.title)}</title><id>${SITE_URL+p.url}</id><link href="${SITE_URL+p.url}"/><updated>${UPDATED}T00:00:00Z</updated><summary>${esc(p.desc)}</summary></entry>`).join('\n')}\n</feed>\n`);
fs.writeFileSync(OUT+'/sitemap_index.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${SITE_URL}/sitemap.xml</loc><lastmod>${UPDATED}</lastmod></sitemap></sitemapindex>\n`);
fs.appendFileSync(OUT+'/robots.txt',`Sitemap: ${SITE_URL}/sitemap_index.xml\n`);
console.log('csp script hashes',hashes.size);}
