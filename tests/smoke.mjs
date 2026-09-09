import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

global.window=global;
global.localStorage={getItem(){return null},setItem(){},removeItem(){}};
for(const file of ['zip-utils.js','pack-core.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const p=process.argv[2];
assert.ok(p,'fixture path required');
const b=fs.readFileSync(p);
const ab=b.buffer.slice(b.byteOffset,b.byteLength+b.byteOffset);
const mod=await global.MDPack.scanJarBuffer(ab,'examplemod-1.2.3.jar');
assert.equal(mod.id,'examplemod');
assert.equal(mod.version,'1.2.3');
assert.equal(mod.loader,'Fabric');
assert.equal(mod.mixins.length,1);
assert.equal(mod.mixins[0].classes.length,2);
assert.equal(mod.access.widener.lines.length,2);
assert.ok(mod.deps.some(d=>d.id==='missinglib'));

const pack={label:'fixture',role:'client',mods:[mod],embedded:[],textRecords:[],configIssues:[],paths:mod.entryNames};
const analysis=global.MDPack.analyzePack(pack);
assert.ok(analysis.issues.some(x=>x.type==='dependency'&&x.detail.includes('missinglib')));
console.log('Runtime pack-scanner smoke test passed');
