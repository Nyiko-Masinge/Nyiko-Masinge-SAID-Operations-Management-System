// Shared local/CI gates. Never deploys or uses production credentials.
const {spawnSync}=require('node:child_process'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),mode=process.argv[2];
function run(command,args=[],options={}) {
  const windows=process.platform==='win32'&&!path.isAbsolute(command);
  const escaped=windows?args.map(arg=>/[\s"]/.test(arg)?'"'+arg.replaceAll('"','\\"')+'"':arg):args;
  const result=spawnSync(command,escaped,{cwd:root,stdio:'inherit',shell:windows,...options});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
const node=(...args)=>run(process.execPath,args);
if(mode==='deterministic') {
  const suites=['stage6a','stage6b','stage6c','roster-restoration','mobile-status-display','stage7a','stage7b','stage7c','stage7d','stage7e','stage7f','stage7g','spark-progress'];
  node('--test',...suites.map(name=>'scripts/'+name+'.test.cjs'),'SAID Ops/web-app/tests/roster-template-occurrence.test.cjs','SAID Ops/web-app/tests/supervisor-web-qa.test.cjs','functions/test/history.test.cjs','functions/test/notifications.test.cjs');
  for(const probe of ['probe-ws1-locations','probe-ws3-mobile','probe-ws4-safety'])node('scripts/'+probe+'.cjs');
  run(process.execPath,['tests/roster-final.cjs'],{cwd:path.join(root,'SAID Ops/web-app')});
  run(process.execPath,['node_modules/jest/bin/jest.js','--runInBand'],{cwd:path.join(root,'SAID Ops/web-app')});
  for(const file of ['index','history','notifications'])node('--check','functions/'+file+'.cjs');
} else if(['rules','integration'].includes(mode)) {
  // Code Attribution — WS5 security integration (Nyiko Masinge, ST10434307).
  // The rules branch follows Firebase's emulator-based security-test workflow;
  // its unchanged suites use authenticated contexts and assertSucceeds/assertFails.
  // Firebase (n.d.) 'Unit Test Security Rules' and '@firebase/rules-unit-testing'.
  // https://github.com/firebase/quickstart-testing/tree/master/unit-test-security-rules
  // https://github.com/firebase/firebase-js-sdk/tree/main/packages/rules-unit-testing
  // Accessed: 5 October 2026.
  node('scripts/create-stage6b-emulator-config.cjs');
  const suites=mode==='rules'?['security-tests/firestore.rules.test.mjs','security-tests/stage7a.rules.test.mjs']:
    ['scripts/stage6a-provision.test.cjs','scripts/stage6b-emulator.test.cjs','scripts/stage6c-emulator.test.cjs','scripts/roster-restoration-emulator.test.cjs','scripts/stage7a-emulator.test.cjs','scripts/stage7b-emulator.test.cjs','scripts/stage7c-emulator.test.cjs','scripts/stage7e-emulator.test.cjs','scripts/stage7f-emulator.test.cjs','scripts/stage7d-emulator.test.cjs','scripts/spark-progress-emulator.test.cjs'];
  run('firebase',['emulators:exec','--config',path.join(os.tmpdir(),'said-stage6b-tests.firebase.json'),'--only','auth,firestore','--project','demo-said-5ce3e','node scripts/run-emulator-suites.cjs '+suites.join(' ')],{env:{...process.env,SAID_EMULATOR_PROVISION:'true',SAID_E2E_TEST_PASSWORD:require('node:crypto').randomBytes(18).toString('hex')}});
} else throw Error('Choose deterministic, rules or integration.');
