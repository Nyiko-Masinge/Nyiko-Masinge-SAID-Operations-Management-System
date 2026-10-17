// Additional Stage 7A cases. The certified 193-case suite remains unchanged.
import { readFile } from 'node:fs/promises';
import { before, after, beforeEach, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, setLogLevel } from 'firebase/firestore';
let env;
before(async()=>{setLogLevel('silent');const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');env=await initializeTestEnvironment({projectId:'demo-said-5ce3e',firestore:{host,port:Number(port),rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{
  await env.clearFirestore();await env.withSecurityRulesDisabled(async context=>{
    const db=context.firestore();await Promise.all([
      setDoc(doc(db,'roles/admin'),{name:'Supervisor/Administrator'}),setDoc(doc(db,'roles/staff'),{name:'Staff Member'}),
      setDoc(doc(db,'employees/admin'),{employeeId:'ADMIN001',firstName:'Test',surname:'Admin',roleId:'admin'}),
      setDoc(doc(db,'employees/staff'),{employeeId:'STAFF001',firstName:'Test',surname:'Staff',roleId:'staff',active:true,skills:['Care'],availability:{normalState:'Available',state:'Available',effectiveFrom:'2026-01-01T00:00:00.000Z',effectiveTo:null}}),
      setDoc(doc(db,'employees/unknown-role'),{employeeId:'UNKNOWN',firstName:'Unknown',surname:'Role',roleId:'unknown'}),
      setDoc(doc(db,'dutyTemplates/template'),{name:'Test',active:true,requiredSkills:['Care'],requirements:['Check ward']}),
    ]);
  });
});
const dbFor=uid=>uid===null?env.unauthenticatedContext().firestore():env.authenticatedContext(uid).firestore();
test('supervisor may read/list durable administrative templates and workforce',async()=>{const db=dbFor('admin');await assertSucceeds(getDoc(doc(db,'dutyTemplates/template')));await assertSucceeds(getDocs(collection(db,'dutyTemplates')));await assertSucceeds(getDocs(collection(db,'employees')));});
for(const uid of ['staff','unknown-role','no-profile',null]){
  test(`${uid??'anonymous'} cannot get/list templates`,async()=>{const db=dbFor(uid);await assertFails(getDoc(doc(db,'dutyTemplates/template')));await assertFails(getDocs(collection(db,'dutyTemplates')));});
  for(const operation of ['create','update','delete'])test(`${uid??'anonymous'} cannot ${operation} templates`,async()=>{const db=dbFor(uid);await assertFails(operation==='create'?setDoc(doc(db,'dutyTemplates/new'),{name:'Forged',active:true}):operation==='update'?updateDoc(doc(db,'dutyTemplates/template'),{active:false}):deleteDoc(doc(db,'dutyTemplates/template')));});
}
for(const operation of ['create','update','delete'])test(`supervisor client cannot ${operation} templates; only authorized Admin API writes`,async()=>{const db=dbFor('admin');await assertFails(operation==='create'?setDoc(doc(db,'dutyTemplates/new'),{name:'Forged',active:true}):operation==='update'?updateDoc(doc(db,'dutyTemplates/template'),{active:false}):deleteDoc(doc(db,'dutyTemplates/template')));});
for(const uid of ['staff','admin'])for(const field of ['active','availability','skills','jobCategory','locationId','employeeId','roleId','uid','status','isActive'])test(`${uid} client cannot forge workforce ${field}`,async()=>{await assertFails(updateDoc(doc(dbFor(uid),'employees/staff'),{[field]:field==='active'?false:field==='skills'?['Forged']:'forged'}));});
test('staff still reads only own profile; workforce collection remains administrative',async()=>{const db=dbFor('staff');await assertSucceeds(getDoc(doc(db,'employees/staff')));await assertFails(getDoc(doc(db,'employees/admin')));await assertFails(getDocs(collection(db,'employees')));});
test('unknown writes and template subcollections remain denied',async()=>{for(const uid of ['staff','admin']){const db=dbFor(uid);await assertFails(setDoc(doc(db,'unknownStage7a/probe'),{active:true}));await assertFails(setDoc(doc(db,'dutyTemplates/template/history/forged'),{actor:uid}));}});
