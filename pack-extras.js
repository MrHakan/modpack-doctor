(()=>{
  const P=window.MDPack,Z=window.MDZip,dec=new TextDecoder();
  const baseArchive=P.scanArchive,baseLoose=P.scanLooseFiles;
  const stem=s=>String(s).split('/').pop().replace(/\.jar$/i,'').replace(/[-_]?v?\d+(?:\.\d+)+(?:[-+._a-z0-9]*)?$/i,'').toLowerCase().replace(/[^a-z0-9_.-]/g,'');
  function refresh(pack){pack.analysis=P.analyzePack(pack);pack.fingerprint=Z.hashText(pack.mods.map(m=>`${m.id}@${m.version}`).sort().join('|'));return pack}
  async function mrpackMeta(file,pack){
    if(!/\.(mrpack|zip)$/i.test(file.name))return pack;
    try{
      const buffer=await file.arrayBuffer(),entries=Z.list(buffer),idx=await Z.json(buffer,entries,'modrinth.index.json');
      if(idx){
        const loader=idx.dependencies?.['fabric-loader']?'Fabric':idx.dependencies?.['quilt-loader']?'Quilt':idx.dependencies?.neoforge?'NeoForge':idx.dependencies?.forge?'Forge':'Unknown';
        const existing=new Set(pack.mods.map(m=>m.id));
        for(const f of idx.files||[]){if(!/^mods\//i.test(f.path)||!/\.jar$/i.test(f.path))continue;const id=stem(f.path);if(existing.has(id))continue;const env=f.env||{},side=env.client==='unsupported'?'server':env.server==='unsupported'?'client':'*';pack.mods.push({id,name:f.path.split('/').pop(),version:'mrpack-index',filename:f.path,loader,side,deps:[],optionalDeps:[],mixinConfigs:[],mixins:[],access:null,embedded:[],entryNames:[],remote:true,hashes:f.hashes||{},downloads:f.downloads||[]});existing.add(id)}
        pack.modpackMeta={format:'Modrinth MRPACK',name:idx.name||file.name,versionId:idx.versionId||null,minecraft:idx.dependencies?.minecraft||null,loader,loaderVersion:idx.dependencies?.['fabric-loader']||idx.dependencies?.['quilt-loader']||idx.dependencies?.neoforge||idx.dependencies?.forge||null,indexedFiles:(idx.files||[]).length};
        return refresh(pack);
      }
      const manifest=await Z.json(buffer,entries,'manifest.json');
      if(manifest?.minecraft&&Array.isArray(manifest.files))pack.modpackMeta={format:'CurseForge export',name:manifest.name||file.name,version:manifest.version||null,minecraft:manifest.minecraft.version||null,loaders:(manifest.minecraft.modLoaders||[]).map(x=>x.id),indexedFiles:manifest.files.length,note:'CurseForge manifest stores project/file IDs rather than JAR metadata. Scan the actual mods folder for full dependency inspection.'};
    }catch{}
    return pack;
  }
  async function nestedContent(files,pack){
    let seen=0;
    for(const file of files){
      const path=file.mdRelativePath||file.webkitRelativePath||file.name;
      if(!/(^|\/)(resourcepacks|datapacks)\/.*\.zip$/i.test(path)||file.size>100*1024*1024||seen>=40)continue;
      seen++;
      try{
        const buffer=await file.arrayBuffer(),entries=Z.list(buffer);
        for(const e of entries){if(e.isDirectory||e.uncompressedSize>2*1024*1024||!/(^|\/)(data|assets)\/.*\.(json|mcmeta)$/i.test(e.name))continue;try{const text=dec.decode(await Z.extract(buffer,e)),full=`${path}!/${e.name}`;pack.textRecords.push({path:full,text,hash:Z.hashText(text),size:e.uncompressedSize});pack.configIssues.push(...P.analyzeTextFile(full,text))}catch{}}
      }catch{}
    }
    if(seen)refresh(pack);return pack;
  }
  P.scanArchive=async function(file,role='client',label=file.name){return mrpackMeta(file,await baseArchive(file,role,label))};
  P.scanLooseFiles=async function(files,role='client',label='Selected folder/files'){const arr=[...files],pack=await baseLoose(arr,role,label);return nestedContent(arr,pack)};
})();
