// Actual Auth identities, trusted Next route, Admin transactions and client readers.
const test=require('node:test'),assert=require('node:assert/strict'),{randomBytes}=require('node:crypto');
const{loader,hooks,plain}=require('./stage6b-test-support.cjs');
const{provision,provisioningConfig,PROJECT_ID}=require('./provision-emulator-e2e.cjs');
const req=require('node:module').createRequire(require('node:path').join(__dirname,'../SAID Ops/web-app/package.json'));
const appSdk=req('firebase/app'),authSdk=req('firebase/auth'),sdk=req('firebase/firestore'),adminSdk=req('firebase-admin/app');
const env={...process.env,SAID_E2E_TEST_PASSWORD:randomBytes(18).toString('hex')},week='2026-10-05';
let fixtures,app,auth,db,server,POST,publisher,planning,client,first,tokens={};
const person=id=>fixtures.accounts.find(p=>p.employeeId===id);
const input=()=>({weekStart:week,confirmCoverage:false,items:[{scheduledWorkId:'stage7b-valid',date:week,title:'Stage 7B Ward Care',description:'Frozen care instructions',startTime:'08:00',endTime:'09:00',locationId:'parvo',requiredStaff:1,isCritical:false,dutyId:'fixture-ward-round',priority:'High',assignedEmployees:[{uid:person('STAFF001').uid,employeeId:'STAFF001'}]}]});
const post=body=>POST(new Request('http://localhost/api/rosters/publish',{method:'POST',headers:{Authorization:`Bearer ${tokens.ADMIN001}`,'Content-Type':'application/json'},body:JSON.stringify(body)}));
async function login(id='ADMIN001'){await authSdk.signInWithEmailAndPassword(auth,person(id).email,env.SAID_E2E_TEST_PASSWORD);}
const write=(path,fields)=>planning.write(path,person('ADMIN001').uid,()=>fields);
const pointer=async()=> (await publisher.read(`publishedRosters/${week}`))?.currentVersion;
async function rejected(body,code){const before=await pointer(),response=await post(body);assert.equal(response.status,400);const data=await response.json();assert.equal(data.code,code);assert.equal(await pointer(),before);assert.equal(data.stack,undefined);return data;}
test.before(async()=>{
  fixtures=await provision(env);const config=provisioningConfig(env);
  Object.assign(process.env,{SAID_ROSTER_BACKEND:'firestore',SAID_FIREBASE_EMULATORS_ENABLED:'true',SAID_FIREBASE_PROJECT_ID:PROJECT_ID,NEXT_PUBLIC_FIREBASE_PROJECT_ID:PROJECT_ID});
  server=loader({'server-only':{}},process.env);POST=server('web-app/app/api/rosters/publish/route.ts').POST;publisher=server('web-app/lib/server/admin.ts').publicationStore();planning=server('web-app/lib/server/admin.ts').planningStore();
  app=appSdk.initializeApp({projectId:PROJECT_ID,apiKey:'fake-api-key',authDomain:PROJECT_ID+'.firebaseapp.com'},'stage7b-sdk');auth=authSdk.getAuth(app);authSdk.connectAuthEmulator(auth,config.authUrl,{disableWarnings:true});const host=new URL(config.firestoreUrl);db=sdk.getFirestore(app);sdk.connectFirestoreEmulator(db,host.hostname,Number(host.port));
  for(const fixture of fixtures.accounts){await login(fixture.employeeId);tokens[fixture.employeeId]=await auth.currentUser.getIdToken();}await login();
  client=loader({'firebase/firestore':sdk,'../firebase':{getFirebaseAuth:()=>auth,getFirebaseDb:()=>db},'./firebase':{getFirebaseAuth:()=>auth,getFirebaseDb:()=>db}}, {NEXT_PUBLIC_ROSTER_BACKEND:'firestore'});
});
test.after(async()=>{if(auth)await authSdk.signOut(auth);if(app)await appSdk.deleteApp(app);for(const app of adminSdk.getApps().filter(a=>a.name==='said-roster-publisher'))await adminSdk.deleteApp(app);});

const reqAdmin = req('firebase-admin/firestore');
const dbAdmin = () => reqAdmin.getFirestore(adminSdk.getApps().find(a=>a.name==='said-roster-publisher'));
test('publication actor and events commit atomically; failed stale publish adds no event',async()=>{
 const response=await post(input());assert.equal(response.status,200);first=await response.json();
 const meta=await publisher.read('publishedRosters/'+week);assert.equal(meta.publishedBy.uid,person('ADMIN001').uid);assert.equal(meta.publishedBy.employeeId,'ADMIN001');
 const snapshot=await publisher.read('publishedRosters/'+week+'/versions/'+first.version);assert.deepEqual(meta.publishedBy,snapshot.publishedBy);
 const events=await dbAdmin().collection('operationalEvents').get();assert(events.docs.some(d=>d.data().type==='RosterPublished'));assert(events.docs.some(d=>d.data().type==='AssignmentAdded'));
 const changing={...publisher,createSnapshot:async(...args)=>{await publisher.createSnapshot(...args);await write('locations/parvo',{revision:999});}};
 await assert.rejects(server('web-app/lib/server/publication.ts').publishTrusted('Bearer '+tokens.ADMIN001,input(),changing),e=>e.status===409);
 assert.equal((await dbAdmin().collection('operationalEvents').get()).size,events.size);assert.equal(await pointer(),first.version);
});
test('republish changes stable work identity and logs remove/add/reassignment safely',async()=>{
 await write('employees/'+person('STAFF002').uid,{active:true,availability:person('STAFF001').availability,skills:['Ward Care']});
 const p=input();p.items[0].assignedEmployees=[{uid:person('STAFF002').uid,employeeId:'STAFF002'}];assert.equal((await post(p)).status,200);
 const e=await dbAdmin().collection('operationalEvents').get();assert(e.docs.some(d=>d.data().type==='AssignmentReassigned'));assert(e.docs.some(d=>d.data().type==='RosterRepublished'));
 p.items=[];assert.equal((await post(p)).status,200);assert((await dbAdmin().collection('operationalEvents').get()).docs.some(d=>d.data().type==='AssignmentRemoved'));
});
test('rules deny all client event writes and staff reads; supervisor can read',async()=>{
 await login();assert((await sdk.getDocs(sdk.collection(db,'operationalEvents'))).size>0);await assert.rejects(sdk.setDoc(sdk.doc(db,'operationalEvents','forged'),{actor:{uid:'fake'}}),e=>e.code==='permission-denied');
 await login('STAFF001');await assert.rejects(sdk.getDocs(sdk.collection(db,'operationalEvents')),e=>e.code==='permission-denied');await assert.rejects(sdk.setDoc(sdk.doc(db,'operationalEvents','forged'),{actor:{uid:person('STAFF001').uid}}),e=>e.code==='permission-denied');
});
test('trusted progress handler persists actual snapshots, idempotently and out of order',async()=>{
 const {recordProgress}=require('../functions/history.cjs');
 const snap=d=>({exists:!!d,data:()=>d});const e=(id,a,b)=>({id,params:{uid:person('STAFF001').uid,scheduledWorkId:'stage7b-valid'},authType:'unknown',authId:person('STAFF001').uid,data:{before:snap(a&&{status:a}),after:snap({status:b,weekStart:week,publicationVersion:first.version,updatedAt:reqAdmin.Timestamp.now()})}});
 const completed=e('complete','In Progress','Completed'),started=e('start',null,'In Progress');
 await recordProgress(dbAdmin(),completed,()=>reqAdmin.FieldValue.serverTimestamp());await recordProgress(dbAdmin(),started,()=>reqAdmin.FieldValue.serverTimestamp());await recordProgress(dbAdmin(),completed,()=>reqAdmin.FieldValue.serverTimestamp());
 const records=(await dbAdmin().collection('operationalEvents').get()).docs.filter(d=>d.data().type.startsWith('Task'));assert.equal(records.length,2);assert(records.every(d=>d.data().actor.employeeId==='STAFF001'));
});
