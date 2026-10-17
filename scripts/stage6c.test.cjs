const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {loader,hooks,deferred,root} = require('./stage6b-test-support.cjs');
const week='2026-11-16', id='progress-work', uid='authenticated-uid';
const task={id,scheduledWorkId:id,weekStart:week,publicationVersion:'v1',status:'Scheduled',title:'Care',checklist:[],team:[],locationId:'parvo'};
const record=(status,extra={})=>({scheduledWorkId:id,weekStart:week,publicationVersion:'v1',status,updatedAt:{toDate:()=>new Date('2026-11-16T10:00:00Z')},...extra});
function setup({progress,version='v1',assigned=true,mode='firestore',signedIn=true,failRead=false}={}) {
  const auth={currentUser:signedIn?{uid,getIdToken:async()=> 'staff-token'}:null}, reads=[], writes=[], requests=[]; let stored=progress; const receipts=new Map();
  const snapshot=data=>({exists:()=>data!==undefined,data:()=>data});
  const read=async reference=>{
    reads.push(reference);if(failRead)throw Error('raw Firebase secret failure');
    return snapshot(reference.startsWith('employees/')?stored:reference.includes('/items/')?
      {scheduledWorkId:id,weekStart:week,assignedUids:assigned?[uid]:[],title:'Care',team:[{displayName:'Safe Staff',employeeId:'STAFF001',phoneNumber:'private'}]}:
      {weekStart:week,currentVersion:version});
  };
  const sdk={doc:(_db,...parts)=> typeof _db === 'string' ? {id:'request-'+requests.length} : parts.join('/'),collection:(_db,...parts)=>parts.join('/'),serverTimestamp:()=> 'SERVER_TIMESTAMP',getDocFromServer:read,
    getDocsFromServer:async()=>({docs:[{id,data:()=>({scheduledWorkId:id,weekStart:week,assignedUids:[uid],title:'Care',team:[{employeeId:'STAFF001',displayName:'Safe Staff',phoneNumber:'private'}]})}]}),
    runTransaction:async(_db,callback)=>callback({get:read,set:(ref,data)=>writes.push({kind:'create',ref,data}),update:(ref,data)=>writes.push({kind:'update',ref,data})}),
  };
  const serverLoad=loader({'../../../../lib/server/admin':{progressStore:()=>store}});
  const trusted=serverLoad('web-app/lib/server/taskProgress.ts');
  const store={verifyToken:async token=>{assert.equal(token,'staff-token');return {uid};},commit:async(actor,action)=>{
    const metadata=(await read('publishedRosters/'+week)).data(),item=(await read('publishedRosters/'+week+'/versions/'+version+'/items/'+id)).data();
    const eventId=trusted.progressEventId(actor,action.requestId);
    const result=trusted.progressMutation(actor,action,{active:true,roleId:'staff',employeeId:'STAFF001'},{name:'Staff Member'},metadata,item,stored,receipts.get(eventId),[],'SERVER_TIMESTAMP');
    if(!result.replay){const data=stored?{status:result.progress.status,publicationVersion:result.progress.publicationVersion,updatedAt:result.progress.updatedAt,...(statusReason(action))}:result.progress;
      writes.push({kind:stored?'update':'create',ref:'employees/'+actor+'/taskProgress/'+id,data});stored={...result.progress,updatedAt:{toDate:()=>new Date()}};receipts.set(eventId,result.event);}
    return result.result;
  }};
  const statusReason=action=>action.status==='Unable to Complete'?{unableToCompleteReason:action.unableToCompleteReason}:{};
  const POST=serverLoad('web-app/app/api/mobile/task-progress/route.ts').POST;
  const apiFetch=async(url,options)=>{requests.push({url,...options});return POST(new Request(url,options));};
  const load=loader({'firebase/firestore':sdk,'./firebase':{getFirebaseAuth:()=>auth,getFirebaseDb:()=>({})},'../firebase':{getFirebaseAuth:()=>auth,getFirebaseDb:()=>({})}},
    {EXPO_PUBLIC_ROSTER_BACKEND:mode,NEXT_PUBLIC_ROSTER_BACKEND:mode,EXPO_PUBLIC_API_BASE_URL:'https://trusted.test'}, {fetch:apiFetch});
  return {api:load('mobile-app/lib/taskProgress.ts'),supervisor:load('web-app/lib/roster/progress.ts'),auth,reads,writes,requests};
}
for(const status of ['Scheduled','In Progress','Completed','Unable to Complete']) test(`reader restores ${status}`,async()=>{
  const context=setup({progress:status==='Scheduled'?undefined:record(status,{unableToCompleteReason:'Equipment missing'})});
  const [result]=await context.api.mergeTaskProgress([task],uid);assert.equal(result.status,status);
  if(status==='Unable to Complete')assert.equal(result.unableToCompleteReason,'Equipment missing');
  assert.equal(result.scheduledWorkId,id);assert.equal(context.reads[0],`employees/${uid}/taskProgress/${id}`);
});
test('failed progress read rejects rather than returning Scheduled',async()=>{await assert.rejects(setup({failRead:true}).api.mergeTaskProgress([task],uid));});
for(const extra of [{status:['Completed']},{updatedAt:'client time'},{status:'Scheduled'},{publicationVersion:''}])test(`malformed persisted progress rejects: ${JSON.stringify(extra)}`,async()=>{
  const c=setup({progress:record('Completed',extra)});await assert.rejects(c.api.mergeTaskProgress([task],uid));await assert.rejects(c.supervisor.readSupervisorProgress(week));
});
test('Start creates only nested progress and first state In Progress',async()=>{
  const c=setup();await c.api.saveTaskProgress(task,'In Progress');assert.equal(c.writes.length,1);
  assert.deepEqual(c.writes[0],{kind:'create',ref:`employees/${uid}/taskProgress/${id}`,data:{scheduledWorkId:id,weekStart:week,publicationVersion:'v1',status:'In Progress',updatedAt:'SERVER_TIMESTAMP'}});
});
test('cannot persist Completed as first state',async()=>{const c=setup();await assert.rejects(c.api.saveTaskProgress(task,'Completed'));assert.equal(c.writes.length,0);});
test('Complete updates without immutable identity fields',async()=>{
  const c=setup({progress:record('In Progress')});await c.api.saveTaskProgress({...task,status:'In Progress'},'Completed');
  assert.equal(c.writes[0].kind,'update');assert.equal(c.writes[0].data.status,'Completed');assert(!('weekStart' in c.writes[0].data));assert(!('scheduledWorkId'in c.writes[0].data));
});
test('Unable rejects blank trimmed reason before any write',async()=>{const c=setup({progress:record('In Progress')});await assert.rejects(c.api.saveTaskProgress({...task,status:'In Progress'},'Unable to Complete',' \u00a0 '));assert.equal(c.writes.length,0);});
test('Unable persists trimmed reason',async()=>{const c=setup({progress:record('In Progress')});await c.api.saveTaskProgress({...task,status:'In Progress'},'Unable to Complete','  Equipment missing  ');assert.equal(c.writes[0].data.unableToCompleteReason,'Equipment missing');});
for(const status of ['Completed','Unable to Complete'])test(`${status} reopens and preserves prior reason`,async()=>{
  const c=setup({progress:record(status,{unableToCompleteReason:'Keep reason'})});const result=await c.api.saveTaskProgress({...task,status},'In Progress');
  assert.equal(result.status,'In Progress');assert.equal(result.unableToCompleteReason,'Keep reason');assert(!('unableToCompleteReason'in c.writes[0].data));
});
test('adapter never deletes progress or accesses raw shifts',()=>{const source=fs.readFileSync(path.join(root,'mobile-app/lib/taskProgress.ts'),'utf8');assert(!/deleteDoc|transaction\.delete\(|['"]shifts['"]/.test(source));});
test('fixture writer and reader perform zero Firebase operations',async()=>{const c=setup({mode:'fixture'});await c.api.saveTaskProgress(task,'In Progress');await c.api.mergeTaskProgress([task],uid);assert.equal(c.writes.length,0);assert.equal(c.reads.length,0);});
test('unauthenticated live write blocked before reads/writes',async()=>{const c=setup({signedIn:false});await assert.rejects(c.api.saveTaskProgress(task,'In Progress'));assert.equal(c.writes.length,0);assert.equal(c.reads.length,0);});
test('identity path uses authenticated UID, never employee business ID',async()=>{const c=setup();await c.api.saveTaskProgress({...task,employeeId:'STAFF001',uid:'forged'},'In Progress');assert.equal(c.writes[0].ref,`employees/${uid}/taskProgress/${id}`);});
test('mismatched scheduledWorkId cannot write',async()=>{const c=setup();await assert.rejects(c.api.saveTaskProgress({...task,scheduledWorkId:'different'},'In Progress'));assert.equal(c.writes.length,0);});
test('stable ID is mandatory, no fixture tuple persistence fallback',async()=>{const c=setup();await assert.rejects(c.api.saveTaskProgress({...task,scheduledWorkId:undefined},'In Progress'));assert.equal(c.writes.length,0);});
test('unchanged current version performs normal transition',async()=>{const c=setup({progress:record('In Progress')});await c.api.saveTaskProgress({...task,status:'In Progress'},'Completed');assert.equal(c.writes[0].data.publicationVersion,'v1');assert(c.reads.includes(`publishedRosters/${week}/versions/v1/items/${id}`));});
test('republish preserves progress and migrates version on legitimate transition',async()=>{const c=setup({progress:record('Completed'),version:'v2'});const [restored]=await c.api.mergeTaskProgress([task],uid);assert.equal(restored.status,'Completed');await c.api.saveTaskProgress(restored,'In Progress');assert.equal(c.writes[0].data.publicationVersion,'v2');});
test('removed assignment rejects without writes',async()=>{const c=setup({assigned:false,version:'v2'});await assert.rejects(c.api.saveTaskProgress(task,'In Progress'));assert.equal(c.writes.length,0);});
test('stale effective status rejects and prompts refresh',async()=>{const c=setup({progress:record('Completed')});let failure;try{await c.api.saveTaskProgress(task,'In Progress');}catch(error){failure=error;}assert(failure);assert(c.api.progressErrorMessage(failure).includes('Refresh the roster'));assert.equal(c.writes.length,0);});
test('Firebase error text never appears in staff error',()=>{const c=setup();assert(!c.api.progressErrorMessage(Error('raw Firebase exception')).includes('raw Firebase'));assert(c.api.progressErrorMessage({code:'permission-denied'}).includes('Refresh the roster'));});
test('cross-week stable ID collision fails safely',async()=>{const c=setup({progress:record('In Progress',{weekStart:'2026-11-09'})});await assert.rejects(c.api.mergeTaskProgress([task],uid));await assert.rejects(c.api.saveTaskProgress({...task,status:'In Progress'},'Completed'));assert.equal(c.writes.length,0);});
const nodes=tree=>Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];
const text=tree=>tree==null||typeof tree==='boolean'?'':Array.isArray(tree)?tree.map(text).join(' '):typeof tree==='object'?text(tree.props?.children):String(tree);
const native={View:'View',Text:'Text',Pressable:'Pressable',ScrollView:'ScrollView',Modal:'Modal',KeyboardAvoidingView:'KeyboardAvoidingView',TextInput:'TextInput',Platform:{OS:'android'},StyleSheet:{create:v=>v}};
function screenRunner(action,status) {
  const {react,Runner,element}=hooks();const writes=[],success=[],pending=[];const c=setup();
  const Screen=loader({'react':react,'react/jsx-runtime':{jsx:element,jsxs:element},'react-native':native,'@expo/vector-icons':{Ionicons:'Icon'},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
    '../lib/taskProgress':{progressErrorMessage:c.api.progressErrorMessage,saveTaskProgress:(_task,next,reason)=>{writes.push({next,reason});const d=deferred();pending.push(d);return d.promise;}},
    '../lib/useLocations':{useLocations:()=>({locationName:()=> 'Parvo',error:null,retry(){}})},'./StaffHomeScreen':{BottomNavigation:'BottomNavigation'},'./StaffAppHeader':{StaffAppHeader:'Header'},
  })('mobile-app/components/StaffTaskDetailScreen.tsx').StaffTaskDetailScreen;
  const props={task:{...task,status},onStartTask:()=>success.push('Start'),onMarkComplete:()=>success.push('Complete'),onReopenTask:()=>success.push('Reopen'),onMarkUnableToComplete:()=>success.push('Unable'),onRefreshRoster:()=>success.push('refresh')};
  const runner=new Runner(()=>Screen(props));runner.render();
  const control=label=>{const expanded = nodes(runner.value).flatMap(n => typeof n.type === 'function' ? nodes(n.type(n.props)) : [n]);const node=expanded.find(n=>n.props?.accessibilityLabel===label);assert(node,label);return node.props;};
  if(action==='Unable'){control('Unable to complete reason').onChangeText('  Equipment missing  ');runner.render();}
  const label={Start:'Start task',Complete:'Confirm task completion',Unable:'Submit unable to complete reason',Reopen:'Confirm reopen task'}[action];
  return {runner,control,label,writes,success,pending,props};
}
for(const [action,status]of [['Start','Scheduled'],['Complete','In Progress'],['Unable','In Progress'],['Reopen','Completed']])test(`actual ${action} keeps synchronous save lock, visible saving, failure honesty and retry`,async()=>{
  const c=screenRunner(action,status),handler=c.control(c.label).onPress;
  const first=handler(),duplicate=handler();assert.equal(c.writes.length,1);assert.equal(c.success.length,0);c.runner.render();assert(text(c.runner.value).includes('Saving task progress'));
  c.pending[0].reject({code:'permission-denied',message:'raw backend exception'});await Promise.all([first,duplicate]);await c.runner.settle();assert.equal(c.success.length,0);assert(text(c.runner.value).includes('Refresh the roster'));assert(!text(c.runner.value).includes('raw backend exception'));
  if(action==='Unable'){c.control('Unable to complete reason').onChangeText('Equipment missing');c.runner.render();}
  const retry=c.control(c.label).onPress();assert.equal(c.writes.length,2);c.pending[1].resolve({status:action==='Complete'?'Completed':action==='Unable'?'Unable to Complete':'In Progress'});await retry;await c.runner.settle();assert.deepEqual(c.success,[action]);c.runner.unmount();
});
test('unmounted task never reports late local success',async()=>{const c=screenRunner('Start','Scheduled');const saving=c.control(c.label).onPress();c.runner.unmount();c.pending[0].resolve({status:'In Progress'});await saving;assert.equal(c.success.length,0);});
test('progress read failure puts actual roster hook in ERROR and retry restores saved status',async()=>{
  const {react,Runner}=hooks();let fail=true;const hook=loader({'react':react,'../components/AuthProvider':{useAuth:()=>({status:'signedIn',employee:{id:uid},user:{uid}})},
    './publishedRoster':{firestoreRosterEnabled:true,readCurrentPublication:async()=>({status:'DATA',version:'v1',tasks:[task]})},
    './taskProgress':{mergeTaskProgress:async()=>{if(fail)throw Error('Firebase failure');return [{...task,status:'Completed'}];}},
  })('mobile-app/lib/usePublishedRoster.ts').usePublishedRoster;
  const runner=new Runner(()=>hook(week));runner.render();await runner.settle();assert.equal(runner.value.state.status,'ERROR');assert.equal(runner.value.state.tasks.length,0);assert(!runner.value.state.error.includes('Firebase failure'));
  fail=false;runner.value.retry();await runner.settle();assert.equal(runner.value.state.tasks[0].status,'Completed');runner.unmount();
});
for(const status of ['Scheduled','In Progress','Completed','Unable to Complete'])test(`supervisor joins safe published identity with ${status}`,async()=>{
  const c=setup({progress:status==='Scheduled'?undefined:record(status,{unableToCompleteReason:'Missing equipment'})});const result=await c.supervisor.readSupervisorProgress(week);
  assert.equal(result.rows[0].status,status);assert.equal(result.rows[0].uid,uid);assert.equal(result.rows[0].displayName,'Safe Staff');assert(!('phoneNumber'in result.rows[0]));assert.equal(c.writes.length,0);
});
test('supervisor reader propagates failure without Scheduled substitution',async()=>{await assert.rejects(setup({failRead:true}).supervisor.readSupervisorProgress(week));});
test('fixture supervisor reader performs zero reads',async()=>{const c=setup({mode:'fixture'});await c.supervisor.readSupervisorProgress(week);assert.equal(c.reads.length,0);});
test('supervisor sees retained progress version after republish',async()=>{const c=setup({progress:record('Completed'),version:'v2'});const result=await c.supervisor.readSupervisorProgress(week);assert.equal(result.rows[0].publicationVersion,'v2');assert.equal(result.rows[0].progressVersion,'v1');assert.equal(result.rows[0].status,'Completed');});
test('supervisor hook masks old UID/week responses and handles errors',async()=>{
  const {react,Runner}=hooks();let user={uid:'one'},weekValue=week;const requests=[];
  const use=loader({'react':react,'../../components/AuthProvider':{useAuth:()=>({status:'signedIn',user,role:{name:'Supervisor/Administrator'}})},'./backend':{firestoreRosterEnabled:true},
    './progress':{readSupervisorProgress:()=>{const d=deferred();requests.push(d);return d.promise;}},
  })('web-app/lib/roster/useSupervisorProgress.ts').useSupervisorProgress;
  const runner=new Runner(()=>use(weekValue));runner.render();user={uid:'two'};runner.render();requests[0].resolve({status:'DATA',rows:[{uid:'one'}]});await runner.settle();assert.equal(runner.value.state.status,'LOADING');requests[1].reject(Error('denied'));await runner.settle();assert.equal(runner.value.state.status,'ERROR');assert.equal(runner.value.state.rows.length,0);
  weekValue='2026-11-23';runner.render();assert.equal(runner.value.state.status,'LOADING');requests[2].resolve({status:'EMPTY',rows:[]});await runner.settle();assert.equal(runner.value.state.status,'EMPTY');runner.unmount();
});
test('dashboard counts actual progress only in integrated DATA state and offers refresh',()=>{
  const {react,Runner,element}=hooks();let state={status:'DATA',rows:[{scheduledWorkId:id,uid,displayName:'Safe',employeeId:'STAFF001',title:'Care',status:'Completed'},{scheduledWorkId:'b',uid,status:'In Progress'}]},refreshes=0;
  const Dashboard=loader({'react':react,'react/jsx-runtime':{jsx:element,jsxs:element},'next/link':'Link','./Icons':{Icon:'Icon'},'./AlertsHistory':{ALERT_ICON:{}},'./MonitoringProvider':{useMonitoring:()=>({openAlerts:[],loading:false})},
    './OpsProvider':{useOps:()=>({staff:[],scheduledWork:[],locations:[]})},'../lib/roster/backend':{firestoreRosterEnabled:true},'../lib/roster/useSupervisorProgress':{useSupervisorProgress:()=>({state,refresh:()=>refreshes++})},
  })('web-app/components/Dashboard.tsx').Dashboard;
  const runner=new Runner(()=>Dashboard());runner.render();const cards=()=>Object.fromEntries(nodes(runner.value).filter(n=>n.type==='article'&&n.props.className?.startsWith('stat-card')).map(n=>[text(n.props.children.find(c=>c.type==='h3')).trim(),text(n.props.children.find(c=>c.type==='strong')).trim()]));
  assert.equal(cards().Completed,'1');assert.equal(cards()['In Progress'],'1');nodes(runner.value).find(n=>n.type==='button'&&text(n)==='Refresh progress').props.onClick();assert.equal(refreshes,1);
  state={status:'ERROR',rows:[]};runner.render();assert.equal(cards().Completed,'—');assert(text(runner.value).includes('Could not load task progress'));runner.unmount();
});
