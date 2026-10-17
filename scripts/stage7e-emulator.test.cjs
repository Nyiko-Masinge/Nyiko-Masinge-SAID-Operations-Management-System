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

const model=loader()('web-app/lib/monitoring/model.ts');
const filters={date:week,area:'',employee:'',status:''};
const live=()=>client('web-app/lib/monitoring/read.ts').readMonitoring(week);
test('genuine empty publication returns zero metrics with authoritative sources',async()=>{const s=await live();assert.equal(s.items.length,0);assert.equal(model.deriveMonitoring(s,filters).metrics.total,0);});
test('shared published occurrence counts once with unique scheduled staff',async()=>{
 await write('employees/'+person('STAFF002').uid,{active:true,availability:person('STAFF001').availability,skills:['Ward Care']});
 const p=input();p.items[0].assignedEmployees.push({uid:person('STAFF002').uid,employeeId:'STAFF002'});assert.equal((await post(p)).status,200);
 const v=model.deriveMonitoring(await live(),filters,new Date('2026-10-05T06:30:00Z'));assert.equal(v.metrics.total,1);assert.equal(v.metrics.scheduled,2);assert.equal(v.metrics.completed,0);
});
test('actual progress feeds duty metrics, inability and overdue exceptions',async()=>{
 const progress=require('./spark-test-support.cjs').trustedProgressPost();
 for(const id of ['STAFF001','STAFF002']){await login(id);await progress(tokens[id],week,'stage7b-valid','Scheduled','In Progress','monitor-start-'+id);}
 await login();assert.equal(model.deriveMonitoring(await live(),filters).metrics.inProgress,1);
 await login('STAFF001');await progress(tokens.STAFF001,week,'stage7b-valid','In Progress','Unable to Complete','monitor-unable','Equipment unavailable');await login();
 const v=model.deriveMonitoring(await live(),filters,new Date('2026-10-05T08:00:00Z'));assert(v.exceptions.some(e=>e.type==='UnableToComplete'));assert(v.exceptions.some(e=>e.type==='Overdue'));assert.equal(v.metrics.attention,1);
});
test('authoritative availability change and area/employee/status filters are genuine',async()=>{
 await write('employees/'+person('STAFF002').uid,{availability:{normalState:'Available',state:'Training',effectiveFrom:'2026-10-05T05:00:00.000Z',effectiveTo:'2026-10-05T09:00:00.000Z'}});
 const source=await live();assert.equal(model.deriveMonitoring(source,filters).metrics.unavailable,1);assert.equal(model.deriveMonitoring(source,{...filters,area:'not-this-area'}).metrics.total,0);assert.equal(model.deriveMonitoring(source,{...filters,employee:person('STAFF002').uid,status:'Unable to Complete'}).metrics.total,1);
});
test('staff cannot use supervisor source queries or inherit supervisor history',async()=>{await login('STAFF001');await assert.rejects(live());});
