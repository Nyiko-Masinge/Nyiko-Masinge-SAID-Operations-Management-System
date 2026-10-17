// Fresh isolated demo Auth/Firestore only. Exercises the real Next POST boundary and SDK reader.
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {loader}=require('./stage6b-test-support.cjs');
const {provision,provisioningConfig,PROJECT_ID}=require('./provision-emulator-e2e.cjs');
const webRequire=require('node:module').createRequire(require('node:path').join(__dirname,'../SAID Ops/web-app/package.json'));
const {initializeApp,deleteApp}=webRequire('firebase/app');
const authSdk=webRequire('firebase/auth');
const firestoreSdk=webRequire('firebase/firestore');
const {getApps,deleteApp:deleteAdminApp}=webRequire('firebase-admin/app');
const env={...process.env,SAID_E2E_TEST_PASSWORD:randomBytes(18).toString('hex')};
let config,fixtures,POST,publisher,app,auth,db,mobile,tokens={},first,second;
const week='2026-11-16';
let progress,supervisor,staffTask,unableTask;
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
  const staffTwo=fixtures.accounts.find(person=>person.employeeId==='STAFF002');
  await serverLoad('web-app/lib/server/admin.ts').planningStore().write(`employees/${staffTwo.uid}`,'fixture-setup',()=>({active:true}));
  // Reload-safe Admin initialization uses the same named app.
  serverLoad('web-app/lib/server/admin.ts').publicationStore();
  assert.equal(getApps().filter(app=>app.name==='said-roster-publisher').length,1);
  app=initializeApp({projectId:PROJECT_ID,apiKey:'fake-api-key',authDomain:PROJECT_ID+'.firebaseapp.com'},'stage6c-sdk');
  auth=authSdk.getAuth(app);authSdk.connectAuthEmulator(auth,config.authUrl,{disableWarnings:true});
  const host=new URL(config.firestoreUrl);db=firestoreSdk.getFirestore(app);firestoreSdk.connectFirestoreEmulator(db,host.hostname,Number(host.port));
  const mocks={'firebase/firestore':firestoreSdk,'./firebase':{getFirebaseDb:()=>db,getFirebaseAuth:()=>auth},'../firebase':{getFirebaseDb:()=>db,getFirebaseAuth:()=>auth}};
  mobile=loader(mocks,{EXPO_PUBLIC_ROSTER_BACKEND:'firestore'})('mobile-app/lib/publishedRoster.ts');
  const progressPOST=serverLoad('web-app/app/api/mobile/task-progress/route.ts').POST;
  progress=loader(mocks,{EXPO_PUBLIC_ROSTER_BACKEND:'firestore',EXPO_PUBLIC_API_BASE_URL:'http://localhost',EXPO_PUBLIC_FIREBASE_EMULATORS_ENABLED:'true'}, {fetch:(url,options)=>progressPOST(new Request(url,options))})('mobile-app/lib/taskProgress.ts');
  supervisor=loader(mocks,{NEXT_PUBLIC_ROSTER_BACKEND:'firestore'})('web-app/lib/roster/progress.ts');
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

test('ADMIN001 publishes using real provisioned identities and STAFF001 initially sees Scheduled',async()=>{
  const response=await post(tokens.ADMIN001);assert.equal(response.status,200);first=await response.json();
  const person=await signIn('STAFF001');const publication=await mobile.readCurrentPublication(week,person.uid);
  const tasks=await progress.mergeTaskProgress(publication.tasks,person.uid);assert.equal(tasks.length,2);assert(tasks.every(task=>task.status==='Scheduled'));
  staffTask=tasks.find(task=>task.id==='real-work-1');unableTask=tasks.find(task=>task.id==='shared-work');
});
test('STAFF001 Start and Complete persist exact fields with authoritative server timestamps',async()=>{
  const person=fixtures.accounts.find(p=>p.employeeId==='STAFF001');
  await progress.saveTaskProgress(staffTask,'In Progress');
  const started=await publisher.read('employees/'+person.uid+'/taskProgress/'+staffTask.id);assert.equal(started.status,'In Progress');assert(started.updatedAt.toDate());
  assert.deepEqual(Object.keys(started).sort(),['publicationVersion','scheduledWorkId','status','updatedAt','weekStart']);
  staffTask=(await progress.mergeTaskProgress([staffTask],person.uid))[0];assert.equal(staffTask.status,'In Progress');
  await progress.saveTaskProgress(staffTask,'Completed');staffTask=(await progress.mergeTaskProgress([staffTask],person.uid))[0];assert.equal(staffTask.status,'Completed');
});
test('Unable persists trimmed reason and supervisor observes all four canonical states across assigned work',async()=>{
  const person=fixtures.accounts.find(p=>p.employeeId==='STAFF001');
  await progress.saveTaskProgress(unableTask,'In Progress');unableTask=(await progress.mergeTaskProgress([unableTask],person.uid))[0];
  await signIn('ADMIN001');let view=await supervisor.readSupervisorProgress(week);assert(view.rows.some(row=>row.status==='In Progress'));assert(view.rows.some(row=>row.status==='Completed'));assert(view.rows.some(row=>row.status==='Scheduled'));
  await signIn('STAFF001');await progress.saveTaskProgress(unableTask,'Unable to Complete','  Equipment unavailable  ');unableTask=(await progress.mergeTaskProgress([unableTask],person.uid))[0];assert.equal(unableTask.unableToCompleteReason,'Equipment unavailable');
  await signIn('ADMIN001');view=await supervisor.readSupervisorProgress(week);const row=view.rows.find(row=>row.uid===person.uid&&row.scheduledWorkId==='shared-work');assert.equal(row.status,'Unable to Complete');assert.equal(row.unableToCompleteReason,'Equipment unavailable');assert(row.updatedAt);
  assert(view.rows.every(row=>!('contactEmail'in row)&&!('phoneNumber'in row)));
});
test('Reopen Unable preserves reason in storage and restored mobile status',async()=>{
  const person=await signIn('STAFF001');await progress.saveTaskProgress(unableTask,'In Progress');unableTask=(await progress.mergeTaskProgress([unableTask],person.uid))[0];
  assert.equal(unableTask.status,'In Progress');assert.equal(unableTask.unableToCompleteReason,'Equipment unavailable');
  assert.equal((await publisher.read('employees/'+person.uid+'/taskProgress/shared-work')).unableToCompleteReason,'Equipment unavailable');
});
test('STAFF002 cannot read or write STAFF001 nested progress, and cannot use supervisor reader',async()=>{
  await signIn('STAFF002');const person=fixtures.accounts.find(p=>p.employeeId==='STAFF001');const ref=firestoreSdk.doc(db,'employees',person.uid,'taskProgress','real-work-1');
  await assert.rejects(firestoreSdk.getDocFromServer(ref),e=>e.code==='permission-denied');
  await assert.rejects(firestoreSdk.updateDoc(ref,{status:'In Progress',updatedAt:firestoreSdk.serverTimestamp()}),e=>e.code==='permission-denied');
  await assert.rejects(supervisor.readSupervisorProgress(week),e=>e.code==='permission-denied');
});
test('republish retains same ID progress and subsequent legitimate write migrates current version',async()=>{
  const response=await post(tokens.ADMIN001);assert.equal(response.status,200);second=await response.json();assert.notEqual(second.version,first.version);
  const person=await signIn('STAFF001');const current=await mobile.readCurrentPublication(week,person.uid);const tasks=await progress.mergeTaskProgress(current.tasks,person.uid);
  const completed=tasks.find(task=>task.id==='real-work-1');assert.equal(completed.status,'Completed');assert.equal(completed.publicationVersion,second.version);
  await signIn('ADMIN001');let view=await supervisor.readSupervisorProgress(week);const row=view.rows.find(row=>row.uid===person.uid&&row.scheduledWorkId===completed.id);assert.equal(row.status,'Completed');assert.equal(row.progressVersion,first.version);assert.equal(row.publicationVersion,second.version);
  await signIn('STAFF001');await progress.saveTaskProgress(staffTask,'In Progress'); // stale publication is revalidated transactionally
  const migrated=await publisher.read('employees/'+person.uid+'/taskProgress/real-work-1');assert.equal(migrated.publicationVersion,second.version);assert.equal(migrated.status,'In Progress');
});
test('removed assignment safely rejects stale task and retains last confirmed progress',async()=>{
  const body=payload();body.items[0].assignedEmployees=[body.items[1].assignedEmployees[0]];
  const response=await post(tokens.ADMIN001,body);assert.equal(response.status,200);
  const person=await signIn('STAFF001');let error;try{await progress.saveTaskProgress({...staffTask,status:'In Progress'},'Completed');}catch(e){error=e;}
  assert(error);assert(progress.progressErrorMessage(error).includes('Refresh the roster'));
  assert.equal((await publisher.read('employees/'+person.uid+'/taskProgress/real-work-1')).status,'In Progress');
  assert(!(await mobile.readCurrentPublication(week,person.uid)).tasks.some(task=>task.id==='real-work-1'));
  await signIn('ADMIN001');assert(!(await supervisor.readSupervisorProgress(week)).rows.some(row=>row.uid===person.uid&&row.scheduledWorkId==='real-work-1'));
});
test('no provisional notifications/history/notes/leave/raw-shift records created',async()=>{
  for(const path of ['shifts/real-work-1','notifications/test','leaveRequests/test','auditLogs/test','operationalHistory/test','notes/test','alerts/test'])assert.equal(await publisher.read(path),undefined);
});
