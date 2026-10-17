const test=require('node:test'),assert=require('node:assert/strict');
const {loader,hooks}=require('./stage6b-test-support.cjs');
const timestamp={toDate:()=>new Date('2026-10-05T06:00:00Z')};
function adapter(mode='firestore'){
  const auth={currentUser:{uid:'one'}},calls=[];let callback,onError;
  const sdk={collection:(_db,...path)=>{calls.push(path);return path;},doc:(_db,...path)=>path,orderBy:()=>null,query:q=>q,onSnapshot:(q,cb,error)=>{callback=cb;onError=error;return()=>calls.push('unsubscribe');},updateDoc:async(ref,fields)=>calls.push({ref,fields})};
  const load=loader({'firebase/firestore':sdk,'../../lib/firebase':{auth,db:{}}},{EXPO_PUBLIC_MONITORING_BACKEND:mode});
  const module=load('mobile-app/data/notifications/firestoreRepository.ts');return{auth,calls,module,repo:new module.FirestoreNotificationRepository(),emit:rows=>callback({docs:rows.map((d,i)=>({id:String(i),data:()=>d}))}),error:e=>onError(e)};
}
const notification=()=>({eventId:'event',category:'Roster',title:'Published',message:'Safe issuer and effective date',createdAt:timestamp,isRead:false,recipientId:'forged'});
test('live adapter reads nested UID path; recipient never comes from payload',()=>{const a=adapter();let rows;a.repo.subscribe('one',v=>rows=v,()=>{});a.emit([notification()]);assert.deepEqual(a.calls[0],['employees','one','notifications']);assert.equal(rows[0].recipientId,'one');});
test('recipient can only mark read and path cannot escape',async()=>{const a=adapter();await a.repo.markRead('n','one');assert.deepEqual(a.calls[0],{ref:['employees','one','notifications','n'],fields:{isRead:true}});await assert.rejects(a.repo.markRead('../n','one'));await assert.rejects(a.repo.markRead('n','two'));});
test('explicit demo adapter cannot access live storage',()=>{const a=adapter('memory');assert.throws(()=>a.repo.subscribe('one',()=>{},()=>{}));assert.equal(a.calls.length,0);});
test('malformed/live backend error clears data and reports failure',()=>{const a=adapter();let rows,error;a.repo.subscribe('one',v=>rows=v,e=>error=e);a.emit([{}]);assert.deepEqual(rows,[]);assert(error);error=null;a.error(Error('offline'));assert.equal(error.message,'offline');assert.deepEqual(rows,[]);});
test('late subscription after account switch cannot disclose previous records',()=>{const a=adapter();let rows,error;a.repo.subscribe('one',v=>rows=v,e=>error=e);a.auth.currentUser={uid:'two'};a.emit([notification()]);assert.deepEqual(rows,[]);assert(error);});
test('actual provider immediately masks previous account and ignores late results',async()=>{
 const {react,Runner,element}=hooks();const auth={currentUser:{uid:'one'}};let listener;const subscriptions=[];
 const repo={subscribe:(uid,cb,error)=>{subscriptions.push({uid,cb,error});return()=>{};},markRead:async()=>{},markAllRead:async()=>{}};
 const Provider=loader({react,'react/jsx-runtime':{jsx:element,jsxs:element},'firebase/auth':{onAuthStateChanged:(_a,cb)=>{listener=cb;return()=>{};}},'../lib/firebase':{auth,isFirebaseConfigured:()=>true},'../data/notifications/createRepository':{notificationBackend:'firestore',createNotificationRepository:()=>repo}})('mobile-app/components/NotificationProvider.tsx').NotificationsProvider;
 const runner=new Runner(()=>Provider({staffId:'business-id',children:null}));runner.render();listener(auth.currentUser);await runner.settle();const first=subscriptions.at(-1);first.cb([{id:'one-private',recipientId:'one',category:'Roster',title:'Private',message:'Only one',createdAt:'2026-10-05T06:00:00Z',isRead:false,deliveryStatus:'Sent'}]);await runner.settle();assert.equal(runner.value.props.value.alerts.length,1);
 auth.currentUser={uid:'two'};listener(auth.currentUser);runner.render();assert.deepEqual(runner.value.props.value.alerts,[]);await runner.settle();first.cb([{id:'late-private'}]);await runner.settle();assert.deepEqual(runner.value.props.value.alerts,[]);assert.equal(subscriptions.at(-1).uid,'two');subscriptions.at(-1).error(Error('offline'));await runner.settle();assert.equal(runner.value.props.value.status,'error');runner.unmount();
});
