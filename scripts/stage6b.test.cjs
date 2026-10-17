const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {loader,hooks,plain,deferred,root}=require('./stage6b-test-support.cjs');
const load=loader();
const {publishTrusted,MAX_PUBLICATION_ITEMS}=load('web-app/lib/server/publication.ts');
const week='2026-10-19';
const input=()=>({weekStart:week,confirmCoverage:false,items:[{scheduledWorkId:'stable-1',date:week,title:'Ward care',description:'Safe instructions',startTime:'08:00',endTime:'09:00',locationId:'parvo',requiredStaff:1,isCritical:true,assignedEmployees:[{uid:'uid-one',employeeId:'STAFF001'}]}]});
function store() {
  const records={
    'employees/admin':{employeeId:'ADMIN001',firstName:'Test',surname:'Admin',roleId:'admin-role'},
    'roles/admin-role':{name:'Supervisor/Administrator'},'roles/staff-role':{name:'Staff Member'},
    'employees/uid-one':{employeeId:'STAFF001',firstName:'Test',surname:'One',roleId:'staff-role',jobCategory:'Nurse',active:true,locationId:'parvo',skills:[],availability:{normalState:'Available',state:'Available',effectiveFrom:'2026-01-01T00:00:00.000Z',effectiveTo:null},contactEmail:'private@example.test',phoneNumber:'private',leave:'private'},
    'dutyTemplates/d1':{name:'Duty',description:'',locationId:'parvo',requiredStaff:1,priority:'High',isCritical:false,active:true,requiredSkills:[],requirements:[]},
    'locations/parvo':{name:'Parvo Ward',active:true},'locations/legacy':{name:'Legacy Area'},'locations/retired':{name:'Retired Area',active:false},
  };
  let serial=0,current,failSnapshot=false,failPointer=false;
  const snapshots=new Map(),events=[];
  return {records,snapshots,events,current:()=>current,failSnapshot:()=>{failSnapshot=true;},failPointer:()=>{failPointer=true;},
    verifyToken:async token=>{if(token==='bad')throw Error('invalid');return {uid:token};},read:async p=>records[p],validAuthUser:async uid=>uid==='uid-one',version:()=>`version-${++serial}`,
    createSnapshot:async(w,v,items)=>{events.push('snapshot');if(failSnapshot)throw Error('snapshot failure');if(snapshots.has(v))throw Error('duplicate');snapshots.set(v,plain(items));},
    switchCurrent:async(w,v)=>{events.push('pointer');if(failPointer)throw Error('pointer failure');assert(snapshots.has(v));current=v;},
  };
}
test('supervisor publication and republish use complete immutable versions/stable IDs/safe team',async()=>{
  const s=store(),first=await publishTrusted('Bearer admin',input(),s);const old=plain(s.snapshots.get(first.version));
  const changed=input();changed.items[0].title='Updated';const second=await publishTrusted('Bearer admin',changed,s);
  assert.notEqual(first.version,second.version);assert.equal(s.current(),second.version);assert.deepEqual(s.snapshots.get(first.version),old);
  assert.equal(s.snapshots.get(second.version)[0].scheduledWorkId,'stable-1');assert.deepEqual(old[0].assignedUids,['uid-one']);
  assert.deepEqual(old[0].team,[{employeeId:'STAFF001',displayName:'Test One',jobCategory:'Nurse'}]);assert.deepEqual(s.events,['snapshot','pointer','snapshot','pointer']);
});
for(const auth of [null,'Bearer uid-one','Bearer bad'])test(`publisher rejects unauthorized ${auth}`,async()=>{
  const s=store();await assert.rejects(publishTrusted(auth,input(),s),e=>[401,403].includes(e.status));assert.equal(s.snapshots.size,0);
});
for(const phase of ['Snapshot','Pointer'])test(`${phase} failure preserves previous current publication`,async()=>{
  const s=store();const first=await publishTrusted('Bearer admin',input(),s);s[`fail${phase}`]();
  await assert.rejects(publishTrusted('Bearer admin',input(),s));assert.equal(s.current(),first.version);
});
const invalids=[
  ['invalid week',p=>p.weekStart='2026-10-20'],['duplicate ID',p=>p.items.push({...p.items[0]})],
  ['blank ID',p=>p.items[0].scheduledWorkId=' '],['outside week',p=>p.items[0].date='2026-10-26'],
  ['invalid date',p=>p.items[0].date='2026-02-30'],['invalid times',p=>p.items[0].endTime='07:00'],
  ['blank title',p=>p.items[0].title=' '],['nonexistent location',p=>p.items[0].locationId='missing'],
  ['retired location',p=>p.items[0].locationId='retired'],['invalid staffing',p=>p.items[0].requiredStaff=1.5],
  ['invalid critical',p=>p.items[0].isCritical='yes'],['missing UID',p=>p.items[0].assignedEmployees[0].uid='missing'],
  ['UID/business mismatch',p=>p.items[0].assignedEmployees[0].employeeId='WRONG'],
  ['unconfirmed uncovered',p=>p.items[0].assignedEmployees=[]],['client private team',p=>p.items[0].team=[{phone:'private'}]],
  ['ad-hoc fabricated priority',p=>p.items[0].priority='High'],['batch overflow',p=>p.items=Array.from({length:MAX_PUBLICATION_ITEMS+1},()=>p.items[0])],
];
for(const [name,change]of invalids)test(`integrity rejects ${name} before snapshot writes`,async()=>{
  const s=store(),p=input();change(p);await assert.rejects(publishTrusted('Bearer admin',p,s),e=>e.status===400);assert.equal(s.snapshots.size,0);
});
test('legacy active location and legitimate template priority are accepted; ad-hoc priority stays absent',async()=>{
  const s=store(),p=input();p.items[0].locationId='legacy';p.items[0].dutyId='d1';p.items[0].priority='High';
  const result=await publishTrusted('Bearer admin',p,s);assert.equal(s.snapshots.get(result.version)[0].priority,'High');
  const adHoc=await publishTrusted('Bearer admin',input(),s);assert(!('priority'in s.snapshots.get(adHoc.version)[0]));
});
test('Publish Anyway retains explicitly confirmed uncovered duties without resolving fake assignments',async()=>{
  const s=store(),p=input();p.confirmCoverage=true;p.items[0].assignedEmployees=[];
  const result=await publishTrusted('Bearer admin',p,s);const item=s.snapshots.get(result.version)[0];
  assert.deepEqual(item.assignedUids,[]);assert.deepEqual(item.team,[]);assert.equal(item.requiredStaff,1);
  const invalid=input();invalid.confirmCoverage=true;invalid.items[0].assignedEmployees[0].uid='local-only';
  await assert.rejects(publishTrusted('Bearer admin',invalid,s),e=>e.status===400);
});
const mobile=loader({'./firebase':{getFirebaseDb:()=>{throw Error('Unexpected Firebase read');}}},{EXPO_PUBLIC_ROSTER_BACKEND:'firestore'})('mobile-app/lib/publishedRoster.ts');
function reader() {
  const data={...input().items[0],weekStart:week,assignedUids:['uid-one'],team:[{employeeId:'STAFF001',displayName:'Test One',jobCategory:'Nurse'}]};delete data.assignedEmployees;
  return {metadata:async()=>({weekStart:week,currentVersion:'v1'}),assigned:async()=>[{id:'stable-1',data}]};
}
test('mobile mapping preserves stable identity, critical, safe team, default display priority and seven roster days',async()=>{
  const result=await mobile.readCurrentPublication(week,'uid-one',reader());assert.equal(result.status,'DATA');
  const task=result.tasks[0];assert.equal(task.scheduledWorkId,'stable-1');assert.equal(task.isCritical,true);assert.equal(task.priority,'Normal');assert.equal(task.isLive,false);
  assert.equal(task.team[0].displayName,'Test One');assert.equal(task.publicationVersion,'v1');assert.equal(task.checklist.length,0);
  const roster=mobile.rosterWeek(week,result.tasks);assert.equal(roster.days.length,7);assert.equal(roster.days[0].duties[0].scheduledWorkId,'stable-1');
});
test('mobile missing metadata and no assignments yield EMPTY; failures reject instead of EMPTY',async()=>{
  assert.equal((await mobile.readCurrentPublication(week,'uid-one',{...reader(),metadata:async()=>undefined})).status,'EMPTY');
  assert.equal((await mobile.readCurrentPublication(week,'uid-one',{...reader(),assigned:async()=>[]})).status,'EMPTY');
  await assert.rejects(mobile.readCurrentPublication(week,'uid-one',{...reader(),assigned:async()=>{throw Error('offline');}}),/offline/);
});
test('mobile rereads a pointer change and never uses the stale snapshot',async()=>{
  let reads=0;const versions=[];const r=reader();r.metadata=async()=>({weekStart:week,currentVersion:++reads===1?'old':'new'});
  r.assigned=async(w,v,uid)=>{versions.push(v);return (await reader().assigned()).map(row=>({...row,data:{...row.data,title:v}}));};
  const result=await mobile.readCurrentPublication(week,'uid-one',r);assert.equal(result.version,'new');assert.equal(result.tasks[0].title,'new');assert.deepEqual(versions,['old','new']);
});
test('fixture publication reader performs zero reads even with configured Firebase',async()=>{
  let reads=0;const r={metadata:async()=>{reads++;},assigned:async()=>{reads++;}};
  assert.equal((await mobile.readCurrentPublication(week,'uid-one',r,false)).status,'EMPTY');assert.equal(reads,0);
});
test('actual mobile Firestore query constrains assignedUids, current version, and performs no coworker reads',async()=>{
  const calls=[];
  const client=loader({'./firebase':{getFirebaseDb:()=>({})},'firebase/firestore':{
    doc:(_db,...parts)=>parts,collection:(_db,...parts)=>parts,where:(...parts)=>parts,query:(...parts)=>parts,
    getDocFromServer:async ref=>{calls.push(ref);return {exists:()=>true,data:()=>({weekStart:week,currentVersion:'v1'})};},
    getDocsFromServer:async q=>{calls.push(q);return {docs:[]};},
  }},{EXPO_PUBLIC_ROSTER_BACKEND:'firestore'})('mobile-app/lib/publishedRoster.ts');
  assert.equal((await client.readCurrentPublication(week,'uid-one')).status,'EMPTY');
  assert.deepEqual(plain(calls[1]),[['publishedRosters',week,'versions','v1','items'],['assignedUids','array-contains','uid-one']]);
  assert(!JSON.stringify(calls).includes('employees'));
});
test('workforce loader preserves real UID/business ID and exposes unprovisioned availability without writes',async()=>{
  const client=loader({'../firebase':{getFirebaseDb:()=>({})},'firebase/firestore':{
    collection:(_db,name)=>{assert.equal(name,'employees');return {};},getDocsFromServer:async()=>({docs:[{id:'uid-one',data:()=>({employeeId:'STAFF001',firstName:'Test',surname:'One',roleId:'staff-role',jobCategory:'Nurse'})}]}),
  }})('web-app/lib/roster/workforce.ts');
  const [person]=await client.loadWorkforce();assert.equal(person.uid,'uid-one');assert.equal(person.id,'STAFF001');assert.equal(person.employeeId,'STAFF001');assert.equal(person.availability,'Unknown');assert.equal(person.status,'Unknown');assert.equal(person.skillsKnown,false);assert.equal(person.role,'Nurse');
});
test('client payload rejects unprovisioned employees and only resolves template priority',()=>{
  const client=loader()('web-app/lib/roster/publishClient.ts');
  const snapshot={weekStart:week,scheduledWork:[{id:'x',staffIds:['LOCAL'],isCritical:false}]};
  assert.throws(()=>client.publicationPayload(snapshot,[{id:'LOCAL',name:'Local'}],[],true),/LOCAL.*unprovisioned/);
});
test('integrated OpsProvider awaits publication, preserves prior state on failure and isolates UID changes',async()=>{
  const {react,Runner,element}=hooks();let identity={status:'signedIn',user:{uid:'admin'}},fail=false,pending;
  const realClient=loader()('web-app/lib/roster/publishClient.ts');
  const Provider=loader({'react':react,'react/jsx-runtime':{jsx:element,jsxs:element},'./AuthProvider':{useAuth:()=>identity},
    '../lib/locations':{getAllLocations:async()=>[{id:'parvo',name:'Parvo Ward',active:true}]},
    '../lib/planning/templates':{loadTemplates:async()=>[]},
    '../lib/roster/workforce':{loadWorkforce:async()=>[{id:'STAFF001',employeeId:'STAFF001',uid:'uid-one',name:'Test One',role:'Nurse',availability:'Available',locationId:'',status:'Active',skills:[]}]},
    '../lib/roster/publishClient':{...realClient,persistPublication:async()=>{if(pending)await pending.promise;if(fail)throw Error('server offline');}},
  },{NEXT_PUBLIC_ROSTER_BACKEND:'firestore'})('web-app/components/OpsProvider.tsx').OpsProvider;
  const runner=new Runner(()=>Provider({children:null}));runner.render();await runner.settle();let value=runner.value.props.value;
  assert.equal(value.staff[0].id,'STAFF001');assert.equal(value.scheduledWork.length,0);
  value.createScheduled({title:'Real work',description:'',date:week,startTime:'08:00',endTime:'09:00',locationId:'parvo',area:'Parvo Ward',required:1});await runner.settle();value=runner.value.props.value;
  value.assignScheduled(value.scheduledWork[0].id,'STAFF001');await runner.settle();value=runner.value.props.value;
  pending=deferred();const saving=value.publishToStaff(week);assert.equal(value.publishedRoster(week),undefined);pending.resolve();await saving;pending=undefined;await runner.settle();value=runner.value.props.value;
  const before=plain(value.publishedRoster(week));value.editScheduled(value.scheduledWork[0].id,{...value.scheduledWork[0],title:'Edited'});await runner.settle();value=runner.value.props.value;
  fail=true;await assert.rejects(value.publishToStaff(week),/server offline/);assert.deepEqual(plain(value.publishedRoster(week)),before);assert(value.rosterLifecycle(week).hasUnpublishedChanges);
  identity={status:'signedIn',user:{uid:'other'}};runner.render();assert.equal(runner.value.props.value.staff.length,0);await runner.settle();assert.equal(runner.value.props.value.scheduledWork.length,0);runner.unmount();
});
test('mobile hook distinguishes LOADING/ERROR/EMPTY and ignores another session response',async()=>{
  const {react,Runner}=hooks();let identity={status:'signedIn',employee:{id:'uid-one'},user:{uid:'uid-one'}},weekValue=week;
  const requests=[];
  const usePublishedRoster=loader({'react':react,'../components/AuthProvider':{useAuth:()=>identity},'./taskProgress':{mergeTaskProgress:async tasks=>tasks},'./publishedRoster':{firestoreRosterEnabled:true,readCurrentPublication:()=>{const p=deferred();requests.push(p);return p.promise;}}})('mobile-app/lib/usePublishedRoster.ts').usePublishedRoster;
  const runner=new Runner(()=>usePublishedRoster(weekValue));runner.render();assert.equal(runner.value.state.status,'LOADING');
  identity={...identity,user:{uid:'uid-two'}};runner.render();requests[0].resolve({status:'DATA',tasks:[{id:'old'}],version:'v1'});await runner.settle();assert.equal(runner.value.state.status,'LOADING');
  requests[1].reject(Error('offline'));await runner.settle();assert.equal(runner.value.state.status,'ERROR');assert.equal(runner.value.state.tasks.length,0);
  runner.value.retry();await runner.settle();requests[2].resolve({status:'EMPTY',tasks:[]});await runner.settle();assert.equal(runner.value.state.status,'EMPTY');runner.unmount();
});
test('server configuration fails closed for disabled/mixed/production emulator settings',()=>{
  const {adminConfiguration}=loader({'server-only':{}},process.env)('web-app/lib/server/admin.ts');
  const safe={SAID_ROSTER_BACKEND:'firestore',SAID_FIREBASE_EMULATORS_ENABLED:'true',SAID_FIREBASE_PROJECT_ID:'demo-said-5ce3e',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080'};
  assert.equal(adminConfiguration(safe).emulator,true);
  for(const changed of [{SAID_ROSTER_BACKEND:'fixture'},{SAID_FIREBASE_PROJECT_ID:'production'},{FIRESTORE_EMULATOR_HOST:'public.example:8080'},{SAID_FIREBASE_EMULATORS_ENABLED:'false'},{NEXT_PUBLIC_FIREBASE_PROJECT_ID:'other'}])assert.throws(()=>adminConfiguration({...safe,...changed}));
});
const nodes=tree=>Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];
const text=tree=>tree==null||typeof tree==='boolean'?'':Array.isArray(tree)?tree.map(text).join(''):typeof tree==='object'?text(tree.props?.children):String(tree);
test('actual web Publish handler displays failure without success; coverage confirmation still precedes persistence',async()=>{
  const {react,Runner,element}=hooks();let confirming=false,calls=0;
  const counts={itemCount:1,uncoveredCount:1,understaffedCount:0,uncoveredCriticalCount:1,conflictCount:0};
  const ops={staff:[],duties:[],scheduledWork:[],locations:[],allLocations:[],locationName:id=>id,integratedRoster:true,
    loadRosterWeek:async()=>{},rosterReadState:()=>({status:'DATA'}),
    rosterLifecycle:()=>({status:'Published',hasUnpublishedChanges:true}),
    publishToStaff:async(w,confirm)=>{calls++;if(confirming&&!confirm)return {status:'confirmation_required',...counts};throw Error('Trusted server unavailable');},
  };
  const Screen=loader({'react':react,'react/jsx-runtime':{jsx:element,jsxs:element},'./OpsProvider':{useOps:()=>ops},'./AuthProvider':{useAuth:()=>({user:{uid:'admin'}})},'../lib/roster/useRosterWeekPreference':{useRosterWeekPreference:()=>({week,ready:true,setWeek:()=>{}})},'./Icons':{Icon:'Icon'},'./RosterEditor':{RosterEditor:'Editor'},'./useModalFocus':{useModalFocus:()=>{}}})('web-app/components/RosterScreen.tsx').RosterScreen;
  const runner=new Runner(()=>Screen({}));runner.render();
  let action=nodes(runner.value).find(node=>text(node)==='Publish Roster'&&typeof node.props?.onClick==='function');
  assert(action);action.props.onClick();await runner.settle();assert(text(runner.value).includes('Trusted server unavailable'));assert(!text(runner.value).includes('published to staff'));assert(text(runner.value).includes('Unpublished changes'));
  confirming=true;action=nodes(runner.value).find(node=>text(node)==='Publish Roster'&&typeof node.props?.onClick==='function');action.props.onClick();await runner.settle();
  assert(text(runner.value).includes('critical duties remain uncovered'));const anyway=nodes(runner.value).find(node=>text(node)==='Publish Anyway'&&typeof node.props?.onClick==='function');assert(anyway);anyway.props.onClick();await runner.settle();assert(text(runner.value).includes('Trusted server unavailable'));assert.equal(calls,3);runner.unmount();
});
test('actual mobile task detail displays safe teammate names and never activates the raw-shift adapter for publications',async()=>{
  const {react,Runner,element}=hooks();let reads=0,writes=0;
  const native={View:'View',Text:'Text',Pressable:'Pressable',ScrollView:'ScrollView',Modal:'Modal',KeyboardAvoidingView:'KeyboardAvoidingView',TextInput:'TextInput',Platform:{OS:'android'},StyleSheet:{create:v=>v}};
  const result=await mobile.readCurrentPublication(week,'uid-one',reader());
  const Screen=loader({'react':react,'react/jsx-runtime':{jsx:element,jsxs:element},'react-native':native,'@expo/vector-icons':{Ionicons:'Icon'},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
    '../lib/firebase':{FIREBASE_CONFIGURED:true,auth:{currentUser:{uid:'uid-one'}},db:{}},'firebase/firestore':{doc:()=>{},getDoc:()=>{reads++;},updateDoc:()=>{writes++;}},
    '../lib/useLocations':{useLocations:()=>({locationName:()=> 'Parvo Ward',error:null,retry:()=>{}})},'./StaffHomeScreen':{BottomNavigation:'BottomNavigation'},'./StaffAppHeader':{StaffAppHeader:'Header'},
  })('mobile-app/components/StaffTaskDetailScreen.tsx').StaffTaskDetailScreen;
  const runner=new Runner(()=>Screen({task:result.tasks[0]}));runner.render();await runner.settle();
  const teamNode=nodes(runner.value).find(node=>typeof node.type==='function'&&node.props.name==='Test One');assert(teamNode);assert.equal(teamNode.props.role,'Nurse');assert.equal(teamNode.props.initials,'TO');
  assert(text(runner.value).includes('Progress saves securely'));assert.equal(reads,0);assert.equal(writes,0);runner.unmount();
});
