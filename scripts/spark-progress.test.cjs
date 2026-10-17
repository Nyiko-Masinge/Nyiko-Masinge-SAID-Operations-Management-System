const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {loader,deferred}=require('./stage6b-test-support.cjs');
const week='2026-10-05',uid='real-staff-uid',work='care';
const action=(status='In Progress',expectedStatus='Scheduled',requestId='request-1',extra={})=>({scheduledWorkId:work,weekStart:week,status,expectedStatus,requestId,...extra});
function harness(changes={}) {
  const records=new Map(Object.entries({
    ['employees/'+uid]:{employeeId:'STAFF001',firstName:'Safe',surname:'Staff',roleId:'staff-role',active:true,contactEmail:'private'},
    'employees/another-supervisor':{roleId:'management-role',active:true},'employees/inactive-supervisor':{roleId:'management-role',active:false},
    'employees/wrong-role':{roleId:'forged-role',active:true},'roles/staff-role':{name:'Staff Member'},
    'roles/management-role':{name:'Supervisor/Administrator'},'roles/forged-role':{name:'Supervisor/Administrator',id:'different'},
    ['publishedRosters/'+week]:{weekStart:week,currentVersion:'v1'},
    [`publishedRosters/${week}/versions/v1/items/${work}`]:{scheduledWorkId:work,weekStart:week,assignedUids:[uid],title:'Care',date:week,startTime:'08:00',endTime:'09:00',locationId:'ward',requiredStaff:1,isCritical:true},
    ...changes,
  }));
  const stamp={toDate:()=>new Date('2026-10-05T06:00:00Z')};let failPath;
  const snapshot=path=>({exists:records.has(path),data:()=>records.get(path),id:path.split('/').pop()});
  const reference=path=>({path,collection:part=>({...reference(path+'/'+part),query:true}),doc:part=>reference(path+'/'+part)});
  const db={doc:reference,collection:path=>({...reference(path),query:true}),runTransaction:async callback=>{
    const writes=[];
    const read=async ref=>{assert.equal(writes.length,0,'all reads precede transaction writes');return ref.query?{docs:[...records.keys()].filter(p=>p.startsWith(ref.path+'/')&&p.split('/').length===ref.path.split('/').length+1).map(snapshot)}:snapshot(ref.path);};
    const result=await callback({get:read,getAll:(...refs)=>Promise.all(refs.map(read)),set:(ref,data)=>writes.push([ref.path,data]),create:(ref,data)=>{assert(!records.has(ref.path));writes.push([ref.path,data]);}});
    if(writes.some(([path])=>path===failPath))throw Error('Injected commit failure; private credential detail');
    for(const [path,data]of writes)records.set(path,data);return result;
  }};
  const app={name:'said-roster-publisher',options:{projectId:'demo-said-5ce3e'}};
  const load=loader({'server-only':{},'firebase-admin/app':{getApps:()=>[app]},'firebase-admin/auth':{getAuth:()=>({verifyIdToken:async token=>{if(token==='invalid')throw Error('invalid token');return{uid:token==='supervisor'?'another-supervisor':token==='other'?'other-staff':uid};}})},'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=>stamp}}},
    {SAID_ROSTER_BACKEND:'firestore',SAID_FIREBASE_EMULATORS_ENABLED:'true',SAID_FIREBASE_PROJECT_ID:'demo-said-5ce3e',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080'});
  const POST=load('web-app/app/api/mobile/task-progress/route.ts').POST;
  const post=(body=action(),token='staff')=>POST(new Request('https://trusted.test/api/mobile/task-progress',{method:'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)}));
  const taskEvents=()=>[...records.entries()].filter(([p])=>p.startsWith('operationalEvents/'));
  const inbox=()=>[...records.entries()].filter(([p])=>p.includes('/notifications/'));
  return{records,post,taskEvents,inbox,load,stamp,fail:path=>{failPath=path;}};
}
test('valid staff token accepted; progress fields and verified safe actor commit together',async()=>{
  const h=harness(),r=await h.post();assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'In Progress',publicationVersion:'v1'});
  const p=h.records.get(`employees/${uid}/taskProgress/${work}`);assert.deepEqual(p,{scheduledWorkId:work,weekStart:week,publicationVersion:'v1',status:'In Progress',updatedAt:h.stamp});
  const e=h.taskEvents()[0][1];assert.equal(e.type,'TaskStarted');assert.deepEqual(e.actor,{uid,employeeId:'STAFF001',displayName:'Safe Staff'});assert.equal(e.actorProvenance,'authenticated-staff');assert.equal(e.entityId,work);assert.equal(e.occurredAt,h.stamp);assert.equal(e.actor.contactEmail,undefined);
});
for(const [name,token,status]of [['missing',null,401],['invalid','invalid',401],['supervisor','supervisor',403],['unassigned other staff','other',403]])test(name+' token rejected without writes',async()=>{const h=harness({'employees/other-staff':{roleId:'staff-role',active:true}});assert.equal((await h.post(action(),token)).status,status);assert.equal(h.taskEvents().length,0);assert.equal(h.inbox().length,0);assert(!h.records.has(`employees/${uid}/taskProgress/${work}`));});
for(const [name,change,status]of [
  ['archived',{['publishedRosters/'+week]:{weekStart:week,currentVersion:'v1',archived:true}},409],
  ['removed assignment',{[`publishedRosters/${week}/versions/v1/items/${work}`]:{scheduledWorkId:work,weekStart:week,assignedUids:[]}},403],
  ['retired staff role',{'roles/staff-role':{name:'Retired'}},403],
  ['missing profile',{['employees/'+uid]:undefined},403],
  ['wrong role identity',{'roles/staff-role':{name:'Staff Member',id:'wrong'}},403],
  ['missing current item',{[`publishedRosters/${week}/versions/v1/items/${work}`]:undefined},403],
])test(name+' rejected at trusted transaction boundary',async()=>{const h=harness(change);assert.equal((await h.post()).status,status);assert.equal(h.taskEvents().length,0);});
test('Complete and both Reopen transitions persist canonical history; prior reason retained',async()=>{
  const h=harness();for(const a of [action(),action('Completed','In Progress','complete'),action('In Progress','Completed','reopen-complete'),action('Unable to Complete','In Progress','unable',{unableToCompleteReason:'  Equipment missing  '}),action('In Progress','Unable to Complete','reopen-unable')])assert.equal((await h.post(a)).status,200);
  assert.deepEqual(h.taskEvents().map(([,e])=>e.type),['TaskStarted','TaskCompleted','TaskReopened','TaskUnableToComplete','TaskReopened']);
  assert.equal(h.records.get(`employees/${uid}/taskProgress/${work}`).unableToCompleteReason,'Equipment missing');assert.equal(h.taskEvents()[3][1].reason,'Equipment missing');
});
for(const reason of [undefined,'','   ','\u00a0\ufeff','\n\t',null,123])test('Unable requires nonblank string reason: '+JSON.stringify(reason),async()=>{const h=harness();await h.post();assert.equal((await h.post(action('Unable to Complete','In Progress','unable',{...(reason===undefined?{}:{unableToCompleteReason:reason})}))).status,400);assert.equal(h.taskEvents().length,1);});
test('long multiline Unable reason retains full persisted content',async()=>{const h=harness();await h.post();const reason='\u00a0'+('Equipment\n'.repeat(300))+'\ufeff';assert.equal((await h.post(action('Unable to Complete','In Progress','unable',{unableToCompleteReason:reason}))).status,200);assert.equal(h.records.get(`employees/${uid}/taskProgress/${work}`).unableToCompleteReason,reason.trim());});
for(const [from,to]of [['Scheduled','Completed'],['Scheduled','Unable to Complete'],['Completed','Completed'],['In Progress','Scheduled'],['In Progress','Paused'],['Unable to Complete','Completed']])test('illegal transition '+from+' -> '+to+' rejected',async()=>{const h=harness();assert.equal((await h.post(action(to,from))).status,400);assert.equal(h.taskEvents().length,0);});
test('stale expected status rejected and no extra event',async()=>{const h=harness();await h.post();assert.equal((await h.post(action('In Progress','Scheduled','new-start'))).status,409);assert.equal(h.taskEvents().length,1);});
test('same action retry creates exactly one event; same key different action rejected',async()=>{const h=harness();await h.post();await h.post();assert.equal(h.taskEvents().length,1);assert.equal((await h.post(action('Completed','In Progress'))).status,409);assert.equal(h.taskEvents().length,1);});
test('old receipt replay after later transition never rolls back persisted progress',async()=>{const h=harness();await h.post();await h.post(action('Completed','In Progress','complete'));assert.equal((await h.post()).status,200);assert.equal(h.records.get(`employees/${uid}/taskProgress/${work}`).status,'Completed');assert.equal(h.taskEvents().length,2);});
test('Unable inbox uses authoritative supervisors; retry retains isRead and count',async()=>{
  const h=harness();await h.post();const a=action('Unable to Complete','In Progress','unable',{unableToCompleteReason:'Equipment missing'});assert.equal((await h.post(a)).status,200);
  assert.equal(h.inbox().length,1);const [path,n]=h.inbox()[0];assert(path.startsWith('employees/another-supervisor/notifications/'));assert.equal(n.category,'TaskUpdate');assert.equal(n.issuedBy.uid,uid);assert.equal(n.isRead,false);n.isRead=true;
  assert.equal((await h.post(a)).status,200);assert.equal(h.inbox().length,1);assert.equal(h.records.get(path).isRead,true);assert.equal(h.taskEvents().length,2);
});
test('existing read inbox is never overwritten even when committing the first request',async()=>{const h=harness();await h.post();const a=action('Unable to Complete','In Progress','unable',{unableToCompleteReason:'Missing'}),m=h.load('web-app/lib/server/taskProgress.ts'),n=h.load('web-app/lib/server/notifications.ts');const path=`employees/another-supervisor/notifications/${n.notificationKey(m.progressEventId(uid,a.requestId)+':unable')}`;h.records.set(path,{isRead:true});assert.equal((await h.post(a)).status,200);assert.deepEqual(h.records.get(path),{isRead:true});});
test('notification commit failure rolls back progress/event and surfaces safe server failure',async()=>{const h=harness();await h.post();const a=action('Unable to Complete','In Progress','unable',{unableToCompleteReason:'Missing'}),m=h.load('web-app/lib/server/taskProgress.ts'),n=h.load('web-app/lib/server/notifications.ts');h.fail(`employees/another-supervisor/notifications/${n.notificationKey(m.progressEventId(uid,a.requestId)+':unable')}`);const r=await h.post(a);assert.equal(r.status,500);assert(!JSON.stringify(await r.json()).includes('credential'));assert.equal(h.records.get(`employees/${uid}/taskProgress/${work}`).status,'In Progress');assert.equal(h.taskEvents().length,1);assert.equal(h.inbox().length,0);});
for(const field of ['uid','employeeId','role','assignedUids','publicationVersion','actor','recipients'])test('client '+field+' injection denied',async()=>{const h=harness();assert.equal((await h.post(action('In Progress','Scheduled','request',{[field]:'forged'}))).status,400);assert.equal(h.taskEvents().length,0);});
test('publication notifications match historical Stage 7D content for first, changed, removed/new and critical recipients',()=>{
  const h=harness(),api=h.load('web-app/lib/server/notifications.ts'),old=require('../functions/notifications.cjs');const row={scheduledWorkId:work,title:'Care',date:week,startTime:'08:00',endTime:'09:00',locationId:'ward',requiredStaff:1,isCritical:false,assignedUids:[uid]};
  const event={actor:{uid:'publisher',displayName:'Safe Admin'},occurredAt:'stamp',weekStart:week,publicationVersion:'v2'};
  for(const [before,after]of [[[],[row]],[[row],[{...row,description:'changed'}]],[[row],[{...row,assignedUids:['new-staff']}]],[[row],[]],[[],[{...row,isCritical:true,assignedUids:[]}]]]) {
    const expected=old.publicationJobs('publication-v2',event,before,after,['derived-supervisor']).flatMap(j=>j.data.recipients.map(u=>({path:`employees/${u}/notifications/${j.id}`,data:old.notificationFor(j.data,u)})));
    assert.deepEqual(api.publicationNotifications('publication-v2',event,before,after,['derived-supervisor']),expected);
  }
});
test('production firebase/workflow require no Functions deployment or emulator',()=>{assert.equal(JSON.parse(fs.readFileSync('firebase.json')).functions,undefined);const ci=fs.readFileSync('.github/workflows/ci.yml','utf8');assert(!ci.includes('functions:operational'));assert(!ci.includes('functions-integration'));assert(!ci.includes('npm ci --prefix functions'));assert(ci.includes('--only firestore:rules,firestore:indexes'));assert(ci.includes("vars.DEPLOYMENTS_ENABLED == 'true'"));});
test('publication inbox failure leaves pointer, events and inbox unchanged; retry succeeds and preserves read state',async()=>{
  const h=harness(),actor={uid:'publisher',employeeId:'ADMIN',displayName:'Safe Admin'};
  const old=h.records.get(`publishedRosters/${week}/versions/v1/items/${work}`);
  h.records.set(`publishedRosters/${week}/versions/v2`,{publishedBy:actor});h.records.set(`publishedRosters/${week}/versions/v2/items/${work}`,{...old,description:'Changed care'});
  const api=h.load('web-app/lib/server/admin.ts').publicationStore(),n=h.load('web-app/lib/server/notifications.ts');
  const inboxPath=`employees/${uid}/notifications/${n.notificationKey('publication-v2:work:'+work)}`;
  h.fail(inboxPath);await assert.rejects(api.switchCurrent(week,'v2'));assert.equal(h.records.get('publishedRosters/'+week).currentVersion,'v1');assert.equal(h.taskEvents().length,0);assert.equal(h.inbox().length,0);
  h.fail(undefined);await api.switchCurrent(week,'v2');assert.equal(h.records.get('publishedRosters/'+week).currentVersion,'v2');assert.equal(h.inbox().length,1);h.records.get(inboxPath).isRead=true;
  await api.switchCurrent(week,'v2');assert.equal(h.inbox().length,1);assert.equal(h.records.get(inboxPath).isRead,true);
});

function mobileClient({fetcher,mode='firestore',origin='https://trusted.test',emulator='false',token}={}) {
  let generated=0;const calls=[],auth={currentUser:{uid,getIdToken:token??(async()=> 'staff')}};
  const mocks={'./firebase':{getFirebaseAuth:()=>auth,getFirebaseDb:()=>({})},'firebase/firestore':{collection:()=>({}),doc:()=>({id:'mobile-request-'+ ++generated})}};
  const client=loader(mocks,{EXPO_PUBLIC_ROSTER_BACKEND:mode,EXPO_PUBLIC_API_BASE_URL:origin,EXPO_PUBLIC_FIREBASE_EMULATORS_ENABLED:emulator},{fetch:async(url,options)=>{calls.push({url,options});return fetcher?fetcher(url,options):Response.json({status:JSON.parse(options.body).status,publicationVersion:'v1'});}})('mobile-app/lib/taskProgress.ts');
  const task={id:work,scheduledWorkId:work,weekStart:week,publicationVersion:'v1',status:'Scheduled'};return{client,calls,auth,task};
}
for(const code of [401,403,409,500])test('mobile HTTP '+code+' rejects without local success',async()=>{const m=mobileClient({fetcher:async()=>Response.json({error:'safe failure'},{status:code})});await assert.rejects(m.client.saveTaskProgress(m.task,'In Progress'));assert.equal(m.task.status,'Scheduled');assert.equal(m.calls.length,1);});
test('mobile sends only token and canonical operation, with stable retry ID after lost response',async()=>{
  let lost=true;const h=harness(),m=mobileClient({fetcher:async(url,options)=>{const body=JSON.parse(options.body),r=await h.post(body);if(lost){lost=false;throw Error('Lost response after commit');}return r;}});
  await assert.rejects(m.client.saveTaskProgress(m.task,'In Progress'));const result=await m.client.saveTaskProgress(m.task,'In Progress');assert.equal(result.status,'In Progress');assert.equal(h.taskEvents().length,1);
  const bodies=m.calls.map(c=>JSON.parse(c.options.body));assert.equal(bodies[0].requestId,bodies[1].requestId);assert.equal(m.calls[0].url,'https://trusted.test/api/mobile/task-progress');assert.equal(m.calls[0].options.headers.Authorization,'Bearer staff');assert.deepEqual(Object.keys(bodies[0]).sort(),['expectedStatus','requestId','scheduledWorkId','status','weekStart']);
});
test('mobile repeated Complete after Reopen generates a new request ID and event',async()=>{const h=harness(),m=mobileClient({fetcher:async(url,options)=>h.post(JSON.parse(options.body))});for(const status of ['In Progress','Completed','In Progress','Completed']){await m.client.saveTaskProgress(m.task,status);m.task.status=status;}assert.equal(h.taskEvents().length,4);assert.notEqual(JSON.parse(m.calls[1].options.body).requestId,JSON.parse(m.calls[3].options.body).requestId);});
test('mobile confirmed request is not reused after another device reopens the occurrence',async()=>{const h=harness(),m=mobileClient({fetcher:async(url,options)=>h.post(JSON.parse(options.body))});await m.client.saveTaskProgress(m.task,'In Progress');m.task.status='In Progress';await m.client.saveTaskProgress(m.task,'Completed');await h.post(action('In Progress','Completed','other-device-reopen'));await m.client.saveTaskProgress(m.task,'Completed');assert.equal(h.records.get(`employees/${uid}/taskProgress/${work}`).status,'Completed');assert.equal(h.taskEvents().length,4);assert.notEqual(JSON.parse(m.calls[1].options.body).requestId,JSON.parse(m.calls[2].options.body).requestId);});
test('account switch during token lookup prevents HTTP call',async()=>{const pending=deferred(),m=mobileClient({token:()=>pending.promise});const operation=m.client.saveTaskProgress(m.task,'In Progress');m.auth.currentUser={uid:'new-account'};pending.resolve('staff');await assert.rejects(operation);assert.equal(m.calls.length,0);});
test('account switch during HTTP response prevents late success for prior account',async()=>{const pending=deferred(),m=mobileClient({fetcher:()=>pending.promise});const operation=m.client.saveTaskProgress(m.task,'In Progress');await new Promise(r=>setImmediate(r));m.auth.currentUser={uid:'new-account'};pending.resolve(Response.json({status:'In Progress',publicationVersion:'v1'}));await assert.rejects(operation);assert.equal(m.task.status,'Scheduled');});
for(const origin of ['', 'http://production.test','https://user:password@trusted.test','https://trusted.test/wrong-path'])test('mobile rejects invalid/missing trusted origin '+origin,async()=>{const m=mobileClient({origin});await assert.rejects(m.client.saveTaskProgress(m.task,'In Progress'));assert.equal(m.calls.length,0);});
test('mobile demo save is isolated from Auth, HTTP and Firestore',async()=>{const m=mobileClient({mode:'fixture'});m.auth.currentUser=null;assert.equal((await m.client.saveTaskProgress(m.task,'In Progress')).status,'In Progress');assert.equal(m.calls.length,0);});
