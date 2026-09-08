const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const SEVERITY_WEIGHT = {critical:30, high:20, medium:10, low:3};
const STOPWORDS = new Set(['minecraft','net','java','com','org','client','server','mixin','fabric','forge','neoforge','quilt','loader','util','impl','api','core','common','main','thread','exception','error','method','class']);
let loadedFiles = [];
let latestAnalysis = null;

const sample = `---- Minecraft Crash Report ----\n// This doesn't make any sense!\n\nTime: 2026-09-08 20:31:42\nDescription: Initializing game\n\norg.spongepowered.asm.mixin.transformer.throwables.MixinTransformerError: An unexpected critical error was encountered\nCaused by: org.spongepowered.asm.mixin.throwables.MixinApplyError: Mixin [examplemod.mixins.json:ClientMixin from mod examplemod] from phase [DEFAULT] in config [examplemod.mixins.json] FAILED during APPLY\nCaused by: org.spongepowered.asm.mixin.injection.throwables.InjectionError: Critical injection failure: Redirector renderHook()V in examplemod.mixins.json:ClientMixin failed injection check\n\n-- System Details --\nMinecraft Version: 1.20.1\nOperating System: Windows 11 (amd64) version 10.0\nJava Version: 17.0.10, Eclipse Adoptium\nJava VM Version: OpenJDK 64-Bit Server VM\nMemory: 2348810240 bytes (2240 MiB) / 4294967296 bytes (4096 MiB) up to 8589934592 bytes (8192 MiB)\nFabric Loader: 0.15.11\nFabric Mods:\n\tfabric-api: Fabric API 0.92.2+1.20.1\n\texamplemod: Example Mod 4.2.0\n\totherlib: Other Library 3.1.0\n`;

function setLog(text, filename){
  const ta=$('#logInput');
  if(ta.value.trim()) ta.value += `\n\n===== ${filename||'PASTED LOG'} =====\n` + text;
  else ta.value = text;
  updateCount();
}
function updateCount(){
  const t=$('#logInput').value;
  $('#charCount').textContent=`${t.length.toLocaleString()} chars · ${t.split(/\n/).length.toLocaleString()} lines`;
}
async function readFiles(files){
  for(const file of files){
    try{
      const text=await file.text();
      loadedFiles.push({name:file.name,size:file.size});
      setLog(text,file.name);
    }catch(err){console.error(err)}
  }
  renderFileChips();
}
function renderFileChips(){
  $('#fileChips').innerHTML=loadedFiles.map(f=>`<span class="file-chip">${escapeHtml(f.name)} · ${formatBytes(f.size)}</span>`).join('');
}
function formatBytes(n){if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function firstMatch(text, regexes){for(const re of regexes){const m=text.match(re);if(m)return m[1]||m[0]}return null}
function detectMeta(text){
  const mc=firstMatch(text,[/Minecraft Version:\s*([^\r\n]+)/i,/minecraft\s+(?:version\s*)?(1\.\d+(?:\.\d+)?)/i,/-- Minecraft --[\s\S]{0,300}?Version:\s*([^\r\n]+)/i]);
  let loader='Unknown',loaderVersion='—';
  let m=text.match(/Fabric Loader:?\s*([\w.+-]+)/i)||text.match(/fabricloader[\s:=]+([\w.+-]+)/i);if(m){loader='Fabric';loaderVersion=m[1]}
  m=text.match(/NeoForge(?: Version)?:?\s*([\w.+-]+)/i)||text.match(/neoforge[\s:=]+([\d.]+)/i);if(m){loader='NeoForge';loaderVersion=m[1]}
  if(loader==='Unknown'){m=text.match(/Forge(?: Version)?:?\s*([\w.+-]+)/i)||text.match(/forge[- ]([\d.]+)/i);if(m){loader='Forge';loaderVersion=m[1]}}
  m=text.match(/Quilt Loader:?\s*([\w.+-]+)/i)||text.match(/quilt_loader[\s:=]+([\w.+-]+)/i);if(m){loader='Quilt';loaderVersion=m[1]}
  const java=firstMatch(text,[/Java Version:\s*([^,\r\n]+)/i,/java version[:\s]+["']?([^"'\r\n ]+)/i,/Java:\s*([^\r\n]+)/i]);
  const os=firstMatch(text,[/Operating System:\s*([^\r\n]+)/i,/OS:\s*([^\r\n]+)/i]);
  const memory=firstMatch(text,[/Memory:\s*([^\r\n]+)/i,/JVM Flags:[^\r\n]*?-Xmx(\d+[GMK])/i]);
  let modCount=firstMatch(text,[/Loading\s+(\d+)\s+mods/i,/Loaded\s+(\d+)\s+mods/i,/Mods:\s*(\d+)/i]);
  if(!modCount){const ids=[...text.matchAll(/^\s*[\-\|\\+]*\s*([a-z0-9_.-]+):\s+.+$/gmi)].map(x=>x[1]);if(ids.length>10)modCount=String(new Set(ids).size)}
  return {mc:clean(mc)||'Unknown',loader,loaderVersion:clean(loaderVersion)||'—',java:clean(java)||'Unknown',os:clean(os)||'Unknown',memory:clean(memory)||'Unknown',modCount:modCount||'Unknown'};
}
function clean(v){return v?String(v).trim().replace(/[\t ]+/g,' '):v}
function excerptForPattern(lines, pattern){
  for(let i=0;i<lines.length;i++){
    pattern.lastIndex=0;
    if(pattern.test(lines[i])){
      const start=Math.max(0,i-2),end=Math.min(lines.length,i+4);
      return {line:i+1,text:lines.slice(start,end).map((l,j)=>`${String(start+j+1).padStart(5)} | ${l}`).join('\n')};
    }
  }
  return null;
}
function diagnose(text){
  const lines=text.split(/\r?\n/),found=[];
  for(const rule of window.MD_RULES){
    let evidence=null,matched=false;
    for(const p of rule.patterns){
      p.lastIndex=0;
      if(p.test(text)){matched=true;evidence=excerptForPattern(lines,p);break}
    }
    if(matched)found.push({...rule,evidence});
  }
  return found.sort((a,b)=>SEVERITY_WEIGHT[b.severity]-SEVERITY_WEIGHT[a.severity]||b.confidence-a.confidence);
}
function extractSuspects(text, diagnoses){
  const scores=new Map();
  const add=(name,score,why)=>{
    name=name.toLowerCase().replace(/[^a-z0-9_.-]/g,'');
    if(name.length<3||STOPWORDS.has(name)||/^\d/.test(name))return;
    const cur=scores.get(name)||{name,score:0,reasons:new Set()};cur.score+=score;cur.reasons.add(why);scores.set(name,cur);
  };
  for(const m of text.matchAll(/(?:from mod|mod id[:=]?|mod[:\s]+)[ '\[]*([a-z0-9_.-]{3,})/gi))add(m[1],22,'named by loader/error');
  for(const m of text.matchAll(/([a-z0-9_.-]{3,})\.mixins?\.json/gi))add(m[1],28,'mixin config');
  for(const m of text.matchAll(/mods[\\/]([^\\/\r\n]+?)\.jar/gi)){
    const stem=m[1].replace(/[-_]?\d+(?:\.\d+)+(?:[-+._a-z0-9]*)?$/i,'');add(stem,8,'JAR referenced near crash');
  }
  const important=text.split(/\r?\n/).filter(l=>/caused by:|exception|error|mixin|failed|at /i.test(l)).slice(-250);
  for(const line of important){
    for(const m of line.matchAll(/\b([a-z][a-z0-9_]{2,})\.[a-z0-9_$.]+/gi))add(m[1],/caused by|error|mixin/i.test(line)?6:2,'stack namespace');
  }
  if(diagnoses.some(d=>d.id==='exit-code-only')&&diagnoses.length===1)return [];
  return [...scores.values()].map(x=>({...x,reasons:[...x.reasons]})).sort((a,b)=>b.score-a.score).slice(0,12);
}
function healthScore(diagnoses){
  let score=100;
  diagnoses.forEach((d,i)=>score-=Math.max(2,SEVERITY_WEIGHT[d.severity]-(i*2)));
  return Math.max(5,Math.min(100,score));
}
function primaryHeadline(diags){
  if(!diags.length)return ['No known fatal signature found','The log may be incomplete, or the failure is outside the current rule set.'];
  return [diags[0].title,`${diags.length} diagnostic signal${diags.length===1?'':'s'} found · primary confidence ${diags[0].confidence}%`];
}
function analyze(){
  const text=$('#logInput').value.trim();
  if(!text){$('#logInput').focus();return}
  const meta=detectMeta(text),diagnoses=diagnose(text),suspects=extractSuspects(text,diagnoses),health=healthScore(diagnoses);
  latestAnalysis={text,meta,diagnoses,suspects,health,report:''};latestAnalysis.report=buildReport(latestAnalysis);
  renderResults(latestAnalysis);
}
function renderResults(a){
  $('#emptyState').classList.add('hidden');$('#results').classList.remove('hidden');
  const [h,s]=primaryHeadline(a.diagnoses);$('#headline').textContent=h;$('#summaryLine').textContent=s;
  const hg=$('#healthGauge');hg.className=`health ${a.health>=75?'good':a.health>=45?'warn':'bad'}`;$('#healthScore').textContent=a.health;
  const meta=[['Minecraft',a.meta.mc],['Loader',`${a.meta.loader} ${a.meta.loaderVersion==='—'?'':a.meta.loaderVersion}`.trim()],['Java',a.meta.java],['Mods',a.meta.modCount],['Memory',shortMemory(a.meta.memory)]];
  $('#metaGrid').innerHTML=meta.map(([k,v])=>`<div class="meta-card"><span>${k.toUpperCase()}</span><b>${escapeHtml(v)}</b></div>`).join('');
  $('#diagCount').textContent=a.diagnoses.length;$('#suspectCount').textContent=a.suspects.length;
  $('#diagnosesPane').innerHTML=a.diagnoses.length?a.diagnoses.map(renderDiagnosis).join(''):`<div class="diagnosis"><div class="diagnosis-title"><span class="severity-dot sev-low"></span><div><h4>No rule matched decisively</h4><p class="desc">Try providing both <b>latest.log</b> and the generated crash report. The earliest exception is usually more useful than the launcher exit code.</p></div></div></div>`;
  $('#suspectsPane').innerHTML=a.suspects.length?`<div class="suspect-grid">${a.suspects.map(renderSuspect).join('')}</div>`:`<div class="diagnosis"><p class="desc">No mod namespace was strong enough to rank. This is common with JVM/native crashes or incomplete launcher output.</p></div>`;
  $('#reportText').textContent=a.report;
  switchTab('diagnoses');
}
function shortMemory(v){if(v==='Unknown')return v;const x=v.match(/up to\s+.*?\((\d+) MiB\)/i);if(x)return `${(Number(x[1])/1024).toFixed(1)} GiB max`;return v.length>32?v.slice(0,29)+'…':v}
function renderDiagnosis(d){
  const ev=d.evidence?`<details class="evidence"><summary>Evidence around line ${d.evidence.line}</summary><pre>${escapeHtml(d.evidence.text)}</pre></details>`:'';
  return `<article class="diagnosis"><div class="diagnosis-top"><div class="diagnosis-title"><span class="severity-dot sev-${d.severity}"></span><div><h4>${escapeHtml(d.title)}</h4><p class="desc">${escapeHtml(d.description)}</p></div></div><span class="confidence">${d.confidence}% confidence</span></div><ol class="fixes">${d.fixes.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ol>${ev}</article>`;
}
function renderSuspect(s){const pct=Math.min(100,Math.round(s.score/55*100));return `<div class="suspect"><b>${escapeHtml(s.name)}</b><span>${escapeHtml(s.reasons.join(' · '))}</span><div class="suspect-meter"><i style="width:${pct}%"></i></div></div>`}
function buildReport(a){
  const lines=[];lines.push('# Modpack Doctor Report','',`Health score: ${a.health}/100`,'',`Minecraft: ${a.meta.mc}`,`Loader: ${a.meta.loader} ${a.meta.loaderVersion}`,`Java: ${a.meta.java}`,`OS: ${a.meta.os}`,`Detected mod count: ${a.meta.modCount}`,'','## Diagnoses');
  if(!a.diagnoses.length)lines.push('- No known diagnostic signature matched. Provide a fuller log/crash report.');
  a.diagnoses.forEach((d,i)=>{lines.push(`\n### ${i+1}. ${d.title} [${d.severity.toUpperCase()}]`,`Confidence: ${d.confidence}%`,d.description,'','Recommended actions:',...d.fixes.map(x=>`- ${x}`));if(d.evidence)lines.push('','Evidence:','```',d.evidence.text,'```')});
  lines.push('','## Suspect mods / namespaces');
  if(a.suspects.length)a.suspects.forEach(s=>lines.push(`- ${s.name} — score ${s.score} (${s.reasons.join(', ')})`));else lines.push('- No strong mod suspect extracted.');
  lines.push('','---','Generated locally by Modpack Doctor. Back up your instance before changing mods.');return lines.join('\n');
}
function switchTab(tab){$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));['diagnoses','suspects','report'].forEach(x=>$(`#${x}Pane`).classList.toggle('hidden',x!==tab))}
async function copyReport(){if(!latestAnalysis)return;await navigator.clipboard.writeText(latestAnalysis.report);const b=$('#copyReport'),old=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=old,1200)}
function downloadReport(){if(!latestAnalysis)return;const blob=new Blob([latestAnalysis.report],{type:'text/markdown'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='modpack-doctor-report.md';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function clearAll(){loadedFiles=[];renderFileChips();$('#logInput').value='';updateCount();latestAnalysis=null;$('#results').classList.add('hidden');$('#emptyState').classList.remove('hidden')}

$('#chooseFile').onclick=()=>$('#fileInput').click();$('#dropZone').onclick=()=>$('#fileInput').click();$('#dropZone').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#fileInput').click()}};$('#fileInput').onchange=e=>readFiles(e.target.files);$('#logInput').addEventListener('input',updateCount);$('#analyzeBtn').onclick=analyze;$('#clearBtn').onclick=clearAll;$('#loadSample').onclick=()=>{clearAll();setLog(sample,'sample-crash-report.txt');analyze()};$('#copyReport').onclick=copyReport;$('#downloadReport').onclick=downloadReport;$$('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
for(const ev of ['dragenter','dragover'])$('#dropZone').addEventListener(ev,e=>{e.preventDefault();$('#dropZone').classList.add('drag')});for(const ev of ['dragleave','drop'])$('#dropZone').addEventListener(ev,e=>{e.preventDefault();$('#dropZone').classList.remove('drag')});$('#dropZone').addEventListener('drop',e=>readFiles(e.dataTransfer.files));
updateCount();
