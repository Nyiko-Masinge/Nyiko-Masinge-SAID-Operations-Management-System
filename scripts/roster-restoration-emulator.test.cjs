// Opt-in isolated demo emulator; only the requested physical-device scenario is created.
const test=require('node:test'),assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto'),fs=require('node:fs');
const {loader,hooks,plain}=require('./stage6b-test-support.cjs');
const {provision,provisioningConfig,PROJECT_ID}=require('./provision-emulator-e2e.cjs');
const req=require('node:module').createRequire(require('node:path').join(__dirname,'../SAID Ops/web-app/package.json'));
const appSdk=req('firebase/app'),authSdk=req('firebase/auth'),sdk=req('firebase/firestore');
const adminSdk=req('firebase-admin/app');
const env={...process.env,SAID_E2E_TEST_PASSWORD:randomBytes(18).toString('hex')},week='2026-10-05';
let fixtures,app,auth,db,load,server,POST,publisher,first,old,staffTasks;
async function login(id){const person=fixtures.accounts.find(p=>p.employeeId===id);await authSdk.signInWithEmailAndPassword(auth,person.email,env.SAID_E2E_TEST_PASSWORD);return person;}
async function publish(payload){await login('ADMIN001');const token=await auth.currentUser.getIdToken();const response=await POST(new Request('http://localhost/api/rosters/publish',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)}));assert.equal(response.status,200);return response.json();}
async function current(){await login('ADMIN001');return load('web-app/lib/roster/currentPublication.ts').readCurrentRosterPublication(week);}
test.before(async()=>{
  const config=provisioningConfig(env);fixtures=await provision(env);
  Object.assign(process.env,{SAID_ROSTER_BACKEND:'firestore',SAID_FIREBASE_EMULATORS_ENABLED:'true',SAID_FIREBASE_PROJECT_ID:PROJECT_ID,NEXT_PUBLIC_FIREBASE_PROJECT_ID:PROJECT_ID});
  server=loader({'server-only':{}},process.env);POST=server('web-app/app/api/rosters/publish/route.ts').POST;publisher=server('web-app/lib/server/admin.ts').publicationStore();
  app=appSdk.initializeApp({projectId:PROJECT_ID,apiKey:'fake-api-key',authDomain:PROJECT_ID+'.firebaseapp.com'},'roster-restoration');auth=authSdk.getAuth(app);authSdk.connectAuthEmulator(auth,config.authUrl,{disableWarnings:true});db=sdk.getFirestore(app);const host=new URL(config.firestoreUrl);sdk.connectFirestoreEmulator(db,host.hostname,Number(host.port));
  const progressPOST=server('web-app/app/api/mobile/task-progress/route.ts').POST;
  load=loader({'firebase/firestore':sdk,'./firebase':{getFirebaseDb:()=>db,getFirebaseAuth:()=>auth},'../firebase':{getFirebaseDb:()=>db,getFirebaseAuth:()=>auth}},
    {NEXT_PUBLIC_ROSTER_BACKEND:'firestore',EXPO_PUBLIC_ROSTER_BACKEND:'firestore',EXPO_PUBLIC_API_BASE_URL:'http://localhost',EXPO_PUBLIC_FIREBASE_EMULATORS_ENABLED:'true'},
    {fetch:(url,options)=>progressPOST(new Request(url,options))});
});
test.after(async()=>{
  if(process.env.SAID_ROSTER_QA_OUTPUT&&fixtures)fs.writeFileSync(process.env.SAID_ROSTER_QA_OUTPUT,JSON.stringify({password:env.SAID_E2E_TEST_PASSWORD,admin:fixtures.accounts.find(p=>p.employeeId==='ADMIN001').uid,week}));
  if(auth)await authSdk.signOut(auth);if(app)await appSdk.deleteApp(app);for(const a of adminSdk.getApps().filter(a=>a.name==='said-roster-publisher'))await adminSdk.deleteApp(a);
});
test('real ADMIN001 publication restores both stable identities and STAFF001 assignments',async()=>{
  const staff=fixtures.accounts.find(p=>p.employeeId==='STAFF001');
  first=await publish({weekStart:week,confirmCoverage:false,items:['Mobile QA - Parvo Ward Check','Mobile QA - Unable Test'].map((title,i)=>({scheduledWorkId:i?'qa-unable-test':'qa-parvo-check',date:week,title,description:'Physical-device roster restoration scenario',startTime:i?'10:00':'08:00',endTime:i?'11:00':'09:00',locationId:'parvo',requiredStaff:1,isCritical:i===0,assignedEmployees:[{uid:staff.uid,employeeId:staff.employeeId}]}))});
  const result=await current();assert.equal(result.version,first.version);assert.equal(result.items.length,2);assert.deepEqual(result.items.map(i=>i.id),['qa-parvo-check','qa-unable-test']);assert(result.items.every(i=>i.assignedUids[0]===staff.uid));
  old=await Promise.all(result.items.map(i=>publisher.read(`publishedRosters/${week}/versions/${first.version}/items/${i.id}`)));
});
test('real nested Start/Complete/Unable/Reopen never removes membership; prior unable reason survives',async()=>{
  const person=await login('STAFF001'),mobile=load('mobile-app/lib/publishedRoster.ts'),progress=load('mobile-app/lib/taskProgress.ts');
  staffTasks=(await mobile.readCurrentPublication(week,person.uid)).tasks;assert(staffTasks.every(t=>t.status==='Scheduled'));
  for(const [index,transitions]of [[0,['In Progress','Completed']],[1,['In Progress','Unable to Complete','In Progress']]]){
    let task=staffTasks[index];for(const state of transitions){await login('STAFF001');await progress.saveTaskProgress(task,state,state==='Unable to Complete'?'Equipment unavailable':undefined);task=(await progress.mergeTaskProgress([task],person.uid))[0];assert.equal(task.status,state);assert.equal((await current()).items.length,2);}staffTasks[index]=task;
  }
  const view=await load('web-app/lib/roster/progress.ts').readSupervisorProgress(week);assert.equal(view.rows.find(r=>r.scheduledWorkId==='qa-parvo-check').status,'Completed');const unable=view.rows.find(r=>r.scheduledWorkId==='qa-unable-test');assert.equal(unable.status,'In Progress');assert.equal(unable.unableToCompleteReason,'Equipment unavailable');
});
test('actual OpsProvider remount reads real current Firestore snapshot and reports Published',async()=>{
  await login('ADMIN001');
  for(let reset=0;reset<2;reset++){
    const {react,Runner,element}=hooks();const providerLoad=loader({react,'react/jsx-runtime':{jsx:element,jsxs:element},'./AuthProvider':{useAuth:()=>({status:'signedIn',user:auth.currentUser})},'../lib/locations':{getAllLocations:()=>load('web-app/lib/locations.ts').getAllLocations()},'../lib/planning/templates':load('web-app/lib/planning/templates.ts'),'../lib/roster/workforce':load('web-app/lib/roster/workforce.ts'),'../lib/roster/currentPublication':load('web-app/lib/roster/currentPublication.ts')},{NEXT_PUBLIC_ROSTER_BACKEND:'firestore'});
    const Provider=providerLoad('web-app/components/OpsProvider.tsx').OpsProvider;const runner=new Runner(()=>Provider({children:null}));runner.render();
    // The hook driver does not wait for I/O unless a state change is pending.
    for(let i=0;i<100&&(runner.value.props.value.templatesLoading||runner.value.props.value.workforceLoading||runner.value.props.value.locationsLoading);i++){await new Promise(r=>setTimeout(r,20));await runner.settle();}
    assert.equal(runner.value.props.value.templatesError,null);assert.equal(runner.value.props.value.duties.filter(d=>!d.publicationFallback).length,2);
    await runner.value.props.value.loadRosterWeek(week);await runner.settle();const ops=runner.value.props.value;assert.equal(ops.rosterReadState(week).status,'DATA');assert.equal(ops.rosterLifecycle(week).status,'Published');assert.equal(ops.scheduledWork.length,2);assert(ops.scheduledWork.every(w=>w.staffIds.includes('STAFF001')));runner.unmount();
  }
});
test('real hydrated occurrence edit republishes new version; historical snapshot/progress remain intact',async()=>{
  const result=await current(),reader=load('web-app/lib/roster/currentPublication.ts');const workforce=await load('web-app/lib/roster/workforce.ts').loadWorkforce(),locations=await load('web-app/lib/locations.ts').getAllLocations();
  const restored=reader.restoreRosterItems(result.items,workforce,locations,[]);restored.scheduled[0].startTime='08:15';
  const payload=load('web-app/lib/roster/publishClient.ts').publicationPayload({weekStart:week,scheduledWork:restored.scheduled},restored.staff,restored.duties,false),second=await publish(payload);assert.notEqual(second.version,first.version);
  assert.deepEqual(await Promise.all(old.map(i=>publisher.read(`publishedRosters/${week}/versions/${first.version}/items/${i.scheduledWorkId}`))),old);assert.equal((await current()).version,second.version);assert.equal((await current()).items.length,2);
  const view=await load('web-app/lib/roster/progress.ts').readSupervisorProgress(week);assert.equal(view.rows.find(r=>r.scheduledWorkId==='qa-parvo-check').status,'Completed');assert.equal(view.rows.find(r=>r.scheduledWorkId==='qa-unable-test').unableToCompleteReason,'Equipment unavailable');
});
test('real absent next-week publication returns EMPTY without hiding current week',async()=>{
  await login('ADMIN001');assert.equal((await load('web-app/lib/roster/currentPublication.ts').readCurrentRosterPublication('2026-10-12')).status,'EMPTY');assert.equal((await current()).items.length,2);
});
