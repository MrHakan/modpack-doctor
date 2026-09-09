(()=>{
  const td=new TextDecoder();
  function findEOCD(view){
    const min=Math.max(0,view.byteLength-0x10000-22);
    for(let i=view.byteLength-22;i>=min;i--) if(view.getUint32(i,true)===0x06054b50)return i;
    throw new Error('ZIP central directory not found');
  }
  function list(buffer){
    const view=new DataView(buffer),eocd=findEOCD(view),count=view.getUint16(eocd+10,true),offset=view.getUint32(eocd+16,true),out=[];
    let p=offset;
    for(let i=0;i<count&&p+46<=view.byteLength;i++){
      if(view.getUint32(p,true)!==0x02014b50)break;
      const method=view.getUint16(p+10,true),crc=view.getUint32(p+16,true),compressedSize=view.getUint32(p+20,true),uncompressedSize=view.getUint32(p+24,true),nameLen=view.getUint16(p+28,true),extraLen=view.getUint16(p+30,true),commentLen=view.getUint16(p+32,true),localOffset=view.getUint32(p+42,true);
      const name=td.decode(new Uint8Array(buffer,p+46,nameLen));
      out.push({name,method,crc,compressedSize,uncompressedSize,localOffset,isDirectory:name.endsWith('/')});
      p+=46+nameLen+extraLen+commentLen;
    }
    return out;
  }
  async function inflateRaw(bytes){
    if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot decompress deflated ZIP entries. Use a recent Chrome, Edge, Firefox, or Safari.');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function extract(buffer,entry){
    const view=new DataView(buffer),p=entry.localOffset;
    if(view.getUint32(p,true)!==0x04034b50)throw new Error(`Invalid local header for ${entry.name}`);
    const nameLen=view.getUint16(p+26,true),extraLen=view.getUint16(p+28,true),start=p+30+nameLen+extraLen;
    const raw=new Uint8Array(buffer,start,entry.compressedSize);
    if(entry.method===0)return new Uint8Array(raw);
    if(entry.method===8)return inflateRaw(raw);
    throw new Error(`Unsupported ZIP compression method ${entry.method} for ${entry.name}`);
  }
  function find(entries,name){
    const lower=name.toLowerCase();return entries.find(e=>e.name.toLowerCase()===lower);
  }
  async function text(buffer,entries,name){
    const e=find(entries,name);if(!e)return null;return td.decode(await extract(buffer,e));
  }
  async function json(buffer,entries,name){
    const t=await text(buffer,entries,name);if(t==null)return null;return JSON.parse(t.replace(/^\uFEFF/,''));
  }
  function hashBytes(bytes){
    let h=0x811c9dc5;for(let i=0;i<bytes.length;i++){h^=bytes[i];h=Math.imul(h,0x01000193)}return (h>>>0).toString(16).padStart(8,'0');
  }
  function hashText(text){return hashBytes(new TextEncoder().encode(text))}
  async function fileBuffer(file){return await file.arrayBuffer()}
  async function walkHandle(root){
    const out=[];
    async function walk(dir,prefix){
      for await(const [name,h] of dir.entries()){
        const path=prefix?`${prefix}/${name}`:name;
        if(h.kind==='directory')await walk(h,path);else{const f=await h.getFile();Object.defineProperty(f,'mdRelativePath',{value:path,configurable:true});out.push(f)}
      }
    }
    await walk(root,'');return out;
  }
  window.MDZip={list,extract,text,json,find,hashBytes,hashText,fileBuffer,walkHandle};
})();
