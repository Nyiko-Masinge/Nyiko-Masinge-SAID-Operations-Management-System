// Run only in a fresh, isolated demo-said-5ce3e Auth/Firestore emulator session.
// Uses the existing security-test Firebase SDK; no new dependency or production credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { PROJECT_ID, ACCOUNTS, ROLES, LOCATIONS, provision, provisioningConfig, request } = require('./provision-emulator-e2e.cjs');
const { initializeApp, deleteApp } = require('../security-tests/node_modules/firebase/app');
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } = require('../security-tests/node_modules/firebase/auth');
const { getFirestore, connectFirestoreEmulator, doc, getDoc, collection, getDocs } = require('../security-tests/node_modules/firebase/firestore');

const env = { ...process.env, SAID_E2E_TEST_PASSWORD: process.env.SAID_E2E_TEST_PASSWORD ?? randomBytes(18).toString('hex') };
let config, first, second, app, auth, db;
test.before(async()=>{
  config=provisioningConfig(env);
  first=await provision(env);
  app=initializeApp({projectId:PROJECT_ID,apiKey:'fake-api-key',authDomain:PROJECT_ID+'.firebaseapp.com'},'stage6a-real-auth');
  auth=getAuth(app);connectAuthEmulator(auth,config.authUrl,{disableWarnings:true});
  const host=new URL(config.firestoreUrl);db=getFirestore(app);connectFirestoreEmulator(db,host.hostname,Number(host.port));
});
test.after(async()=>{if(auth)await signOut(auth);if(app)await deleteApp(app);});

const decode=fields=>Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,
  'booleanValue'in value?value.booleanValue:'integerValue'in value?Number(value.integerValue):'nullValue'in value?null:
  'mapValue'in value?decode(value.mapValue.fields):'arrayValue'in value?(value.arrayValue.values??[]).map(v=>decode({v}).v):'timestampValue'in value?value.timestampValue:value.stringValue]));
async function fixtureDocument(path) {
  return request(`${config.firestoreUrl}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`);
}
test('provisions three real Auth users and exactly corresponding UID profiles/roles',async()=>{
  const listed=await request(`${config.authUrl}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet`);
  assert.equal(listed.users.length,3);assert.equal(first.accounts.length,3);
  for(const person of first.accounts) {
    assert(listed.users.some(u=>u.localId===person.uid&&u.email===person.email));
    const profile=decode((await fixtureDocument(`employees/${person.uid}`)).fields);
    assert(profile.createdAt&&profile.updatedAt);assert.equal(profile.createdBy,first.accounts.find(p=>p.employeeId==='ADMIN001').uid);assert.equal(profile.updatedBy,profile.createdBy);
    for(const key of ['createdAt','updatedAt','createdBy','updatedBy'])delete profile[key];
    const expected=ACCOUNTS.find(a=>a.employeeId===person.employeeId);
    assert.deepEqual(profile,expected);assert(!('email'in profile));assert(!('contactEmail'in profile));
    assert.equal(decode((await fixtureDocument(`roles/${profile.roleId}`)).fields).name,ROLES.find(r=>r.id===profile.roleId).name);
  }
});
test('provisions active Parvo/normal, missing-active legacy and retired locations',async()=>{
  for(const {id,...expected} of LOCATIONS)assert.deepEqual(decode((await fixtureDocument(`locations/${id}`)).fields),expected);
});
test('rerun preserves UIDs, replaces only named fixtures and updates disposable passwords',async()=>{
  env.SAID_E2E_TEST_PASSWORD=randomBytes(18).toString('hex');second=await provision(env);
  assert.deepEqual(second,first);
  const listed=await request(`${config.authUrl}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet`);
  assert.equal(listed.users.length,3);
  for(const person of second.accounts) {
    const signedIn=await signInWithEmailAndPassword(auth,person.email,env.SAID_E2E_TEST_PASSWORD);
    assert.equal(signedIn.user.uid,person.uid);await signOut(auth);
  }
});
test('actual SDK login bootstraps profiles/roles; staff cannot read coworker profiles',async()=>{
  for(const person of first.accounts) {
    await signInWithEmailAndPassword(auth,person.email,env.SAID_E2E_TEST_PASSWORD);
    const profile=await getDoc(doc(db,'employees',person.uid));assert(profile.exists());
    const role=await getDoc(doc(db,'roles',profile.data().roleId));assert(role.exists());
    assert.equal(role.data().name,person.employeeId==='ADMIN001'?'Supervisor/Administrator':'Staff Member');
    if(person.employeeId==='ADMIN001')assert.equal((await getDocs(collection(db,'employees'))).size,3);
    else {
      const coworker=first.accounts.find(p=>p.uid!==person.uid);
      await assert.rejects(getDoc(doc(db,'employees',coworker.uid)),e=>e.code==='permission-denied');
    }
    const locations=await getDocs(collection(db,'locations'));assert.equal(locations.size,4);
    await signOut(auth);
  }
});
test('only employee/role/location/Stage 7A template roots are seeded; no later-stage records',async()=>{
  const result=await request(`${config.firestoreUrl}/v1/projects/${PROJECT_ID}/databases/(default)/documents:listCollectionIds`,{});
  assert.deepEqual(result.collectionIds.sort(),['dutyTemplates','employees','locations','roles']);
  for(const person of first.accounts) {
    const children=await request(`${config.firestoreUrl}/v1/projects/${PROJECT_ID}/databases/(default)/documents/employees/${person.uid}:listCollectionIds`,{});
    assert.equal((children.collectionIds??[]).length,0);
  }
});
