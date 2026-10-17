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


const notifications=uid=>dbAdmin().collection('employees/'+uid+'/notifications');
async function waitFor(uid,count){let snap;for(let i=0;i<150;i++){snap=await notifications(uid).get();if(snap.size>=count)return snap;await new Promise(r=>setTimeout(r,200));}assert.fail('Notification delivery timed out');}
test('publication transaction delivers persistent staff notification with safe issuer',async()=>{
 const response=await post(input());assert.equal(response.status,200);first=await response.json();
 const rows=await waitFor(person('STAFF001').uid,1),n=rows.docs[0].data();assert.equal(n.category,'Roster');assert.equal(n.isRead,false);assert.equal(n.issuedBy.uid,person('ADMIN001').uid);assert.equal(n.scheduledWorkId,'stage7b-valid');assert(n.createdAt.toDate());assert(n.message.includes('2026-10-05'));assert.equal((await notifications(person('STAFF002').uid).get()).size,0);
});
test('actual mobile adapter reads nested notifications and marks read; retry preserves read state',async()=>{
 await login('STAFF001');const mobile=loader({'firebase/firestore':sdk,'../../lib/firebase':{auth,db}},{EXPO_PUBLIC_MONITORING_BACKEND:'firestore'})('mobile-app/data/notifications/firestoreRepository.ts');const repo=new mobile.FirestoreNotificationRepository();
 const rows=await waitFor(person('STAFF001').uid,1),id=rows.docs[0].id;await repo.markRead(id,person('STAFF001').uid);
 await publisher.switchCurrent(week,first.version);assert.equal((await dbAdmin().collection('notificationJobs').get()).size,0);
 assert.equal((await notifications(person('STAFF001').uid).doc(id).get()).data().isRead,true);assert.equal((await notifications(person('STAFF001').uid).get()).size,1);
 const received=await new Promise((resolve,reject)=>{let off;off=repo.subscribe(person('STAFF001').uid,v=>{off?.();resolve(v);},reject);});assert.equal(received[0].isRead,true);assert.equal(received[0].recipientId,person('STAFF001').uid);await login();
});
test('changed republish notifies unchanged assignee and reassignment notifies removed/new staff',async()=>{
 const p=input();p.items[0].description='Changed instructions';assert.equal((await post(p)).status,200);await waitFor(person('STAFF001').uid,2);
 await write('employees/'+person('STAFF002').uid,{active:true,availability:person('STAFF001').availability,skills:['Ward Care']});p.items[0].assignedEmployees=[{uid:person('STAFF002').uid,employeeId:'STAFF002'}];assert.equal((await post(p)).status,200);
 const old=await waitFor(person('STAFF001').uid,3),next=await waitFor(person('STAFF002').uid,1);assert(old.docs.some(d=>d.data().title==='Assignment removed'));assert(next.docs.some(d=>d.data().title==='Roster assignment changed'));
});
test('actual trusted staff Unable transition commits supervisor inbox without Functions',async()=>{
 assert.equal((await post(input())).status,200);await login('STAFF001');const progress=require('./spark-test-support.cjs').trustedProgressPost();await progress(tokens.STAFF001,week,'stage7b-valid','Scheduled','In Progress','notify-start');await progress(tokens.STAFF001,week,'stage7b-valid','In Progress','Unable to Complete','notify-unable','Equipment unavailable');
 const rows=await waitFor(person('ADMIN001').uid,1);assert(rows.docs.some(d=>d.data().title==='Unable to Complete'&&d.data().message.includes('Equipment unavailable')));await login();
});
test('critical uncovered publication produces genuine supervisor alert notification',async()=>{
 const p=input();p.items[0].isCritical=true;p.items[0].assignedEmployees=[];p.confirmCoverage=true;assert.equal((await post(p)).status,200);const rows=await waitFor(person('ADMIN001').uid,2);assert(rows.docs.some(d=>d.data().category==='CriticalDuty'));
});
test('staff notification isolation and content/job forgery remain denied',async()=>{
 await login('STAFF001');const own=(await notifications(person('STAFF001').uid).get()).docs[0].id;
 await assert.rejects(sdk.getDocs(sdk.collection(db,'employees',person('STAFF002').uid,'notifications')),e=>e.code==='permission-denied');
 await assert.rejects(sdk.updateDoc(sdk.doc(db,'employees',person('STAFF001').uid,'notifications',own),{title:'Forged'}),e=>e.code==='permission-denied');
 await assert.rejects(sdk.setDoc(sdk.doc(db,'employees',person('STAFF001').uid,'notifications','forged'),{isRead:false}),e=>e.code==='permission-denied');await assert.rejects(sdk.setDoc(sdk.doc(db,'notificationJobs','forged'),{recipients:[person('STAFF001').uid]}),e=>e.code==='permission-denied');
});
