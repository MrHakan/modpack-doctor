(()=>{
  const Z=window.MDZip;
  const dec=new TextDecoder();
  const CORE_ID=/^(minecraft|java|fabricloader|fabric-api|forge|neoforge|quilt_loader|qsl|architectury|cloth[-_]?config|yet_another_config_lib|yacl|balm|bookshelf|moonlight|puzzleslib|geckolib|resourceful|owo|kotlin|fabric-language-kotlin)$/i;
  const TEXT_EXT=/\.(json|json5|toml|yaml|yml|properties|cfg|conf|txt|mcmeta)$/i;
  const CONFIG_PATH=/(^|\/)(config|defaultconfigs|serverconfig)\//i;
  const DATA_PATH=/(^|\/)data\/.*\.json$/i;
  const ASSET_PATH=/(^|\/)assets\/.*\.(json|mcmeta)$/i;
  const state={current:null,working:null,broken:null,lastDiff:null};
  const clean=s=>String(s??'').trim();
  const stem=s=>s.split('/').pop().replace(/\.jar$/i,'').replace(/[-_]?v?\d+(?:\.\d+)+(?:[-+._a-z0-9]*)?$/i,'').toLowerCase().replace(/[^a-z0-9_.-]/g,'');
  const escRe=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  function parseFabric(o){
    const deps=[];for(const [id,range] of Object.entries(o.depends||{}))deps.push({id,range:Array.isArray(range)?range.join(' || '):String(range),mandatory:true});
    const opt=[];for(const [id,range] of Object.entries(o.recommends||{}))opt.push({id,range:String(range),mandatory:false});
    const mixins=(o.mixins||[]).map(x=>typeof x==='string'?x:x.config).filter(Boolean);
    return {id:o.id||'',name:o.name||o.id||'',version:String(o.version||''),loader:'Fabric',side:o.environment||'*',deps,optionalDeps:opt,mixinConfigs:mixins,accessWidener:o.accessWidener||null,embeddedRefs:(o.jars||[]).map(x=>x.file).filter(Boolean)};
  }
  function parseQuilt(o){
    const q=o.quilt_loader||{},deps=[];
    for(const d of q.depends||[]){if(typeof d==='string')deps.push({id:d,range:'*',mandatory:true});else if(d&&d.id)deps.push({id:d.id,range:String(d.versions||d.version||'*'),mandatory:true})}
    return {id:q.id||'',name:q.metadata?.name||q.id||'',version:String(q.version||''),loader:'Quilt',side:q.environment||'*',deps,optionalDeps:[],mixinConfigs:(o.mixin||o.mixins||[]).map?.(x=>typeof x==='string'?x:x.config).filter(Boolean)||[],accessWidener:o.access_widener||null,embeddedRefs:[]};
  }
  function blockValue(block,key){const m=block.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']`,'mi'));return m?m[1]:null}
  function parseToml(text,kind){
    const modId=blockValue(text,'modId')||'',version=blockValue(text,'version')||'',name=blockValue(text,'displayName')||modId;
    const deps=[];for(const m of text.matchAll(/\[\[dependencies\.([^\]]+)\]\]([\s\S]*?)(?=\n\s*\[\[|$)/g)){
      const b=m[2],id=blockValue(b,'modId');if(!id)continue;const mandatory=!/^\s*mandatory\s*=\s*false/im.test(b),side=blockValue(b,'side')||'BOTH';deps.push({id,range:blockValue(b,'versionRange')||'*',mandatory,side});
    }
    return {id:modId,name,version,loader:kind,side:'*',deps:deps.filter(x=>x.mandatory),optionalDeps:deps.filter(x=>!x.mandatory),mixinConfigs:[],accessWidener:null,embeddedRefs:[]};
  }
  async function safeText(buffer,entries,name){try{return await Z.text(buffer,entries,name)}catch{return null}}
  async function scanJarBuffer(buffer,filename,parent=null,depth=0){
    let entries;try{entries=Z.list(buffer)}catch(e){return {id:stem(filename),name:filename,version:'?',filename,loader:'Unknown',side:'*',deps:[],optionalDeps:[],mixinConfigs:[],mixins:[],access:null,embedded:[],parent,error:e.message,entryNames:[]}}
    let meta=null,raw=null;
    try{const f=await Z.json(buffer,entries,'fabric.mod.json');if(f)meta=parseFabric(f)}catch{}
    if(!meta){try{const q=await Z.json(buffer,entries,'quilt.mod.json');if(q)meta=parseQuilt(q)}catch{}}
    if(!meta){raw=await safeText(buffer,entries,'META-INF/neoforge.mods.toml');if(raw)meta=parseToml(raw,'NeoForge')}
    if(!meta){raw=await safeText(buffer,entries,'META-INF/mods.toml');if(raw)meta=parseToml(raw,'Forge')}
    if(!meta)meta={id:stem(filename),name:filename,version:'?',loader:'Unknown',side:'*',deps:[],optionalDeps:[],mixinConfigs:[],accessWidener:null,embeddedRefs:[]};
    const mixins=[];
    for(const cfg of meta.mixinConfigs||[]){
      const t=await safeText(buffer,entries,cfg);if(!t)continue;
      try{const j=JSON.parse(t);const pkg=j.package||'',classes=[...(j.mixins||[]),...(j.client||[]),...(j.server||[])].map(x=>pkg?`${pkg}.${x}`:x);mixins.push({config:cfg,package:pkg,classes})}catch{mixins.push({config:cfg,package:'',classes:[],invalid:true})}
    }
    let aw=null,at=null;
    if(meta.accessWidener){const t=await safeText(buffer,entries,meta.accessWidener);if(t)aw={path:meta.accessWidener,lines:t.split(/\r?\n/).filter(x=>x.trim()&&!x.trim().startsWith('#')).slice(0,400)}}
    const atEntry=entries.find(e=>/META-INF\/accesstransformer\.cfg$/i.test(e.name));if(atEntry){const t=dec.decode(await Z.extract(buffer,atEntry));at={path:atEntry.name,lines:t.split(/\r?\n/).filter(x=>x.trim()&&!x.trim().startsWith('#')).slice(0,400)}}
    const embedded=[];
    const embeddedEntries=entries.filter(e=>/\.jar$/i.test(e.name)&&(/META-INF\/jars\//i.test(e.name)||/META-INF\/jarjar\//i.test(e.name)||(meta.embeddedRefs||[]).some(x=>x===e.name)));
    if(depth<1){for(const e of embeddedEntries.slice(0,80)){try{if(e.uncompressedSize>30*1024*1024)continue;const b=await Z.extract(buffer,e);const child=await scanJarBuffer(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),e.name,meta.id||stem(filename),depth+1);embedded.push(child)}catch{}}}
    return {...meta,id:meta.id||stem(filename),name:meta.name||meta.id||filename,filename,parent,mixins,access:{widener:aw,transformer:at},embedded,entryNames:entries.map(e=>e.name),size:buffer.byteLength};
  }
  function analyzeTextFile(path,text){
    const issues=[],ext=(path.split('.').pop()||'').toLowerCase();
    if(ext==='json'||ext==='mcmeta')try{JSON.parse(text.replace(/^\uFEFF/,''))}catch(e){issues.push({path,type:'json',severity:'high',message:e.message})}
    if(ext==='toml'){
      const sections=new Set();let section='';const keys=new Set();
      text.split(/\r?\n/).forEach((line,i)=>{const s=line.trim();if(!s||s.startsWith('#'))return;const sm=s.match(/^\[([^\]]+)\]$/);if(sm){section=sm[1];keys.clear();if(sections.has(section))issues.push({path,type:'toml',severity:'medium',line:i+1,message:`Duplicate section [${section}]`});sections.add(section);return}const km=s.match(/^([A-Za-z0-9_.-]+)\s*=/);if(km){const k=`${section}:${km[1]}`;if(keys.has(k))issues.push({path,type:'toml',severity:'medium',line:i+1,message:`Duplicate key ${km[1]}`});keys.add(k)}});
    }
    if(ext==='yaml'||ext==='yml'){text.split(/\r?\n/).forEach((line,i)=>{if(/^\t+/.test(line))issues.push({path,type:'yaml',severity:'medium',line:i+1,message:'Tab indentation can break YAML parsers'})})}
    if(ext==='properties'||ext==='cfg'){const seen=new Set();text.split(/\r?\n/).forEach((line,i)=>{const m=line.match(/^\s*([^#!\s][^=:#]*?)\s*[=:#]/);if(m){const k=m[1].trim();if(seen.has(k))issues.push({path,type:ext,severity:'low',line:i+1,message:`Duplicate key ${k}`});seen.add(k)}})}
    return issues;
  }
  async function extractTextRecords(buffer,entries){
    const records=[],issues=[];
    for(const e of entries){
      if(e.isDirectory||e.uncompressedSize>2*1024*1024)continue;
      const interesting=CONFIG_PATH.test(e.name)||DATA_PATH.test(e.name)||ASSET_PATH.test(e.name)||/(^|\/)pack\.mcmeta$/i.test(e.name)||/(^|\/)server\.properties$/i.test(e.name)||/(^|\/)instance\.cfg$/i.test(e.name)||/(^|\/)mmc-pack\.json$/i.test(e.name);
      if(!interesting||!TEXT_EXT.test(e.name))continue;
      try{const text=dec.decode(await Z.extract(buffer,e));records.push({path:e.name,text,hash:Z.hashText(text),size:e.uncompressedSize});issues.push(...analyzeTextFile(e.name,text))}catch(err){issues.push({path:e.name,type:'read',severity:'medium',message:err.message})}
    }
    return {records,issues};
  }
  async function scanArchive(file,role='client',label=file.name){
    const buffer=await file.arrayBuffer();
    if(/\.jar$/i.test(file.name)){const mod=await scanJarBuffer(buffer,file.name);const pack=finalizePack({label,role,mods:[mod],embedded:mod.embedded,textRecords:[],configIssues:[],paths:mod.entryNames,source:file.name});state.current=pack;return pack}
    const entries=Z.list(buffer),mods=[],embedded=[];
    const jars=entries.filter(e=>/\.jar$/i.test(e.name)&&!e.isDirectory);
    for(let i=0;i<jars.length;i++){
      const e=jars[i];try{if(e.uncompressedSize>80*1024*1024)continue;const b=await Z.extract(buffer,e),m=await scanJarBuffer(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),e.name);mods.push(m);embedded.push(...m.embedded)}catch(err){mods.push({id:stem(e.name),name:e.name,version:'?',filename:e.name,loader:'Unknown',side:'*',deps:[],optionalDeps:[],mixinConfigs:[],mixins:[],access:null,embedded:[],entryNames:[],error:err.message})}
      if(i%15===0)await new Promise(r=>setTimeout(r,0));
    }
    const tx=await extractTextRecords(buffer,entries);
    const pack=finalizePack({label,role,mods,embedded,textRecords:tx.records,configIssues:tx.issues,paths:entries.map(e=>e.name),source:file.name});state.current=pack;return pack;
  }
  async function scanLooseFiles(files,role='client',label='Selected folder/files'){
    const mods=[],embedded=[],textRecords=[],configIssues=[],paths=[];
    for(const file of files){
      const path=file.mdRelativePath||file.webkitRelativePath||file.name;paths.push(path);
      if(/\.jar$/i.test(path)){try{const m=await scanJarBuffer(await file.arrayBuffer(),path);mods.push(m);embedded.push(...m.embedded)}catch{}}
      else if(TEXT_EXT.test(path)&&file.size<=2*1024*1024&&(CONFIG_PATH.test(path)||DATA_PATH.test(path)||ASSET_PATH.test(path)||/(server\.properties|instance\.cfg|mmc-pack\.json|pack\.mcmeta)$/i.test(path))){try{const text=await file.text();textRecords.push({path,text,hash:Z.hashText(text),size:file.size});configIssues.push(...analyzeTextFile(path,text))}catch{}}
    }
    const pack=finalizePack({label,role,mods,embedded,textRecords,configIssues,paths,source:'folder/files'});state.current=pack;return pack;
  }
  function compatibility(modIds){
    const ids=new Set(modIds),out=[];
    const pair=(a,b,title,severity='high',confidence=85)=>{if(ids.has(a)&&ids.has(b))out.push({a,b,title,severity,confidence})};
    pair('sodium','optifine','Two competing rendering pipelines detected','critical',96);
    pair('sodium','embeddium','Sodium and Embeddium normally target different loader stacks','high',92);
    pair('rubidium','embeddium','Rubidium and Embeddium both replace the renderer','critical',95);
    pair('iris','oculus','Iris and Oculus are parallel shader implementations for different loader stacks','high',90);
    pair('starlight','phosphor','Multiple lighting-engine replacements are installed','high',88);
    pair('optifine','oculus','OptiFine and Oculus can overlap heavily in rendering hooks','high',82);
    pair('optifine','embeddium','OptiFine and Embeddium can overlap heavily in rendering hooks','high',88);
    return out;
  }
  function finalMods(pack){return [...pack.mods,...pack.embedded]}
  function analyzePack(pack){
    const mods=finalMods(pack),byId=new Map(),issues=[],reverse=new Map();
    for(const m of mods){if(!byId.has(m.id))byId.set(m.id,[]);byId.get(m.id).push(m)}
    for(const [id,list] of byId)if(list.length>1)issues.push({type:'duplicate',severity:'critical',title:`Duplicate mod ID: ${id}`,detail:list.map(x=>`${x.filename} (${x.version})`).join(' · '),mods:list.map(x=>x.id),confidence:98});
    for(const m of mods){for(const d of m.deps||[]){if(CORE_ID.test(d.id))continue;if(!reverse.has(d.id))reverse.set(d.id,new Set());reverse.get(d.id).add(m.id);if(!byId.has(d.id))issues.push({type:'dependency',severity:'critical',title:`Missing dependency: ${d.id}`,detail:`${m.id} requires ${d.id} ${d.range||''}`.trim(),mods:[m.id,d.id],confidence:96})}}
    for(const m of mods){const side=String(m.side||'*').toLowerCase();if(pack.role==='server'&&(side==='client'||side==='client_only'))issues.push({type:'side',severity:'high',title:`Client-only mod in server pack: ${m.id}`,detail:m.filename,mods:[m.id],confidence:94});if(pack.role==='client'&&(side==='server'||side==='server_only'))issues.push({type:'side',severity:'medium',title:`Server-only mod in client pack: ${m.id}`,detail:m.filename,mods:[m.id],confidence:88})}
    const compat=compatibility([...byId.keys()]);compat.forEach(c=>issues.push({type:'compatibility',severity:c.severity,title:c.title,detail:`${c.a} + ${c.b}`,mods:[c.a,c.b],confidence:c.confidence}));
    const mixinOwners=new Map();for(const m of mods)for(const cfg of m.mixins||[])for(const cls of cfg.classes||[]){if(!mixinOwners.has(cls))mixinOwners.set(cls,new Set());mixinOwners.get(cls).add(m.id)}
    for(const [cls,owners] of mixinOwners)if(owners.size>1)issues.push({type:'mixin',severity:'high',title:'Identical mixin class declared by multiple mods',detail:`${cls} · ${[...owners].join(', ')}`,mods:[...owners],confidence:82});
    const embeddedById=new Map();for(const m of mods)for(const e of m.embedded||[]){if(!embeddedById.has(e.id))embeddedById.set(e.id,[]);embeddedById.get(e.id).push({parent:m.id,version:e.version,filename:e.filename})}
    for(const [id,items] of embeddedById)if(new Set(items.map(x=>x.version)).size>1)issues.push({type:'library',severity:'medium',title:`Multiple embedded versions: ${id}`,detail:items.map(x=>`${x.parent} → ${x.version}`).join(' · '),mods:items.map(x=>x.parent),confidence:78});
    for(const c of pack.configIssues)issues.push({type:'config',severity:c.severity,title:`Config issue: ${c.path}`,detail:c.message,mods:[],confidence:c.type==='json'?98:72});
    const risk={};for(const m of pack.mods){const rev=reverse.get(m.id)?.size||0,mix=(m.mixins||[]).reduce((a,x)=>a+(x.classes?.length||0),0),access=(m.access?.widener?.lines?.length||0)+(m.access?.transformer?.lines?.length||0),emb=m.embedded?.length||0;risk[m.id]=Math.min(100,Math.round(rev*16+mix*2+Math.min(30,access*2)+emb*3+(m.loader==='Unknown'?5:0)))}
    const safeBoot=pack.mods.filter(m=>CORE_ID.test(m.id)||(reverse.get(m.id)?.size||0)>=2).sort((a,b)=>(reverse.get(b.id)?.size||0)-(reverse.get(a.id)?.size||0));
    const counts={critical:0,high:0,medium:0,low:0};issues.forEach(x=>counts[x.severity]=(counts[x.severity]||0)+1);
    const health={dependencies:Math.max(0,100-issues.filter(x=>x.type==='dependency'||x.type==='duplicate').length*22),compatibility:Math.max(0,100-issues.filter(x=>x.type==='compatibility'||x.type==='side').length*18),configs:Math.max(0,100-issues.filter(x=>x.type==='config').length*12),integrity:Math.max(0,100-issues.filter(x=>x.type==='library'||x.type==='mixin').length*12)};
    health.overall=Math.round((health.dependencies+health.compatibility+health.configs+health.integrity)/4);
    return {issues:issues.sort((a,b)=>({critical:4,high:3,medium:2,low:1}[b.severity]-({critical:4,high:3,medium:2,low:1}[a.severity]))),reverse,risk,safeBoot,compat,health,counts};
  }
  function finalizePack(pack){pack.mods=pack.mods.filter(Boolean);pack.embedded=pack.embedded||[];pack.analysis=analyzePack(pack);pack.fingerprint=Z.hashText(pack.mods.map(m=>`${m.id}@${m.version}`).sort().join('|'));pack.detected={prism:pack.paths.some(p=>/(^|\/)instance\.cfg$/i.test(p)||/(^|\/)mmc-pack\.json$/i.test(p)),world:pack.paths.some(p=>/(^|\/)level\.dat$/i.test(p)),server:pack.paths.some(p=>/(^|\/)server\.properties$/i.test(p)),datapacks:pack.paths.filter(p=>/(^|\/)datapacks\//i.test(p)).length,resourceFiles:pack.paths.filter(p=>ASSET_PATH.test(p)).length,dataFiles:pack.paths.filter(p=>DATA_PATH.test(p)).length};return pack}
  function diffPacks(a,b,analysis=null){
    const A=new Map(a.mods.map(m=>[m.id,m])),B=new Map(b.mods.map(m=>[m.id,m])),added=[],removed=[],changed=[],same=[];
    for(const [id,m] of B){if(!A.has(id))added.push(m);else{const old=A.get(id);if(old.version!==m.version||old.filename!==m.filename)changed.push({id,from:old,to:m});else same.push(m)}}for(const [id,m] of A)if(!B.has(id))removed.push(m);
    const suspects=new Map();const add=(id,score,why)=>{const cur=suspects.get(id)||{id,score:0,reasons:[]};cur.score+=score;if(!cur.reasons.includes(why))cur.reasons.push(why);suspects.set(id,cur)};
    added.forEach(m=>add(m.id,35,'new in broken pack'));changed.forEach(x=>add(x.id,45,'version/file changed'));removed.forEach(m=>add(m.id,12,'removed since working pack'));
    if(analysis?.suspects)for(const s of analysis.suspects){for(const id of B.keys())if(id.includes(s.name)||s.name.includes(id))add(id,Math.min(45,s.score),'also named by crash log')}
    for(const [id,score] of Object.entries(b.analysis.risk||{}))if(suspects.has(id))add(id,Math.round(score*.25),'high dependency/mixin blast radius');
    const out={added,removed,changed,same,suspects:[...suspects.values()].sort((x,y)=>y.score-x.score)};state.lastDiff=out;return out;
  }
  function configDiff(a,b){const A=new Map(a.textRecords.filter(x=>CONFIG_PATH.test(x.path)).map(x=>[x.path,x])),B=new Map(b.textRecords.filter(x=>CONFIG_PATH.test(x.path)).map(x=>[x.path,x])),added=[],removed=[],changed=[];for(const [p,r] of B){if(!A.has(p))added.push(r);else if(A.get(p).hash!==r.hash)changed.push({path:p,from:A.get(p),to:r})}for(const [p,r] of A)if(!B.has(p))removed.push(r);return {added,removed,changed}}
  function expectedJava(mc){const m=String(mc||'').match(/1\.(\d+)(?:\.(\d+))?/);if(!m)return null;const minor=+m[1],patch=+(m[2]||0);if(minor<=16)return 8;if(minor===17)return 16;if(minor<20||minor===20&&patch<=4)return 17;return 21}
  function runtimeDoctor(text,meta={}){
    text=String(text||'');const javaMajor=+(String(meta.java||'').match(/^(?:1\.)?(\d+)/)?.[1]||0),want=expectedJava(meta.mc),java={current:javaMajor||null,recommended:want,status:want&&javaMajor&&javaMajor!==want?'mismatch':'ok',message:want?`Minecraft ${meta.mc} generally expects Java ${want}${javaMajor?`; detected Java ${javaMajor}`:''}.`: 'Minecraft version was not detected.'};
    const xmx=text.match(/-Xmx(\d+)([GMK])/i),memLine=text.match(/Memory:\s*([^\r\n]+)/i),oom=/OutOfMemoryError|Java heap space|GC overhead limit exceeded|Direct buffer memory/i.test(text),gc=[...text.matchAll(/(?:Pause|GC\([^)]*\)).*?(\d+(?:\.\d+)?)ms/gi)].map(x=>+x[1]);
    const memory={xmx:xmx?`${xmx[1]}${xmx[2].toUpperCase()}`:null,oom,gcMax:gc.length?Math.max(...gc):null,message:oom?'Heap/native memory exhaustion is present in the log.':gc.length&&Math.max(...gc)>1000?'Long garbage-collection pauses are visible.':memLine?memLine[1]:'No decisive memory pressure signal.'};
    const gaps=[];let prev=null;const lines=text.split(/\r?\n/);for(let i=0;i<lines.length;i++){const m=lines[i].match(/\[?(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/);if(!m)continue;const t=((+m[1]*60+ +m[2])*60+ +m[3])*1000+ +(m[4]||0);if(prev&&t>=prev.t){const d=t-prev.t;if(d>=500)gaps.push({ms:d,line:i+1,before:prev.line,after:lines[i]})}prev={t,line:lines[i]}}
    gaps.sort((a,b)=>b.ms-a.ms);const startup={gaps:gaps.slice(0,12),maxGap:gaps[0]?.ms||0};
    const lag=[...text.matchAll(/Can't keep up!.*?running (\d+)ms|server is overloaded|skipped \d+ ticks/gi)].slice(0,50).map(x=>x[0]);
    const performance={signals:lag.length,examples:lag.slice(0,6),message:lag.length?`${lag.length} server/tick lag signal(s) found.`:'No classic tick-lag signature found.'};
    const vendor=(text.match(/(?:OpenGL vendor string|GL Vendor|Vendor):\s*([^\r\n]+)/i)||[])[1]||((/NVIDIA/i.test(text)&&'NVIDIA')||(/AMD|Radeon/i.test(text)&&'AMD')||(/Intel.*(?:Graphics|GPU)|Mesa Intel/i.test(text)&&'Intel')||'Unknown');
    const gpuErrors=[...text.matchAll(/GLFW error[^\r\n]*|OpenGL error[^\r\n]*|EXCEPTION_ACCESS_VIOLATION[^\r\n]*|nvoglv64|atio6axx|ig\d+icd/gi)].map(x=>x[0]).slice(0,12);const gpu={vendor,errors:gpuErrors,message:gpuErrors.length?'Graphics/native-driver crash signals detected.':'No strong GPU-driver crash signature.'};
    const registry=[...text.matchAll(/(?:registry|registry freeze|missing mapping|unknown registry|unbound values)[^\r\n]*/gi)].map(x=>x[0]).slice(0,15);
    const world=[...text.matchAll(/(?:chunk|level\.dat|failed to load world|exception reading chunk|corrupt(?:ed)? chunk|datafixer|missing dimension)[^\r\n]*/gi)].map(x=>x[0]).slice(0,15);
    const shader=[...text.matchAll(/(?:iris|oculus|shader|glsl|framebuffer|OpenGL).*?(?:error|failed|exception|invalid)[^\r\n]*/gi)].map(x=>x[0]).slice(0,15);
    const access=[...text.matchAll(/(?:access widener|accesswidener|access transformer|accesstransformer)[^\r\n]*/gi)].map(x=>x[0]).slice(0,20);
    const mixin=[...text.matchAll(/(?:MixinApplyError|MixinTransformerError|InjectionError|mixins?\.json)[^\r\n]*/gi)].map(x=>x[0]).slice(0,30);
    return {java,memory,startup,performance,gpu,registry,world,shader,access,mixin};
  }
  function contentSummary(pack){
    const brokenJson=pack.configIssues.filter(x=>x.type==='json'),data=pack.textRecords.filter(x=>DATA_PATH.test(x.path)),assets=pack.textRecords.filter(x=>ASSET_PATH.test(x.path));
    const kinds={recipes:0,tags:0,loot_tables:0,advancements:0,worldgen:0,models:0};for(const r of data){for(const k of ['recipes','tags','loot_tables','advancements','worldgen'])if(r.path.includes(`/${k}/`))kinds[k]++}for(const r of assets)if(r.path.includes('/models/'))kinds.models++;
    return {brokenJson,dataFiles:data.length,assetFiles:assets.length,kinds,datapackFiles:pack.detected.datapacks,worldDetected:pack.detected.world};
  }
  function normalizeCrash(text){return String(text||'').split(/\r?\n/).filter(x=>/caused by:|exception|error|mixin|failed|fatal|at [a-z0-9_.]+/i.test(x)).slice(-350).map(x=>x.toLowerCase().replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/g,'<uuid>').replace(/0x[a-f0-9]+/g,'<hex>').replace(/\b\d+(?:\.\d+){1,4}\b/g,'<ver>').replace(/[A-Z]:\\Users\\[^\\\s]+/gi,'<userpath>').replace(/\/home\/[^/\s]+/g,'<userpath>').replace(/\s+/g,' ').trim()).filter(Boolean)}
  function crashFingerprint(text){const lines=normalizeCrash(text),tokens=new Set(lines.flatMap(x=>x.split(/[^a-z0-9_.-]+/).filter(t=>t.length>4)));return {hash:Z.hashText(lines.join('\n')),lines,tokens:[...tokens].slice(0,800)}}
  function fingerprintSimilarity(a,b){const A=new Set(a.tokens||[]),B=new Set(b.tokens||[]);if(!A.size&&!B.size)return 0;let hit=0;A.forEach(x=>B.has(x)&&hit++);return Math.round(hit/(A.size+B.size-hit)*100)}
  function saveCrashFingerprint(text,meta={}){const fp=crashFingerprint(text),hist=JSON.parse(localStorage.getItem('mdCrashHistory')||'[]'),best=hist.map(h=>({...h,similarity:fingerprintSimilarity(fp,h.fp)})).sort((a,b)=>b.similarity-a.similarity)[0]||null;hist.unshift({at:new Date().toISOString(),meta,fp});localStorage.setItem('mdCrashHistory',JSON.stringify(hist.slice(0,40)));return {fp,best}}
  function saveSnapshot(pack,name){const snaps=JSON.parse(localStorage.getItem('mdPackSnapshots')||'[]'),snap={id:crypto.randomUUID?.()||String(Date.now()),at:new Date().toISOString(),name:name||pack.label,fingerprint:pack.fingerprint,role:pack.role,mods:pack.mods.map(m=>({id:m.id,name:m.name,version:m.version,filename:m.filename,loader:m.loader,side:m.side})),configs:pack.textRecords.filter(x=>CONFIG_PATH.test(x.path)).map(x=>({path:x.path,hash:x.hash})),health:pack.analysis.health};snaps.unshift(snap);localStorage.setItem('mdPackSnapshots',JSON.stringify(snaps.slice(0,25)));return snap}
  function snapshots(){return JSON.parse(localStorage.getItem('mdPackSnapshots')||'[]')}
  function rollbackPlan(snap,current){const old={mods:snap.mods},d=diffPacks(old,current);return {restore:d.removed.map(m=>`Restore ${m.id} ${m.version}`),remove:d.added.map(m=>`Remove ${m.id} ${m.version}`),downgrade:d.changed.map(x=>`Change ${x.id}: ${x.to.version} → ${x.from.version}`)}}
  function redact(text){return String(text||'').replace(/([A-Z]:\\Users\\)[^\\\r\n]+/gi,'$1<user>').replace(/(\/home\/)[^/\s]+/g,'$1<user>').replace(/(\/Users\/)[^/\s]+/g,'$1<user>').replace(/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,'<email>').replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b/g,'<ip>').replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\b/gi,'<uuid>').replace(/((?:token|access_token|authorization|apikey|api_key|password)\s*[=:]\s*)[^\s&]+/gi,'$1<redacted>')}
  function issueReport(core,pack){const rt=runtimeDoctor(core?.text||'',core?.meta||{}),lines=['# Modpack issue report','',`Generated: ${new Date().toISOString()}`,'', '## Environment',`- Minecraft: ${core?.meta?.mc||'Unknown'}`,`- Loader: ${core?.meta?.loader||'Unknown'} ${core?.meta?.loaderVersion||''}`.trim(),`- Java: ${core?.meta?.java||'Unknown'}`,`- OS: ${redact(core?.meta?.os||'Unknown')}`,`- Pack mods: ${pack?.mods?.length??'Unknown'}`,'','## Primary diagnosis'];if(core?.diagnoses?.length)core.diagnoses.slice(0,5).forEach(d=>lines.push(`- ${d.title} (${d.confidence}%): ${d.description}`));else lines.push('- No core crash diagnosis available.');if(pack?.analysis?.issues?.length){lines.push('','## Pack integrity findings');pack.analysis.issues.slice(0,12).forEach(x=>lines.push(`- [${x.severity}] ${x.title}: ${x.detail}`))}lines.push('','## Runtime notes',`- Java advisor: ${rt.java.message}`,`- Memory: ${rt.memory.message}`,`- Performance: ${rt.performance.message}`,`- GPU: ${rt.gpu.message}`,'','## Reproduction steps','1. ','2. ','3. ','','## Sanitized evidence');for(const d of core?.diagnoses?.slice(0,3)||[])if(d.evidence)lines.push('```text',redact(d.evidence.text),'```');return lines.join('\n')}
  function oneClickReport(pack,core){const c=contentSummary(pack),lines=['# Modpack Doctor — Full Pack Report','',`Pack: ${pack.label}`,`Fingerprint: ${pack.fingerprint}`,`Role: ${pack.role}`,`Mods: ${pack.mods.length} top-level + ${pack.embedded.length} embedded`,`Health: ${pack.analysis.health.overall}/100`,'','## Health dashboard',...Object.entries(pack.analysis.health).map(([k,v])=>`- ${k}: ${v}/100`),'','## Integrity findings'];pack.analysis.issues.slice(0,80).forEach(x=>lines.push(`- [${x.severity}] ${x.title} — ${x.detail}`));lines.push('','## Highest update-risk mods');Object.entries(pack.analysis.risk).sort((a,b)=>b[1]-a[1]).slice(0,25).forEach(([id,r])=>lines.push(`- ${id}: ${r}/100`));lines.push('','## Safe boot candidates',...pack.analysis.safeBoot.slice(0,60).map(m=>`- ${m.id} ${m.version}`),'','## Content doctor',`- Data JSON files inspected: ${c.dataFiles}`,`- Asset JSON files inspected: ${c.assetFiles}`,`- Broken JSON/config signals: ${c.brokenJson.length}`,`- World structure detected: ${c.worldDetected?'yes':'no'}`);if(core){lines.push('','## Crash correlation');core.suspects?.slice(0,15).forEach(s=>lines.push(`- ${s.name}: ${s.score}`))}return lines.join('\n')}
  window.MDPack={state,scanArchive,scanLooseFiles,scanJarBuffer,analyzePack,diffPacks,configDiff,expectedJava,runtimeDoctor,contentSummary,crashFingerprint,fingerprintSimilarity,saveCrashFingerprint,saveSnapshot,snapshots,rollbackPlan,redact,issueReport,oneClickReport,analyzeTextFile};
})();
