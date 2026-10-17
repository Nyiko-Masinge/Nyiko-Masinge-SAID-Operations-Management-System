// Actual integrated TS/TSX under the existing deterministic hook driver; no network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { provisioningConfig, provision, alias } = require('./provision-emulator-e2e.cjs');

function driver(env = {}) {
  const source = fs.readFileSync(path.join(__dirname, 'probe-ws1-locations.cjs'), 'utf8');
  const prefix = source.slice(0, source.indexOf('async function main()'))
    .replace('exports, crypto: globalThis.crypto,', 'exports, Error, URL, globalThis: fixtureGlobal, process: fixtureProcess, crypto: fixtureGlobal.crypto,');
  const result = {};
  vm.runInNewContext(prefix + '\nresult.load=load;result.Runner=Runner;', {
    result, require, __dirname, setImmediate, Error, URL,
    globalThis: { crypto: globalThis.crypto }, fixtureGlobal: { crypto: globalThis.crypto }, fixtureProcess: { env },
  });
  return result;
}
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b; }); return {promise,resolve,reject}; };

function authHarness(app) {
  const {load,Runner} = driver();
  const pending = new Map();
  const auth = { currentUser: null };
  let listener, signOuts = 0, unsubscribed = false, pendingSignOut;
  const roleName = app === 'web-app' ? 'Supervisor/Administrator' : 'Staff Member';
  const emit = user => { auth.currentUser = user; return listener(user); };
  const Provider = load(`${app}/components/AuthProvider.tsx`, {
    '../lib/firebase': {isFirebaseConfigured:()=>true,getFirebaseAuth:()=>auth,getFirebaseDb:()=>({})},
    '../lib/authIdentity': {employeeIdToSyntheticEmail:alias},
    '../lib/roles': app === 'web-app' ? {isSupervisorRole:r=>r.name===roleName} : {isStaffRole:r=>r.name===roleName},
    'firebase/auth': {
      onAuthStateChanged:(_auth,cb)=>{listener=cb;return()=>{unsubscribed=true;};},
      signOut:async()=>{signOuts++;if(pendingSignOut)await pendingSignOut.promise;await emit(null);},setPersistence:async()=>{},signInWithEmailAndPassword:async()=>{},
    },
    'firebase/firestore': {
      doc:(_db,collection,id)=>({collection,id}),
      getDoc:ref=>{
        if(ref.collection==='roles')return Promise.resolve({id:ref.id,exists:()=>true,data:()=>({name:roleName})});
        const lookup=deferred();pending.set(ref.id,lookup);return lookup.promise;
      },
    },
  }).AuthProvider;
  const runner = new Runner(()=>Provider({children:null}));runner.render();
  return {
    runner,auth,emit,value:()=>runner.value.props.value,
    resolve:uid=>pending.get(uid).resolve({id:uid,exists:()=>true,data:()=>({employeeId:uid.toUpperCase(),firstName:uid,surname:'Test',roleId:'system-role'})}),
    reject:uid=>pending.get(uid).reject(new Error('obsolete profile failure')),
    signOuts:()=>signOuts,unsubscribed:()=>unsubscribed,
    delaySignOut:()=>{pendingSignOut=deferred();return pendingSignOut;},
  };
}

for(const app of ['web-app','mobile-app']) {
  for(const fails of [false,true]) {
    test(`${app}: late ${fails?'failure':'success'} after logout cannot restore a session`,async()=>{
      const h=authHarness(app);const old=h.emit({uid:'a'});
      await h.value().signOut();await h.runner.settle();
      fails?h.reject('a'):h.resolve('a');await old;await h.runner.settle();
      assert.equal(h.value().status,'signedOut');assert.equal(h.value().user,null);assert.equal(h.value().employee,null);
      assert.equal(h.value().accessError,null);assert.equal(h.signOuts(),1);h.runner.unmount();
    });
    test(`${app}: account B survives account A's late ${fails?'failure':'success'}`,async()=>{
      const h=authHarness(app);const old=h.emit({uid:'a'});const fresh=h.emit({uid:'b'});
      h.resolve('b');await fresh;await h.runner.settle();
      fails?h.reject('a'):h.resolve('a');await old;await h.runner.settle();
      assert.equal(h.value().status,'signedIn');assert.equal(h.value().user.uid,'b');assert.equal(h.value().employee.id,'b');
      assert.equal(h.value().accessError,null);assert.equal(h.signOuts(),0);h.runner.unmount();
    });
  }
  test(`${app}: obsolete lookup cannot update an unmounted provider`,async()=>{
    const h=authHarness(app);const old=h.emit({uid:'a'});await h.runner.settle();h.runner.unmount();
    h.resolve('a');await old;assert.equal(h.runner.dirty,false);assert(h.unsubscribed());
  });
  test(`${app}: current Firebase user must match a resolved profile`,async()=>{
    const h=authHarness(app);const old=h.emit({uid:'a'});h.auth.currentUser={uid:'b'};
    h.resolve('a');await old;await h.runner.settle();assert.equal(h.value().status,'loading');assert.equal(h.value().user,null);h.runner.unmount();
  });
  test(`${app}: explicit logout invalidates before Firebase emits signed-out state`,async()=>{
    const h=authHarness(app);const old=h.emit({uid:'a'});const delayed=h.delaySignOut();
    const logout=h.value().signOut();assert.equal(h.auth.currentUser.uid,'a');
    h.resolve('a');await old;await h.runner.settle();assert.equal(h.value().status,'signedOut');
    delayed.resolve();await logout;h.runner.unmount();
  });
  test(`${app}: returning to the same UID cannot accept an earlier generation`,async()=>{
    const h=authHarness(app);const first=h.emit({uid:'a'});
    const middle=h.emit({uid:'b'});h.resolve('b');await middle;await h.runner.settle();
    // Keep the first A request's resolver before the second A lookup replaces it.
    // Its outstanding request resolves while Firebase reports A again.
    const oldResolve=h.resolve.bind(null,'a');
    // Resolve the old promise now but delay its continuation until the new generation starts.
    oldResolve();const latest=h.emit({uid:'a'});
    await first;await h.runner.settle();assert.equal(h.value().status,'loading');assert.equal(h.value().employee,null);
    h.resolve('a');await latest;await h.runner.settle();assert.equal(h.value().employee.id,'a');h.runner.unmount();
  });
}

function firebaseHarness(app, mode, overrides = {}) {
  const prefix=app==='web-app'?'NEXT_PUBLIC':'EXPO_PUBLIC';
  const env=Object.fromEntries(['API_KEY','AUTH_DOMAIN','PROJECT_ID','STORAGE_BUCKET','MESSAGING_SENDER_ID','APP_ID'].map(key=>[`${prefix}_FIREBASE_${key}`,'test-'+key]));
  Object.assign(env,{
    [`${prefix}_FIREBASE_EMULATORS_ENABLED`]:mode,
    [`${prefix}_FIREBASE_PROJECT_ID`]:'demo-said-5ce3e',
    [`${prefix}_FIREBASE_AUTH_EMULATOR_URL`]:'http://192.168.50.7:9099',
    [`${prefix}_FIREBASE_FIRESTORE_EMULATOR_HOST`]:'192.168.50.7',
    [`${prefix}_FIREBASE_FIRESTORE_EMULATOR_PORT`]:'8080',
  },overrides);
  const {load}=driver(env);const appInstance={},authInstance={},dbInstance={};
  const events=[];let apps=0,authInitializations=0;
  const mocks={
    'firebase/app':{getApps:()=>apps?[appInstance]:[],getApp:()=>appInstance,initializeApp:()=>{apps++;events.push('app');return appInstance;}},
    'firebase/auth':{
      getAuth:()=>authInstance,initializeAuth:()=>{authInitializations++;return authInstance;},getReactNativePersistence:()=>({}),
      connectAuthEmulator:(auth,url)=>{assert.equal(auth,authInstance);events.push(['auth',url]);},
    },
    'firebase/firestore':{getFirestore:()=>dbInstance,connectFirestoreEmulator:(db,host,port)=>{assert.equal(db,dbInstance);events.push(['firestore',host,port]);}},
    '@react-native-async-storage/async-storage':{},
  };
  return {load:()=>load(`${app}/lib/firebase.ts`,mocks),events,apps:()=>apps,authInitializations:()=>authInitializations};
}
for(const app of ['web-app','mobile-app']) {
  test(`${app}: default/off never connects to available emulator endpoints`,()=>{
    for(const mode of [undefined,'false']) {
      const h=firebaseHarness(app,mode);const client=h.load();client.getFirebaseAuth();client.getFirebaseDb();
      assert.equal(h.apps(),1);assert.equal(h.events.filter(Array.isArray).length,0);
    }
  });
  test(`${app}: explicit LAN routing connects once, before return, including module reload`,()=>{
    const h=firebaseHarness(app,'true');let client=h.load();
    for(let i=0;i<3;i++){client.getFirebaseAuth();client.getFirebaseDb();}
    client=h.load();client.getFirebaseAuth();client.getFirebaseDb();
    assert.equal(h.apps(),1);assert.equal(h.events.filter(e=>Array.isArray(e)&&e[0]==='auth').length,1);
    assert.equal(h.events.filter(e=>Array.isArray(e)&&e[0]==='firestore').length,1);
    assert.deepEqual(h.events.find(e=>Array.isArray(e)&&e[0]==='auth'),['auth','http://192.168.50.7:9099']);
    assert.deepEqual(h.events.find(e=>Array.isArray(e)&&e[0]==='firestore'),['firestore','192.168.50.7',8080]);
    if(app==='mobile-app')assert.equal(h.authInitializations(),1);
  });
  const prefix=app==='web-app'?'NEXT_PUBLIC':'EXPO_PUBLIC';
  for(const [name,overrides] of [
    ['production project',{[`${prefix}_FIREBASE_PROJECT_ID`]:'said-5ce3e'}],
    ['missing mobile/web host',{[`${prefix}_FIREBASE_FIRESTORE_EMULATOR_HOST`]:''}],
    ['invalid port',{[`${prefix}_FIREBASE_FIRESTORE_EMULATOR_PORT`]:'70000'}],
    ['non-HTTP Auth URL',{[`${prefix}_FIREBASE_AUTH_EMULATOR_URL`]:'https://example.com:9099'}],
  ])test(`${app}: ${name} fails before service/app creation`,()=>{
    const h=firebaseHarness(app,'true',overrides);
    assert.throws(()=>{const client=h.load();client.getFirebaseAuth();});assert.equal(h.apps(),0);assert.equal(h.events.length,0);
  });
}

test('OpsProvider isolates workforce/templates/work/publication and preserves shared locations',async()=>{
  const {load,Runner}=driver();let auth={status:'signedIn',user:{uid:'a'}},reads=0;
  const persisted=[{id:'parvo',name:'Parvo Ward',active:true},{id:'ward-b',name:'Ward B',active:true},{id:'retired',name:'Old Ward',active:false}];
  const original=JSON.stringify(persisted);let nextRead;
  const Provider=load('web-app/components/OpsProvider.tsx',{
    './AuthProvider':{useAuth:()=>auth},'../lib/locations':{getAllLocations:async()=>{reads++;return nextRead?nextRead.promise:persisted;}},
  }).OpsProvider;
  const r=new Runner(()=>Provider({children:null}));r.render();await r.settle();let v=r.value.props.value;
  const baseline={staff:v.staff.length,duties:v.duties.length,work:v.scheduledWork.length};
  v.addStaff({name:'A only',role:'Nurse',locationId:'parvo',status:'Active',availability:'Available',workload:0,email:'',phone:'',skills:[]});
  assert.equal(v.addDuty({name:'A template',description:'A description',locationId:'parvo',area:'Parvo Ward',time:'06:00',duration:'30 min',required:1,recurrence:'Daily',priority:'Low',isCritical:true,status:'Active',requirements:[]}).ok,true);
  assert.equal(v.createScheduled({title:'A work',description:'A local edit',date:'2026-11-02',startTime:'06:00',endTime:'06:30',area:'Parvo Ward',locationId:'parvo',required:1}).ok,true);
  await r.settle();v=r.value.props.value;const work=v.scheduledWork.find(w=>w.title==='A work');
  assert.equal(v.assignScheduled(work.id,v.staff.find(s=>s.name==='A only').id).ok,true);
  assert.equal(v.publishWeek('2026-11-02',true).status,'published');await r.settle();v=r.value.props.value;
  assert(v.publishedRoster('2026-11-02'));assert(v.assignments.length>0);
  nextRead=deferred();const staleRefresh=v.refreshLocations();
  auth={status:'signedIn',user:{uid:'b'}};r.render();
  assert.equal(r.value.props.value.staff.length,0);assert.equal(r.value.props.value.scheduledWork.length,0);assert.equal(r.value.props.value.publishedRoster('2026-11-02'),undefined);
  nextRead.resolve(persisted);await staleRefresh;await r.settle();nextRead=undefined;v=r.value.props.value;
  assert.equal(v.staff.length,baseline.staff);assert.equal(v.duties.length,baseline.duties);assert.equal(v.scheduledWork.length,baseline.work);
  assert(!v.staff.some(s=>s.name==='A only'));assert(!v.duties.some(d=>d.name==='A template'));assert(!v.scheduledWork.some(w=>w.title==='A work'));
  assert.equal(v.publishedRoster('2026-11-02'),undefined);assert.equal(v.rosterLifecycle('2026-11-02').status,'Draft');
  assert.equal(JSON.stringify(persisted),original);assert.equal(v.locationName('retired'),'Old Ward');assert(!v.locations.some(l=>l.id==='retired'));
  const beforeReads=reads;r.render();await r.settle();assert.equal(reads,beforeReads,'same UID rerender does not reload/reset');
  auth={status:'signedOut',user:null};r.render();await r.settle();v=r.value.props.value;
  for(const key of ['staff','duties','scheduledWork','assignments'])assert.equal(v[key].length,0);
  assert.equal(v.publishedRoster('2026-11-02'),undefined);
  auth={status:'signedIn',user:{uid:'b'}};r.render();await r.settle();assert.equal(r.value.props.value.staff.length,baseline.staff);
  assert.equal(JSON.stringify(persisted),original);r.unmount();
});

const provisionEnv={SAID_EMULATOR_PROVISION:'true',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',SAID_E2E_TEST_PASSWORD:'disposable-test-only'};
for(const [name,overrides] of [
  ['missing opt-in',{SAID_EMULATOR_PROVISION:'false'}],['missing Auth host',{FIREBASE_AUTH_EMULATOR_HOST:''}],
  ['public host',{FIRESTORE_EMULATOR_HOST:'firestore.googleapis.com:443'}],['LAN writer host',{FIREBASE_AUTH_EMULATOR_HOST:'192.168.50.7:9099'}],
  ['production project',{GCLOUD_PROJECT:'said-5ce3e'}],['invalid port',{FIRESTORE_EMULATOR_HOST:'localhost:99999'}],['missing test password',{SAID_E2E_TEST_PASSWORD:''}],
])test(`provisioner rejects ${name} before network`,async()=>{
  let calls=0;await assert.rejects(provision({...provisionEnv,...overrides},async()=>{calls++;}));assert.equal(calls,0);
});
test('provisioner accepts only explicit local config and matches both client aliases',()=>{
  assert.equal(provisioningConfig(provisionEnv).projectId,'demo-said-5ce3e');
  for(const app of ['web-app','mobile-app']) {
    const client=driver().load(`${app}/lib/authIdentity.ts`,{});
    for(const id of ['ADMIN001','STAFF001','STAFF002','  STAFF 001!  '])assert.equal(alias(id),client.employeeIdToSyntheticEmail(id));
  }
});
