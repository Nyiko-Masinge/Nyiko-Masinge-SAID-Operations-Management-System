const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..', 'SAID Ops');
const ts = require(path.join(root, 'web-app/node_modules/typescript'));
function loader(mocks = {}, env = {}, extra = {}) {
  const cache = new Map();
  function load(relative) {
    const file = path.isAbsolute(relative) ? relative : path.join(root, relative);
    if (Object.hasOwn(mocks,file)) return mocks[file];
    if (cache.has(file)) return cache.get(file);
    const source=fs.readFileSync(file,'utf8');
    const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
    const exports={};cache.set(file,exports);
    const localRequire=createRequire(file);
    const scopedRequire=name=>{
      if(Object.hasOwn(mocks,name))return mocks[name];
      if(name.startsWith('.')){
        const base=path.resolve(path.dirname(file),name);
        const candidate=[base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx')].find(p=>fs.existsSync(p));
        if(candidate)return load(candidate);
      }
      return localRequire(name);
    };
    // The Admin transaction SDK requires a native-realm Promise from its callback.
    // Compile in the Node realm, injecting only boundaries/env instead of a second VM realm.
    vm.runInThisContext('(function(exports,require,process,fetch){\n'+compiled+'\n})',{filename:file})(exports,scopedRequire,{env},extra.fetch??fetch);
    return exports;
  }
  return load;
}
function hooks() {
  const source=fs.readFileSync(path.join(__dirname,'probe-ws1-locations.cjs'),'utf8');
  const result={};
  vm.runInNewContext(source.slice(0,source.indexOf('async function main()'))+'\nresult.react=react;result.Runner=Runner;result.element=element;',{
    result,require,__dirname,setImmediate,globalThis,
  });
  return result;
}
const plain=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
module.exports={loader,hooks,plain,deferred,root};
