// Fresh isolated demo Auth/Firestore only. Exercises the real Next POST boundary and SDK reader.
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {loader,plain}=require('./stage6b-test-support.cjs');
const {provision,provisioningConfig,PROJECT_ID}=require('./provision-emulator-e2e.cjs');
const webRequire=require('node:module').createRequire(require('node:path').join(__dirname,'../SAID Ops/web-app/package.json'));
const {initializeApp,deleteApp}=webRequire('firebase/app');
const authSdk=webRequire('firebase/auth');
const firestoreSdk=webRequire('firebase/firestore');
const {getApps,deleteApp:deleteAdminApp}=webRequire('firebase-admin/app');
const env={...process.env,SAID_E2E_TEST_PASSWORD:randomBytes(18).toString('hex')};
let config,fixtures,POST,publisher,app,auth,db,mobile,workforce,tokens={},first,second;
const week='2026-10-19';
function payload() {
  const staff=fixtures.accounts.filter(p=>p.employeeId!=='ADMIN001');
  const items=staff.map((person,index)=>({
    scheduledWorkId:`real-work-${index+1}`,date:week,title:`Staff duty ${index+1}`,description:'Emulator E2E care instructions',
    startTime:index?'10:00':'08:00',endTime:index?'11:00':'09:00',locationId:index?'ward-b':'parvo',requiredStaff:1,isCritical:index===0,
    assignedEmployees:[{uid:person.uid,employeeId:person.employeeId}],
  }));
  items.push({scheduledWorkId:'shared-work',date:week,title:'Shared ward duty',description:'Safe coworker projection',startTime:'09:00',endTime:'10:00',locationId:'parvo',requiredStaff:2,isCritical:false,
    assignedEmployees:staff.map(person=>({uid:person.uid,employeeId:person.employeeId}))});
  return {weekStart:week,confirmCoverage:false,items};
}
async function post(token,body=payload()) {
  return POST(new Request('http://localhost/api/rosters/publish',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)}));
}
test.before(async()=>{
  config=provisioningConfig(env);fixtures=await provision(env);
  Object.assign(process.env,{SAID_ROSTER_BACKEND:'firestore',SAID_FIREBASE_EMULATORS_ENABLED:'true',SAID_FIREBASE_PROJECT_ID:PROJECT_ID,NEXT_PUBLIC_FIREBASE_PROJECT_ID:PROJECT_ID});
  const serverLoad=loader({'server-only':{}},process.env);
  POST=serverLoad('web-app/app/api/rosters/publish/route.ts').POST;
  publisher=serverLoad('web-app/lib/server/admin.ts').publicationStore();
  // This baseline publication scenario needs two active staff; Stage 7A's default
  // inactive fixture remains unchanged for operational validation suites.
  const staffTwo=fixtures.accounts.find(person=>person.employeeId==='STAFF002');
  await serverLoad('web-app/lib/server/admin.ts').planningStore().write(`employees/${staffTwo.uid}`,'fixture-setup',()=>({active:true}));
  // Reload-safe Admin initialization uses the same named app.
  serverLoad('web-app/lib/server/admin.ts').publicationStore();
  assert.equal(getApps().filter(app=>app.name==='said-roster-publisher').length,1);
  app=initializeApp({projectId:PROJECT_ID,apiKey:'fake-api-key',authDomain:PROJECT_ID+'.firebaseapp.com'},'stage6b-sdk');
  auth=authSdk.getAuth(app);authSdk.connectAuthEmulator(auth,config.authUrl,{disableWarnings:true});
  const host=new URL(config.firestoreUrl);db=firestoreSdk.getFirestore(app);firestoreSdk.connectFirestoreEmulator(db,host.hostname,Number(host.port));
  const mocks={'firebase/firestore':firestoreSdk,'./firebase':{getFirebaseDb:()=>db},'../firebase':{getFirebaseDb:()=>db}};
  mobile=loader(mocks,{EXPO_PUBLIC_ROSTER_BACKEND:'firestore'})('mobile-app/lib/publishedRoster.ts');
  workforce=loader(mocks)('web-app/lib/roster/workforce.ts');
  for(const person of fixtures.accounts){const credential=await authSdk.signInWithEmailAndPassword(auth,person.email,env.SAID_E2E_TEST_PASSWORD);tokens[person.employeeId]=await credential.user.getIdToken();}
  await authSdk.signOut(auth);
});
test.after(async()=>{
  if(auth)await authSdk.signOut(auth);if(app)await deleteApp(app);
  for(const application of getApps().filter(a=>a.name==='said-roster-publisher'))await deleteAdminApp(application);
});
async function signIn(employeeId) {
  const person=fixtures.accounts.find(p=>p.employeeId===employeeId);
  await authSdk.signInWithEmailAndPassword(auth,person.email,env.SAID_E2E_TEST_PASSWORD);return person;
}
test('real supervisor workforce reads both staff and distinct UID/business identities',async()=>{
  await signIn('ADMIN001');const people=await workforce.loadWorkforce();
  for(const id of ['STAFF001','STAFF002']){const row=people.find(p=>p.employeeId===id);assert(row);assert.equal(row.id,id);assert.notEqual(row.uid,id);assert.equal(row.availability,'Available');}
});
test('unauthenticated/staff/invalid tokens cannot publish through the actual POST boundary',async()=>{
  for(const [token,status]of [[undefined,401],[tokens.STAFF001,403],[tokens.STAFF002,403],['invalid-token',401]])assert.equal((await post(token)).status,status);
  assert.equal(await publisher.read(`publishedRosters/${week}`),undefined);
});
test('real supervisor token creates complete metadata/version/items with safe projection',async()=>{
  const response=await post(tokens.ADMIN001);assert.equal(response.status,200);first=await response.json();
  const meta=await publisher.read(`publishedRosters/${week}`);assert.equal(meta.currentVersion,first.version);assert(meta.publishedAt.toDate());
  const version=await publisher.read(`publishedRosters/${week}/versions/${first.version}`);assert.equal(version.itemCount,3);assert(version.publishedAt.toDate());
  for(const item of payload().items){
    const persisted=await publisher.read(`publishedRosters/${week}/versions/${first.version}/items/${item.scheduledWorkId}`);
    assert.equal(persisted.scheduledWorkId,item.scheduledWorkId);assert.deepEqual(persisted.assignedUids,item.assignedEmployees.map(person=>person.uid));
    assert.deepEqual(Object.keys(persisted.team[0]).sort(),['displayName','employeeId','jobCategory']);assert(!('priority'in persisted));
  }
});
test('STAFF001/STAFF002 read only current assigned items with the actual mobile query and stable mapping',async()=>{
  for(const [id,workId]of [['STAFF001','real-work-1'],['STAFF002','real-work-2']]){
    const person=await signIn(id);const result=await mobile.readCurrentPublication(week,person.uid);
    assert.equal(result.status,'DATA');assert.equal(result.version,first.version);assert.equal(result.tasks.length,2);assert(result.tasks.some(task=>task.scheduledWorkId===workId));
    const shared=result.tasks.find(task=>task.scheduledWorkId==='shared-work');assert(shared);assert.deepEqual(shared.team.map(person=>person.employeeId),['STAFF001','STAFF002']);assert(shared.team.every(person=>person.displayName&&person.jobCategory));
    const other=workId==='real-work-1'?'real-work-2':'real-work-1';
    await assert.rejects(firestoreSdk.getDoc(firestoreSdk.doc(db,'publishedRosters',week,'versions',first.version,'items',other)),e=>e.code==='permission-denied');
    await assert.rejects(firestoreSdk.setDoc(firestoreSdk.doc(db,'publishedRosters',week),{currentVersion:'client-write'}),e=>e.code==='permission-denied');
    const coworker=fixtures.accounts.find(p=>p.employeeId!==id);
    await assert.rejects(firestoreSdk.getDoc(firestoreSdk.doc(db,'employees',coworker.uid)),e=>e.code==='permission-denied');
  }
});
test('create-only batch rejects overwriting an existing version and leaves its snapshot intact',async()=>{
  const path=`publishedRosters/${week}/versions/${first.version}/items/real-work-1`;
  const previous=await publisher.read(path);
  await assert.rejects(publisher.createSnapshot(week,first.version,[{...previous,title:'Must not overwrite'}]));
  assert.deepEqual(await publisher.read(path),previous);
});
test('republish creates a new version, preserves old snapshots, and staff reader uses only the current version',async()=>{
  const old=await publisher.read(`publishedRosters/${week}/versions/${first.version}/items/real-work-1`);
  const body=payload();body.items[0].title='Updated staff duty';const response=await post(tokens.ADMIN001,body);assert.equal(response.status,200);second=await response.json();
  assert.notEqual(second.version,first.version);assert.deepEqual(await publisher.read(`publishedRosters/${week}/versions/${first.version}/items/real-work-1`),old);
  const person=await signIn('STAFF001');const current=await mobile.readCurrentPublication(week,person.uid);assert.equal(current.version,second.version);assert.equal(current.tasks[0].title,'Updated staff duty');
  await assert.rejects(firestoreSdk.getDoc(firestoreSdk.doc(db,'publishedRosters',week,'versions',first.version,'items','real-work-1')),e=>e.code==='permission-denied');
});
test('real committed orphan snapshot cannot replace the pointer when the switch fails',async()=>{
  const {publishTrusted}=loader()('web-app/lib/server/publication.ts');
  const broken={...publisher,switchCurrent:async()=>{throw Error('injected pointer failure');}};
  await assert.rejects(publishTrusted(`Bearer ${tokens.ADMIN001}`,payload(),broken),/injected pointer/);
  assert.equal((await publisher.read(`publishedRosters/${week}`)).currentVersion,second.version);
});
test('malformed identities/duplicate IDs/retired areas cannot change current publication; legacy areas work',async()=>{
  for(const modify of [p=>p.items.push({...p.items[0]}),p=>p.items[0].assignedEmployees[0].uid='not-provisioned',p=>p.items[0].locationId='retired-area',p=>p.items[0].locationId='missing']){
    const body=payload();modify(body);assert.equal((await post(tokens.ADMIN001,body)).status,400);
    assert.equal((await publisher.read(`publishedRosters/${week}`)).currentVersion,second.version);
  }
  const legacy=payload();legacy.weekStart='2026-10-26';legacy.items=legacy.items.map(item=>({...item,date:'2026-10-26',locationId:'legacy-area'}));assert.equal((await post(tokens.ADMIN001,legacy)).status,200);
});
test('a valid empty publication and a missing week yield EMPTY; real permission failure is an error',async()=>{
  assert.equal((await post(tokens.ADMIN001,{weekStart:'2026-11-02',confirmCoverage:false,items:[]})).status,200);
  const person=await signIn('STAFF001');assert.equal((await mobile.readCurrentPublication('2026-11-02',person.uid)).status,'EMPTY');
  assert.equal((await mobile.readCurrentPublication('2026-11-09',person.uid)).status,'EMPTY');
  const wrong=fixtures.accounts.find(p=>p.employeeId==='STAFF002');await assert.rejects(mobile.readCurrentPublication(week,wrong.uid),e=>e.code==='permission-denied');
});
test('no progress, notification, leave, history or raw-shift records were created',async()=>{
  for(const person of fixtures.accounts)assert.equal(await publisher.read(`employees/${person.uid}/taskProgress/real-work-1`),undefined);
  for(const path of ['shifts/real-work-1','notifications/test','leaveRequests/test','auditLogs/test','alerts/test'])assert.equal(await publisher.read(path),undefined);
});
