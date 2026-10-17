// Real readers, mapping, provider, preference hook and screen; only I/O/React boundaries are mocked.
const test=require('node:test');
const assert=require('node:assert/strict');
const {loader,hooks,plain,deferred}=require('./stage6b-test-support.cjs');
const week='2026-10-05',nextWeek='2026-10-12';
const auth={currentUser:{uid:'admin'}};
const environment={NEXT_PUBLIC_ROSTER_BACKEND:'firestore'};
const firebase={'../firebase':{getFirebaseAuth:()=>auth,getFirebaseDb:()=>({})}};
const library=loader(firebase,environment)('web-app/lib/roster/currentPublication.ts');
const locations=[{id:'parvo',name:'Parvo Ward',active:true}];
const workforce=[{id:'STAFF001',employeeId:'STAFF001',uid:'staff-uid',name:'Test Staff One',role:'Nurse',locationId:'parvo',status:'Active',availability:'Available',workload:0,email:'',phone:'',skills:[]}];
function row(id='parvo-check',overrides={}) {
  return {id,data:{scheduledWorkId:id,weekStart:week,date:week,title:id==='parvo-check'?'Mobile QA - Parvo Ward Check':'Mobile QA - Unable Test',description:'Care instructions',startTime:id==='parvo-check'?'08:00':'10:00',endTime:id==='parvo-check'?'09:00':'11:00',locationId:'parvo',requiredStaff:1,isCritical:true,assignedUids:['staff-uid'],team:[{employeeId:'STAFF001',displayName:'Test Staff One',jobCategory:'Nurse'}],...overrides}};
}
const source=(rows=[row(),row('unable-test')])=>({metadata:async()=>({weekStart:week,currentVersion:'v1'}),items:async()=>rows});
const publication=()=>library.readCurrentRosterPublication(week,source());
const nodes=tree=>Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];
const text=tree=>tree==null||typeof tree==='boolean'?'':Array.isArray(tree)?tree.map(text).join(''):typeof tree==='object'?text(tree.props?.children):String(tree);
function provider(read=async w=>w===week?publication():{status:'EMPTY',items:[]},persist=async()=>{}) {
  const {react,Runner,element}=hooks();
  let identity={status:'signedIn',user:{uid:'admin'}},reads=0;
  const load=loader({react,'react/jsx-runtime':{jsx:element,jsxs:element},'./AuthProvider':{useAuth:()=>identity},
    '../lib/locations':{getAllLocations:async()=>locations},'../lib/roster/workforce':{loadWorkforce:async()=>plain(workforce)},
    '../lib/planning/templates':{loadTemplates:async()=>[]},
    '../lib/roster/currentPublication':{...library,readCurrentRosterPublication:w=>{reads++;return read(w);}},
    '../lib/roster/publishClient':{...loader()('web-app/lib/roster/publishClient.ts'),persistPublication:persist},
  },environment);
  const Provider=load('web-app/components/OpsProvider.tsx').OpsProvider;
  const runner=new Runner(()=>Provider({children:null}));runner.render();
  return {runner,get ops(){return runner.value.props.value;},get reads(){return reads;},async ready(){await runner.settle();},
    async open(w=week){await this.ready();const pending=this.ops.loadRosterWeek(w);await runner.settle();await pending;await runner.settle();},
    identity(value){identity=value;runner.render();},load};
}

test('current snapshot maps stable IDs, dates, times, safe team and canonical locations',async()=>{
  const result=await publication();assert.equal(result.status,'DATA');assert.equal(result.version,'v1');
  const restored=library.restoreRosterItems(result.items,workforce,locations,[]);
  assert.deepEqual(restored.scheduled.map(w=>w.id),['parvo-check','unable-test']);
  for(const work of restored.scheduled){assert.deepEqual(work.staffIds,['STAFF001']);assert.equal(work.locationId,'parvo');assert.equal(work.area,'Parvo Ward');assert.equal(work.required,1);assert.equal(work.isCritical,true);assert.equal(work.date,week);}
  assert.deepEqual(result.items[0].assignedUids,['staff-uid']);assert.deepEqual(Object.keys(result.items[0].team[0]).sort(),['displayName','employeeId','jobCategory']);
});
for(const status of ['Scheduled','In Progress','Completed','Unable to Complete','Reopened/In Progress'])test(`${status} execution state cannot filter published membership`,async()=>{
  // Extra progress fields are deliberately ignored; the actual default reader never requests progress.
  const result=await library.readCurrentRosterPublication(week,source([row('parvo-check',{taskProgress:{status}}),row('unable-test',{taskProgress:{status}})]));
  assert.equal(result.items.length,2);assert(!('taskProgress'in result.items[0]));
});
test('default SDK reader reads only metadata/current items and performs zero writes',async()=>{
  const paths=[],sdk={doc:(_db,...p)=>p.join('/'),collection:(_db,...p)=>p.join('/'),
    getDocFromServer:async p=>{paths.push(p);return {exists:()=>true,data:()=>({weekStart:week,currentVersion:'v1'})};},
    getDocsFromServer:async p=>{paths.push(p);return {docs:sourceRows.map(r=>({id:r.id,data:()=>r.data}))};}};
  const sourceRows=[row(),row('unable-test')];
  const actual=loader({...firebase,'firebase/firestore':sdk},environment)('web-app/lib/roster/currentPublication.ts');
  assert.equal((await actual.readCurrentRosterPublication(week)).items.length,2);
  assert.deepEqual(paths,[`publishedRosters/${week}`,`publishedRosters/${week}/versions/v1/items`,`publishedRosters/${week}`]);
});
test('pointer change retries current version and retains only its membership',async()=>{
  let checks=0;const result=await library.readCurrentRosterPublication(week,{metadata:async()=>({weekStart:week,currentVersion:++checks===1?'old':'new'}),items:async(_w,v)=>v==='old'?[row()]:[row('unable-test')]});
  assert.equal(result.version,'new');assert.deepEqual(result.items.map(r=>r.id),['unable-test']);
});
test('obsolete snapshot permission failure retries after current pointer switches',async()=>{
  let checks=0;const result=await library.readCurrentRosterPublication(week,{metadata:async()=>({weekStart:week,currentVersion:++checks===1?'old':'new'}),items:async(_w,v)=>{if(v==='old')throw Error('permission-denied');return [row()];}});
  assert.equal(result.version,'new');
});
test('unstable pointer and corrupt identities fail rather than fabricate an empty draft',async()=>{
  let checks=0;await assert.rejects(library.readCurrentRosterPublication(week,{metadata:async()=>({weekStart:week,currentVersion:`v${++checks}`}),items:async()=>[row()]}),/changed/);
  for(const change of [{scheduledWorkId:'other'},{date:nextWeek},{requiredStaff:0},{priority:'High'},{assignedUids:['staff-uid','staff-uid']},{team:[]}])await assert.rejects(library.readCurrentRosterPublication(week,source([row('parvo-check',change)])));
});
test('reader rejects unauthenticated/invalid Monday/session changes and fixture performs no I/O',async()=>{
  const owner=auth.currentUser;try{
    auth.currentUser=null;await assert.rejects(publication(),/signed-in/);auth.currentUser=owner;
    await assert.rejects(library.readCurrentRosterPublication('2026-10-06',source()),/Monday/);
    await assert.rejects(library.readCurrentRosterPublication(week,{...source(),items:async()=>{auth.currentUser={uid:'other'};return [row()];}}),/Session/);
    const fixture=loader({'../firebase':{getFirebaseAuth:()=>{throw Error('fixture I/O');}}},{NEXT_PUBLIC_ROSTER_BACKEND:'fixture'})('web-app/lib/roster/currentPublication.ts');
    assert.equal((await fixture.readCurrentRosterPublication(week)).status,'EMPTY');
  }finally{auth.currentUser=owner;}
});
test('missing metadata yields Draft; zero-item published version still reports Published',async()=>{
  assert.equal((await library.readCurrentRosterPublication(week,{...source(),metadata:async()=>undefined})).status,'EMPTY');
  const p=provider(()=>library.readCurrentRosterPublication(week,source([])));await p.open();assert.equal(p.ops.rosterReadState(week).status,'DATA');assert.equal(p.ops.rosterLifecycle(week).status,'Published');p.runner.unmount();
});
test('missing workforce assignment is retained with Employee ID/UID and cannot be newly assigned',async()=>{
  const result=await publication(),restored=library.restoreRosterItems(result.items,[],locations,[]);
  assert.equal(restored.staff.length,1);const fallback=restored.staff[0];assert.equal(fallback.uid,'staff-uid');assert.equal(fallback.employeeId,'STAFF001');assert.match(fallback.name,/STAFF001.*staff-uid/);assert.equal(fallback.availability,'Unavailable');
  for(const work of restored.scheduled)assert.deepEqual(work.staffIds,[fallback.id]);
  const unassigned={...restored.scheduled[0],staffIds:[]};assert.equal(loader()('web-app/lib/roster/rules.ts').validateAssignment(unassigned.id,fallback.id,[unassigned],restored.staff).code,'INACTIVE');
  const payload=loader()('web-app/lib/roster/publishClient.ts').publicationPayload({weekStart:week,scheduledWork:restored.scheduled},restored.staff,[],false);
  assert.deepEqual(payload.items[0].assignedEmployees,[{uid:'staff-uid',employeeId:'STAFF001'}]);
});
test('persisted template priority stays distinct from Critical; absent template is session-only inactive',async()=>{
  const result=await library.readCurrentRosterPublication(week,source([row('parvo-check',{dutyId:'lost-template',priority:'Low'})]));
  const restored=library.restoreRosterItems(result.items,workforce,locations,[]);assert.equal(restored.scheduled[0].priority,'Low');assert.equal(restored.scheduled[0].isCritical,true);assert.equal(restored.duties[0].status,'Inactive');
  const payload=loader()('web-app/lib/roster/publishClient.ts').publicationPayload({weekStart:week,scheduledWork:restored.scheduled},restored.staff,[{...restored.duties[0],priority:'High'}],false);
  assert.equal(payload.items[0].priority,'Low');
});
test('provider hydrates Published; local edit is unpublished and survives week switch/navigation',async()=>{
  const p=provider();await p.open();assert.equal(p.ops.rosterLifecycle(week).status,'Published');assert.equal(p.ops.rosterLifecycle(week).hasUnpublishedChanges,false);
  assert(p.ops.editScheduled('parvo-check',{...p.ops.scheduledWork[0],startTime:'08:15'}).ok);await p.ready();
  assert.equal(p.ops.rosterLifecycle(week).hasUnpublishedChanges,true);const reads=p.reads;
  await p.open(nextWeek);assert.equal(p.ops.rosterReadState(nextWeek).status,'EMPTY');assert.equal(p.ops.rosterLifecycle(nextWeek).status,'Draft');
  await p.open();assert.equal(p.reads,reads+1);assert.equal(p.ops.scheduledWork[0].startTime,'08:15');p.runner.unmount();
});
test('dirty removal of all items wins against hydration, including a pending response',async()=>{
  const pending=deferred();let count=0;const p=provider(()=>++count===1?publication():pending.promise);await p.open();
  const refresh=p.ops.loadRosterWeek(week);await p.ready();assert.equal(p.ops.rosterReadState(week).status,'LOADING');
  for(const id of ['parvo-check','unable-test'])assert(p.ops.removeScheduled(id).ok);await p.ready();assert.equal(p.ops.rosterReadState(week).status,'DATA');
  pending.resolve(await publication());await refresh;await p.ready();assert.equal(p.ops.scheduledWork.length,0);assert.equal(p.ops.rosterLifecycle(week).hasUnpublishedChanges,true);
  await p.open();assert.equal(count,2);assert.equal(p.ops.scheduledWork.length,0);p.runner.unmount();
});
test('clean return reloads current publication; removal by new version removes membership',async()=>{
  let current=await publication();const p=provider(async w=>w===week?current:{status:'EMPTY',items:[]});await p.open();await p.open(nextWeek);
  current={...current,version:'v2',items:current.items.slice(1)};await p.open();assert.deepEqual(p.ops.scheduledWork.map(w=>w.id),['unable-test']);assert.equal(p.ops.rosterReadState(week).version,'v2');p.runner.unmount();
});
test('failed read exposes ERROR/retry, never empty Draft or false success',async()=>{
  let fail=true;const p=provider(async()=>{if(fail)throw Error('offline');return publication();});await p.open();
  assert.equal(p.ops.rosterReadState(week).status,'ERROR');assert.match(p.ops.rosterReadState(week).error,/retry/);fail=false;await p.open();assert.equal(p.ops.rosterReadState(week).status,'DATA');p.runner.unmount();
});
test('provider remount and logout/login rehydrate after memory reset; account switches mask old data',async()=>{
  const p=provider();await p.open();assert.equal(p.ops.scheduledWork.length,2);p.runner.unmount();const fresh=provider();await fresh.open();assert.equal(fresh.ops.scheduledWork.length,2);
  fresh.identity({status:'signedOut',user:null});assert.equal(fresh.ops.scheduledWork.length,0);await fresh.ready();
  fresh.identity({status:'signedIn',user:{uid:'admin'}});await fresh.open();assert.equal(fresh.ops.rosterLifecycle(week).status,'Published');
  fresh.identity({status:'signedIn',user:{uid:'other-admin'}});assert.equal(fresh.ops.scheduledWork.length,0);assert.equal(fresh.ops.rosterReadState(week).status,'LOADING');await fresh.ready();assert.equal(fresh.ops.scheduledWork.length,0);fresh.runner.unmount();
});
test('late old-session hydration cannot populate a new account',async()=>{
  const pending=deferred(),p=provider(()=>pending.promise);await p.ready();const request=p.ops.loadRosterWeek(week);
  p.identity({status:'signedIn',user:{uid:'other-admin'}});await p.ready();pending.resolve(await publication());await request;await p.ready();assert.equal(p.ops.scheduledWork.length,0);assert.equal(p.ops.rosterReadState(week).status,'LOADING');p.runner.unmount();
});
test('unmounted provider ignores late hydration and same-UID relogin rejects late publication success',async()=>{
  const read=deferred(),p=provider(()=>read.promise);await p.ready();const request=p.ops.loadRosterWeek(week);p.runner.unmount();read.resolve(await publication());await request;assert.equal(p.ops.scheduledWork.length,0);
  const save=deferred(),fresh=provider(undefined,()=>save.promise);await fresh.open();const publicationRequest=fresh.ops.publishToStaff(week);const rejection=assert.rejects(publicationRequest,/session changed/);
  fresh.identity({status:'signedOut',user:null});await fresh.ready();fresh.identity({status:'signedIn',user:{uid:'admin'}});await fresh.ready();save.resolve({version:'late'});await rejection;await fresh.ready();assert.equal(fresh.ops.scheduledWork.length,0);assert.equal(fresh.ops.rosterReadState(week).status,'LOADING');fresh.runner.unmount();
});
test('hydrated edit republishes through trusted publisher to a new immutable version',async()=>{
  let current,serial=0;const versions=new Map(),base=await publication();
  versions.set('v1',base.items.map(item=>{const original=row(item.id).data;return original;}));current='v1';const old=plain(versions.get('v1'));
  const records={'employees/admin':{employeeId:'ADMIN001',roleId:'admin-role'},'roles/admin-role':{name:'Supervisor/Administrator'},'roles/staff-role':{name:'Staff Member'},'employees/staff-uid':{employeeId:'STAFF001',firstName:'Test',surname:'Staff One',roleId:'staff-role',jobCategory:'Nurse',active:true,locationId:'parvo',skills:[],availability:{normalState:'Available',state:'Available',effectiveFrom:'2026-01-01T00:00:00.000Z',effectiveTo:null}},'locations/parvo':locations[0]};
  const store={verifyToken:async()=>({uid:'admin'}),read:async p=>records[p],validAuthUser:async uid=>uid==='staff-uid',version:()=>`new-${++serial}`,createSnapshot:async(_w,v,items)=>{assert(!versions.has(v));versions.set(v,plain(items));},switchCurrent:async(_w,v)=>{assert(versions.has(v));current=v;}};
  const trusted=loader()('web-app/lib/server/publication.ts').publishTrusted;
  const p=provider(()=>library.readCurrentRosterPublication(week,{metadata:async()=>({weekStart:week,currentVersion:current}),items:async()=>versions.get(current).map(data=>({id:data.scheduledWorkId,data}))}),async(_user,payload)=>trusted('Bearer admin',payload,store));
  await p.open();assert(p.ops.editScheduled('parvo-check',{...p.ops.scheduledWork[0],startTime:'08:15'}).ok);await p.ready();
  const result=await p.ops.publishToStaff(week);await p.ready();assert.equal(result.status,'published');assert.equal(result.republished,true);assert.notEqual(current,'v1');assert.deepEqual(versions.get('v1'),old);assert.equal(versions.get(current)[0].scheduledWorkId,'parvo-check');assert.equal(p.ops.rosterLifecycle(week).hasUnpublishedChanges,false);p.runner.unmount();
});

const preferences=loader()('web-app/lib/roster/weekPreference.ts');
function storage(){const data=new Map();return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}
function preferenceHarness(store,uid='admin',integrated=true){
  const {react,Runner}=hooks();let owner=uid;const original=globalThis.window;globalThis.window={localStorage:store};
  const hook=loader({react})('web-app/lib/roster/useRosterWeekPreference.ts').useRosterWeekPreference;
  const runner=new Runner(()=>hook(owner,integrated));runner.render();
  return {runner,owner(value){owner=value;runner.render();},close(){runner.unmount();globalThis.window=original;}};
}
test('current week uses local calendar and Monday logic',()=>{assert.equal(preferences.currentWeek(new Date(2026,9,11,23,30)),week);assert.equal(preferences.currentWeek(new Date(2026,9,12)),nextWeek);});
test('selection stores only UID-namespaced Monday and refresh/navigation remount restores it',async()=>{
  const store=storage(),c=preferenceHarness(store);assert.equal(c.runner.value.ready,false);await c.runner.settle();c.runner.value.setWeek(week);await c.runner.settle();assert.deepEqual([...store.data],[['said-ops-roster-week:admin',week]]);c.close();
  for(let remount=0;remount<2;remount++){const restored=preferenceHarness(store);await restored.runner.settle();assert.equal(restored.runner.value.week,week);restored.close();}
});
test('unpublished selected week stays selected after refresh',async()=>{
  const store=storage();preferences.saveWeekPreference('admin',nextWeek,store);const c=preferenceHarness(store);await c.runner.settle();assert.equal(c.runner.value.week,nextWeek);const p=provider();await p.open(c.runner.value.week);assert.equal(p.ops.rosterReadState(nextWeek).status,'EMPTY');assert.equal(p.ops.rosterLifecycle(nextWeek).status,'Draft');p.runner.unmount();c.close();
});
test('published selected week restores and hydrates after refresh',async()=>{
  const store=storage();preferences.saveWeekPreference('admin',week,store);const c=preferenceHarness(store);await c.runner.settle();const p=provider();await p.open(c.runner.value.week);assert.equal(p.ops.scheduledWork.length,2);assert.equal(p.ops.rosterLifecycle(week).status,'Published');p.runner.unmount();c.close();
});
test('invalid/corrupt/non-Monday preference falls back safely and storage failure is nonfatal',()=>{
  const store=storage();for(const invalid of ['', '{bad}', '2026-02-30','2026-10-06','2026-10-05junk']){store.data.set('said-ops-roster-week:admin',invalid);assert.equal(preferences.readWeekPreference('admin',store,week),week);}
  const broken={getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}};assert.equal(preferences.readWeekPreference('admin',broken,week),week);assert.doesNotThrow(()=>preferences.saveWeekPreference('admin',week,broken));
  preferences.saveWeekPreference('admin','2026-10-06',store);assert.equal(store.data.get('said-ops-roster-week:admin'),'2026-10-05junk');
});
test('preference account switch masks prior week; same-account relogin restores its own selection',async()=>{
  const store=storage();preferences.saveWeekPreference('admin',week,store);preferences.saveWeekPreference('other',nextWeek,store);const c=preferenceHarness(store);await c.runner.settle();
  c.owner('other');assert.equal(c.runner.value.ready,false);await c.runner.settle();assert.equal(c.runner.value.week,nextWeek);
  c.owner(undefined);assert.equal(c.runner.value.ready,false);await c.runner.settle();c.owner('admin');await c.runner.settle();assert.equal(c.runner.value.week,week);assert.equal(store.data.size,2);c.close();
});
test('fixture selection keeps original fixture default and never persists preference',async()=>{
  const store=storage(),c=preferenceHarness(store,'admin',false);assert.equal(c.runner.value.week,'2026-10-19');c.runner.value.setWeek(week);await c.runner.settle();assert.equal(c.runner.value.week,week);assert.equal(store.data.size,0);c.close();
});
test('actual Roster screen hides Draft/zero counts while loading or failed; retry is accessible',async()=>{
  const {react,Runner,element}=hooks();let state={status:'LOADING'},retries=0;
  const ops={staff:[],duties:[],scheduledWork:[],locations,allLocations:locations,locationName:id=>id,integratedRoster:true,rosterLifecycle:()=>({status:'Draft',hasUnpublishedChanges:false}),loadRosterWeek:async()=>{retries++;},rosterReadState:()=>state};
  const Screen=loader({react,'react/jsx-runtime':{jsx:element,jsxs:element},'./AuthProvider':{useAuth:()=>({user:{uid:'admin'}})},'./OpsProvider':{useOps:()=>ops},'../lib/roster/useRosterWeekPreference':{useRosterWeekPreference:()=>({week,ready:true,setWeek:()=>{}})},'./Icons':{Icon:'Icon'},'./RosterEditor':{RosterEditor:'Editor'},'./useModalFocus':{useModalFocus(){}}})('web-app/components/RosterScreen.tsx').RosterScreen;
  const runner=new Runner(()=>Screen());runner.render();assert.match(text(runner.value),/Loading selected roster/);assert(!text(runner.value).includes('Roster status:'));assert(!text(runner.value).includes('Duties 0'));
  state={status:'ERROR',error:'Could not restore this roster. Retry.'};runner.render();assert(!text(runner.value).includes('Roster status:'));const retry=nodes(runner.value).find(n=>n.type==='button'&&text(n)==='Retry roster');assert(retry);retry.props.onClick();assert.equal(retries,2);
  state={status:'EMPTY'};runner.render();assert.match(text(runner.value),/Roster status: Draft/);runner.unmount();
});
