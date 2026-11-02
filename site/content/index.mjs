const mods=[];for(let i=1;i<=11;i++){try{mods.push((await import(`./p${String(i).padStart(2,'0')}.mjs`)).default)}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e}}
import extras from './extras.mjs';
for(const P of mods){for(const X of [P,...P.clusters])for(const k of [X.slug,X.slug+'#2'])if(extras[k])X.sections.push(...extras[k]);}
export const pillars=mods;
