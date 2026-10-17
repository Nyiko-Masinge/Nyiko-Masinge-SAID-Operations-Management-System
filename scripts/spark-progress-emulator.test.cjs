// Production-equivalent trusted HTTP boundary: actual Next server + Auth/Firestore only.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),net=require('node:net');
const {spawn}=require('node:child_process'),{randomBytes}=require('node:crypto');
const {loader}=require('./stage6b-test-support.cjs'),{provision,provisioningConfig,PROJECT_ID}=require('./provision-emulator-e2e.cjs');
const req=require('node:module').createRequire(path.join(__dirname,'../SAID Ops/web-app/package.json'));
const apps=req('firebase/app'),authSdk=req('firebase/auth'),sdk=req('firebase/firestore'),adminApps=req('firebase-admin/app'),adminFirestore=req('firebase-admin/firestore');
const env={...process.env,SAID_E2E_TEST_PASSWORD:randomBytes(18).toString('hex')},week='2026-10-05';
let fixtures,server,origin,log,adminApp,adminDb,app,auth,db,mobile,monitor,version,tokens={};
const person=id=>fixtures.accounts.find(p=>p.employeeId===id);
const post=(route,body,token)=>fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(60_000)});
const progress=(id,status,expectedStatus,requestId,extra={})=>({weekStart:week,scheduledWorkId:id,status,expectedStatus,requestId,...extra});
const countEvents=async()=> (await adminDb.collection('operationalEvents').where('entityType','==','scheduledWork').get()).docs.filter(d=>d.data().type.startsWith('Task')).length;
const inbox=uid=>adminDb.collection(`employees/${uid}/notifications`);
async function login(id){await authSdk.signInWithEmailAndPassword(auth,person(id).email,env.SAID_E2E_TEST_PASSWORD);}

test.before(async()=>{
  fixtures=await provision(env);const config=provisioningConfig(env);
  adminApp=adminApps.initializeApp({projectId:PROJECT_ID},'spark-http-e2e');adminDb=adminFirestore.getFirestore(adminApp);
  await adminDb.doc('employees/'+person('STAFF002').uid).update({active:true});
  await adminDb.doc('employees/independent-shift-supervisor').set({employeeId:'LEAD123',firstName:'Shift',surname:'Lead',active:true,roleId:person('ADMIN001').roleId});
  const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));origin='http://127.0.0.1:'+port;
  const web=path.resolve(__dirname,'../SAID Ops/web-app');fs.mkdirSync(path.resolve(__dirname,'../.cache'),{recursive:true});log=fs.openSync(path.resolve(__dirname,'../.cache/spark-http-server.log'),'w');
  const serverEnv={...env,SAID_ROSTER_BACKEND:'firestore',SAID_FIREBASE_EMULATORS_ENABLED:'true',SAID_FIREBASE_PROJECT_ID:PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:PROJECT_ID,NEXT_PUBLIC_FIREBASE_API_KEY:'fake-api-key',NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:PROJECT_ID+'.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:PROJECT_ID+'.appspot.com',NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:'123',NEXT_PUBLIC_FIREBASE_APP_ID:'demo-app',
    NEXT_PUBLIC_ROSTER_BACKEND:'firestore',NEXT_PUBLIC_MONITORING_BACKEND:'firestore',SAID_FIREBASE_SERVICE_ACCOUNT_JSON:'',GOOGLE_APPLICATION_CREDENTIALS:'',
    NEXT_PUBLIC_FIREBASE_EMULATORS_ENABLED:'true',NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL:config.authUrl,
    NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST:'127.0.0.1',NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT:String(new URL(config.firestoreUrl).port),NEXT_TELEMETRY_DISABLED:'1'};
  server=spawn(process.execPath,[path.resolve(__dirname,'spark-next-server.cjs'),String(port)],{cwd:web,env:serverEnv,stdio:['ignore',log,log],windowsHide:true});
  let ready=false;
  for(let i=0;i<90;i++){if(server.exitCode!==null)throw Error('Next server exited; inspect .cache/spark-http-server.log');try{const r=await fetch(origin+'/api/mobile/task-progress',{method:'POST',body:'{}',signal:AbortSignal.timeout(3000)});if(r.status===401){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready,'Next HTTP server must become ready');
  app=apps.initializeApp({projectId:PROJECT_ID,apiKey:'fake-api-key',authDomain:PROJECT_ID+'.firebaseapp.com'},'spark-http-client');auth=authSdk.getAuth(app);authSdk.connectAuthEmulator(auth,config.authUrl,{disableWarnings:true});db=sdk.getFirestore(app);sdk.connectFirestoreEmulator(db,'127.0.0.1',Number(new URL(config.firestoreUrl).port));
  for(const p of fixtures.accounts){await login(p.employeeId);tokens[p.employeeId]=await auth.currentUser.getIdToken();}
  const mocks={'firebase/firestore':sdk,'./firebase':{getFirebaseAuth:()=>auth,getFirebaseDb:()=>db},'../firebase':{getFirebaseAuth:()=>auth,getFirebaseDb:()=>db}};
  mobile=loader(mocks,{EXPO_PUBLIC_ROSTER_BACKEND:'firestore',EXPO_PUBLIC_FIREBASE_EMULATORS_ENABLED:'true',EXPO_PUBLIC_API_BASE_URL:origin})('mobile-app/lib/taskProgress.ts');
  monitor=loader(mocks,{NEXT_PUBLIC_ROSTER_BACKEND:'firestore'})('web-app/lib/roster/progress.ts');
});
test.after(async()=>{
  if(auth)await authSdk.signOut(auth);if(app)await apps.deleteApp(app);if(adminApp)await adminApps.deleteApp(adminApp);
  if(server && server.exitCode===null){const done=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await done;}
  if(log!==undefined)fs.closeSync(log);
});

test('actual HTTP ADMIN001 publication commits staff inbox and immutable pointer without Functions',async()=>{
  const items=['http-care','http-unable'].map((id,i)=>({scheduledWorkId:id,date:week,title:id,description:'Real HTTP care',startTime:i?'09:00':'08:00',endTime:i?'10:00':'09:00',locationId:'parvo',requiredStaff:1,isCritical:true,assignedEmployees:[{uid:person('STAFF001').uid,employeeId:'STAFF001'}]}));
  const response=await post('/api/rosters/publish',{weekStart:week,confirmCoverage:false,items},tokens.ADMIN001);assert.equal(response.status,200,JSON.stringify(await response.clone().json()));version=(await response.json()).version;
  assert.equal((await inbox(person('STAFF001').uid).get()).size,2);assert.equal((await adminDb.collection('notificationJobs').get()).size,0);assert.equal((await adminDb.doc('publishedRosters/'+week).get()).data().currentVersion,version);
});
test('actual HTTP rejects missing/invalid token and supervisor mutation',async()=>{const body=progress('http-care','In Progress','Scheduled','bad');for(const [token,code]of [[undefined,401],['invalid',401],[tokens.ADMIN001,403]])assert.equal((await post('/api/mobile/task-progress',body,token)).status,code);assert.equal(await countEvents(),0);});
test('STAFF001 mobile adapter starts through HTTP; supervisor reads persisted In Progress',async()=>{
  await login('STAFF001');const task={id:'http-care',scheduledWorkId:'http-care',weekStart:week,publicationVersion:version,status:'Scheduled'};const saved=await mobile.saveTaskProgress(task,'In Progress');assert.equal(saved.status,'In Progress');assert.equal((await mobile.mergeTaskProgress([task],person('STAFF001').uid))[0].status,'In Progress');
  await login('ADMIN001');assert((await monitor.readSupervisorProgress(week)).rows.some(r=>r.scheduledWorkId==='http-care'&&r.status==='In Progress'));assert.equal(await countEvents(),1);
  const event=(await adminDb.collection('operationalEvents').where('type','==','TaskStarted').get()).docs[0].data();assert.equal(event.actor.uid,person('STAFF001').uid);assert.equal(event.actor.employeeId,'STAFF001');assert.equal(event.actorProvenance,'authenticated-staff');assert(event.occurredAt.toDate());
});
test('concurrent HTTP Complete retries create one event; Completed Reopen creates a distinct event',async()=>{
  const a=progress('http-care','Completed','In Progress','http-complete');const replies=await Promise.all([post('/api/mobile/task-progress',a,tokens.STAFF001),post('/api/mobile/task-progress',a,tokens.STAFF001)]);assert(replies.every(r=>r.status===200));assert.equal(await countEvents(),2);
  assert.equal((await post('/api/mobile/task-progress',progress('http-care','In Progress','Completed','http-reopen'),tokens.STAFF001)).status,200);assert.equal(await countEvents(),3);
});
test('second task Unable requires reason and commits progress/event/derived supervisor inbox atomically',async()=>{
  assert.equal((await post('/api/mobile/task-progress',progress('http-unable','In Progress','Scheduled','http-unable-start'),tokens.STAFF001)).status,200);
  const noReason=progress('http-unable','Unable to Complete','In Progress','http-unable');assert.equal((await post('/api/mobile/task-progress',noReason,tokens.STAFF001)).status,400);
  const a={...noReason,unableToCompleteReason:'  Equipment missing  '};assert.equal((await post('/api/mobile/task-progress',a,tokens.STAFF001)).status,200);
  assert.equal((await adminDb.doc(`employees/${person('STAFF001').uid}/taskProgress/http-unable`).get()).data().unableToCompleteReason,'Equipment missing');
  for(const uid of [person('ADMIN001').uid,'independent-shift-supervisor']){const rows=await inbox(uid).get();assert.equal(rows.size,1);assert.equal(rows.docs[0].data().category,'TaskUpdate');assert.equal(rows.docs[0].data().issuedBy.employeeId,'STAFF001');}
});
test('HTTP Unable retry preserves a read notification, exact count and event ID',async()=>{
  await login('ADMIN001');const rows=await inbox(person('ADMIN001').uid).get(),id=rows.docs[0].id;await sdk.updateDoc(sdk.doc(db,'employees',person('ADMIN001').uid,'notifications',id),{isRead:true});const count=await countEvents();
  const a=progress('http-unable','Unable to Complete','In Progress','http-unable',{unableToCompleteReason:'  Equipment missing  '});assert.equal((await post('/api/mobile/task-progress',a,tokens.STAFF001)).status,200);
  assert.equal(await countEvents(),count);assert.equal((await inbox(person('ADMIN001').uid).get()).size,1);assert.equal((await inbox(person('ADMIN001').uid).doc(id).get()).data().isRead,true);
  assert.equal((await post('/api/mobile/task-progress',progress('http-unable','In Progress','Unable to Complete','http-reopen-unable'),tokens.STAFF001)).status,200);
});
test('STAFF002 cannot mutate STAFF001 occurrence; direct own and cross-user Firestore writes denied',async()=>{
  await login('STAFF002');assert.equal((await post('/api/mobile/task-progress',progress('http-care','Completed','In Progress','other-staff'),tokens.STAFF002)).status,403);
  await assert.rejects(sdk.getDocFromServer(sdk.doc(db,'employees',person('STAFF001').uid,'taskProgress','http-care')),e=>e.code==='permission-denied');
  await assert.rejects(sdk.setDoc(sdk.doc(db,'employees',person('STAFF002').uid,'taskProgress','http-care'),{status:'In Progress'}),e=>e.code==='permission-denied');
  await login('STAFF001');await assert.rejects(sdk.updateDoc(sdk.doc(db,'employees',person('STAFF001').uid,'taskProgress','http-care'),{status:'Completed',updatedAt:sdk.serverTimestamp()}),e=>e.code==='permission-denied');
});
test('archive through HTTP prevents new progress and retains historical status/event',async()=>{
  const r=await post('/api/rosters/archive',{weekStart:week,version,reason:'HTTP E2E finished'},tokens.ADMIN001);assert.equal(r.status,200);
  const count=await countEvents();assert.equal((await post('/api/mobile/task-progress',progress('http-care','Completed','In Progress','archived'),tokens.STAFF001)).status,409);assert.equal(await countEvents(),count);
  assert.equal((await adminDb.doc(`employees/${person('STAFF001').uid}/taskProgress/http-care`).get()).data().status,'In Progress');
});
