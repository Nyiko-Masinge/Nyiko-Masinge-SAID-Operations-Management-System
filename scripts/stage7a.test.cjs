// Actual Stage 7A boundaries, adapters, provider and forms; deterministic I/O only.
const test=require('node:test');
const assert=require('node:assert/strict');
const {loader,hooks,plain,deferred}=require('./stage6b-test-support.cjs');
const {ACCOUNTS,TEMPLATES,provision}=require('./provision-emulator-e2e.cjs');
const server=loader()('web-app/lib/server/planning.ts');
const model=loader()('web-app/lib/planning/model.ts');
const mappings=loader()('web-app/lib/roster/workforce.ts');
const templateLib=loader()('web-app/lib/planning/templates.ts');
const staff=()=>({...plain(ACCOUNTS[1]),revision:1});
const template=()=>{const{id,...fields}=plain(TEMPLATES[0]);delete fields.revision;return fields;};
function store(){
  const records={'employees/admin':{roleId:'supervisor'},'roles/supervisor':{name:'Supervisor/Administrator'},'employees/member':staff(),'roles/system-staff':{name:'Staff Member'},'locations/parvo':{name:'Parvo Ward',active:true},'locations/ward-b':{name:'Ward B',active:true}};
  let writes=0;
  return {records,get writes(){return writes;},verifyToken:async token=>{if(!['admin','member'].includes(token))throw Error('invalid');return {uid:token};},read:async path=>plain(records[path]??null)??undefined,
    write:async(path,actor,validate)=>{const current=records[path];const result=validate(current);writes++;return records[path]={...current,...plain(result),revision:(current?.revision??0)+1,updatedAt:'server-time',updatedBy:actor,...(!current?{createdAt:'server-time',createdBy:actor}:{})};}};
}
const workforceInput=(fields={})=>({uid:'member',expectedRevision:1,fields});
const templateInput=(fields=template())=>({templateId:'template-1',expectedRevision:0,create:true,fields});
test('approved workforce fields persist and reload with stable UID/Employee ID/auth role',async()=>{
  const s=store(),availability={...staff().availability,state:'Unavailable',effectiveFrom:'2026-10-05T06:00:00.000Z',effectiveTo:'2026-10-07T15:00:00.000Z'};
  await server.writeWorkforce('Bearer admin',workforceInput({jobCategory:'Nurse',locationId:'ward-b',active:false,availability,skills:['Animal Handling']}),s);
  const person=mappings.mapWorkforce('member',await s.read('employees/member'));
  assert.equal(person.uid,'member');assert.equal(person.id,'STAFF001');assert.equal(person.status,'Inactive');assert.equal(person.locationId,'ward-b');assert.deepEqual(person.availabilityPlan,availability);assert.deepEqual(person.skills,['Animal Handling']);assert.equal(person.revision,2);assert.equal(s.records['employees/member'].roleId,'system-staff');assert.equal(s.records['employees/member'].updatedBy,'admin');
});
for(const [label,authorization] of [['anonymous',null],['expired','Bearer bad'],['staff','Bearer member']]){
  test(`${label} cannot administer workforce or templates`,async()=>{const s=store();for(const [fn,input] of [[server.writeWorkforce,workforceInput({active:false})],[server.writeTemplate,templateInput()]])await assert.rejects(fn(authorization,input,s),error=>[401,403].includes(error.status));assert.equal(s.writes,0);});
}
for(const field of ['uid','id','employeeId','roleId','firstName','surname','contactEmail','phoneNumber','status','isActive','revision','updatedBy'])test(`workforce rejects forged ${field}`,async()=>{
  const s=store();await assert.rejects(server.writeWorkforce('Bearer admin',workforceInput({[field]:'forged'}),s),error=>error.status===400);assert.equal(s.writes,0);
});
test('legacy missing operational fields stay unknown and are never implicitly persisted',()=>{
  const profile={employeeId:'OLD001',firstName:'Old',surname:'Person',roleId:'system-staff'};
  const person=mappings.mapWorkforce('legacy-uid',profile);assert.equal(person.status,'Unknown');assert.equal(person.availability,'Unknown');assert.equal(person.skillsKnown,false);assert.equal(person.operationalMissing,true);assert.deepEqual(profile,{employeeId:'OLD001',firstName:'Old',surname:'Person',roleId:'system-staff'});
});
test('legacy profile requires explicit operational initialization',async()=>{
  const s=store();s.records['employees/member']={employeeId:'STAFF001',firstName:'Old',surname:'Member',roleId:'system-staff'};
  await assert.rejects(server.writeWorkforce('Bearer admin',{...workforceInput({active:true}),expectedRevision:0},s));
  const {jobCategory,locationId,active,availability,skills}=staff();await server.writeWorkforce('Bearer admin',{...workforceInput({jobCategory,locationId,active,availability,skills}),expectedRevision:0},s);assert.equal(s.records['employees/member'].revision,1);
});
test('availability applies inclusive start/exclusive end and normal state outside the window',()=>{
  const availability={normalState:'Available',state:'Unavailable',effectiveFrom:'2026-10-05T06:00:00.000Z',effectiveTo:'2026-10-05T10:00:00.000Z'};
  for(const [time,result] of [['05:59:00','Available'],['06:00:00','Unavailable'],['09:59:00','Unavailable'],['10:00:00','Available']])assert.equal(model.availabilityAt(availability,`2026-10-05T${time}.000Z`),result);
  assert.equal(model.availabilityAt({...availability,effectiveTo:null},'2027-01-01T00:00:00.000Z'),'Unavailable');
});
for(const [label,availability] of [['timeless','Available'],['no start',{normalState:'Available',state:'Unavailable',effectiveTo:null}],['inverted',{...staff().availability,effectiveTo:'2025-01-01T00:00:00.000Z'}],['invalid date',{...staff().availability,effectiveFrom:'2026-02-30T00:00:00.000Z'}],['unknown field',{...staff().availability,approved:true}]])test(`rejects ${label} availability`,async()=>{const s=store();await assert.rejects(server.writeWorkforce('Bearer admin',workforceInput({availability}),s));assert.equal(s.writes,0);});
test('bounded skills reject duplicates, excessive size and blank labels',async()=>{for(const skills of [['Nurse','nurse'],[' '],Array.from({length:33},(_,i)=>`skill-${i}`),['x'.repeat(81)]])await assert.rejects(server.writeWorkforce('Bearer admin',workforceInput({skills}),store()));});
test('stale workforce edit fails; atomic check catches a concurrent update',async()=>{
  const s=store();await server.writeWorkforce('Bearer admin',workforceInput({active:false}),s);await assert.rejects(server.writeWorkforce('Bearer admin',workforceInput({active:true}),s),error=>error.status===409);
  const race=store(),write=race.write;race.write=async(...args)=>{race.records['employees/member'].revision=2;return write(...args);};await assert.rejects(server.writeWorkforce('Bearer admin',workforceInput({active:false}),race),error=>error.status===409);
});
test('template create, fresh reload, edit and soft deactivate/reactivate persist separately from instructions',async()=>{
  const s=store();let result=await server.writeTemplate('Bearer admin',templateInput(),s);let mapped=templateLib.mapTemplate('template-1',await s.read('dutyTemplates/template-1'));
  assert.equal(mapped.priority,'High');assert.equal(mapped.isCritical,false);assert.deepEqual(mapped.requiredSkills,['Ward Care']);assert.deepEqual(mapped.requirements,['Check ward equipment']);assert.equal(result.createdBy,'admin');
  result=await server.writeTemplate('Bearer admin',{...templateInput({name:'Changed',priority:'Low',isCritical:true,active:false}),create:false,expectedRevision:1},s);
  mapped=templateLib.mapTemplate('template-1',result);assert.equal(mapped.name,'Changed');assert.equal(mapped.status,'Inactive');assert.equal(mapped.priority,'Low');assert.equal(mapped.isCritical,true);assert.deepEqual(mapped.requiredSkills,['Ward Care']);
  await server.writeTemplate('Bearer admin',{...templateInput({active:true}),create:false,expectedRevision:2},s);assert.equal(s.records['dutyTemplates/template-1'].active,true);assert.equal(s.records['dutyTemplates/template-1'].revision,3);
});
for(const [label,fields] of [['renamed checklist',{requirements:undefined}],['duplicate skill',{requiredSkills:['Care','care']}],['unknown metadata',{createdBy:'forged'}],['zero staff',{requiredStaff:0}],['overnight',{durationMinutes:1440}],['timeless recurrence',{recurrence:'Sometimes'}],['missing active',{active:undefined}]])test(`invalid template ${label} writes nothing`,async()=>{const s=store();await assert.rejects(server.writeTemplate('Bearer admin',templateInput({...template(),...fields}),s));assert.equal(s.writes,0);});
test('template create collisions and stale edits fail instead of replacing records',async()=>{const s=store();await server.writeTemplate('Bearer admin',templateInput(),s);await assert.rejects(server.writeTemplate('Bearer admin',templateInput(),s),error=>error.status===409);await assert.rejects(server.writeTemplate('Bearer admin',{...templateInput({active:false}),create:false},s),error=>error.status===409);assert.equal(s.writes,1);});
test('retired locations may be retained but cannot be chosen for new records',async()=>{
  const s=store();s.records['locations/parvo'].active=false;await server.writeWorkforce('Bearer admin',workforceInput({active:false}),s);await assert.rejects(server.writeTemplate('Bearer admin',templateInput(),s));
});
test('editing a template leaves dated work and immutable publication untouched',async()=>{
  const load=loader(),generation=load('web-app/lib/roster/generation.ts'),pub=load('web-app/lib/roster/publication.ts'),s=store();await server.writeTemplate('Bearer admin',templateInput(),s);
  const duty=templateLib.mapTemplate('template-1',s.records['dutyTemplates/template-1']);let serial=0;const result=generation.generateRecurringDuties('2026-10-05',[],[duty],()=>`work-${++serial}`);assert(result.ok);
  const publication=pub.publishRoster('2026-10-05',result.scheduled,[duty],{},true);assert.equal(publication.status,'published');const before=plain({scheduled:result.scheduled,snapshot:publication.snapshot});
  await server.writeTemplate('Bearer admin',{...templateInput({name:'New',defaultStartTime:'10:00',isCritical:true,active:false}),create:false,expectedRevision:1},s);
  assert.deepEqual(plain({scheduled:result.scheduled,snapshot:publication.snapshot}),before);
});
function provider(options={}){
  const {react,Runner,element}=hooks();let identity={status:'signedIn',user:{uid:'admin',getIdToken:async()=> 'admin'}};let people=[mappings.mapWorkforce('member',staff())],templates=[templateLib.mapTemplate('fixture-ward-round',TEMPLATES[0])];
  const mocks={react,'react/jsx-runtime':{jsx:element,jsxs:element},'./AuthProvider':{useAuth:()=>identity},'../lib/locations':{getAllLocations:async()=>[{id:'parvo',name:'Parvo Ward',active:true},{id:'ward-b',name:'Ward B',active:true}]},'../lib/roster/workforce':{...mappings,loadWorkforce:async()=>plain(people)},'../lib/planning/templates':{...templateLib,loadTemplates:options.loadTemplates??(async()=>plain(templates))},'../lib/planning/client':{persistWorkforce:options.persistWorkforce??(async(_user,_uid,revision,fields)=>{const data={...staff(),...fields,revision:revision+1};people=[mappings.mapWorkforce('member',data)];return data;}),persistTemplate:options.persistTemplate??(async(_user,id,revision,_create,fields)=>{const result={...fields,revision:revision+1};templates=templates.filter(d=>d.id!==id).concat(templateLib.mapTemplate(id,result));return result;})}};
  const Provider=loader(mocks,{NEXT_PUBLIC_ROSTER_BACKEND:'firestore'})('web-app/components/OpsProvider.tsx').OpsProvider;const runner=new Runner(()=>Provider({children:null}));runner.render();
  return{runner,get ops(){return runner.value.props.value;},async ready(){await runner.settle();},identity(value){identity=value;runner.render();}};
}
test('provider durable edit survives refresh; does not preserve obsolete session overlays',async()=>{const p=provider();await p.ready();await p.ops.updateStaff('STAFF001',{status:'Inactive',skills:['Care']});await p.ready();await p.ops.refreshWorkforce();await p.ready();assert.equal(p.ops.staff[0].status,'Inactive');assert.deepEqual(p.ops.staff[0].skills,['Care']);p.runner.unmount();});
test('provider keeps the form opening revision after refresh, for workforce and templates',async()=>{
  const revisions=[],p=provider({persistWorkforce:async(_user,_uid,revision)=>{revisions.push(revision);return {...staff(),revision:revision+1};},persistTemplate:async(_user,_id,revision,_create,fields)=>{revisions.push(revision);return {...fields,revision:revision+1};}});
  await p.ready();const person=plain(p.ops.staff[0]),duty=plain(p.ops.duties[0]);
  await p.ops.updateStaff(person.id,{status:'Inactive'});await p.ready();await p.ops.updateStaff(person.id,{...person,status:'Inactive'});await p.ready();
  await p.ops.updateDuty(duty.id,{status:'Inactive'});await p.ready();await p.ops.updateDuty(duty.id,{...duty,status:'Inactive'});await p.ready();assert.deepEqual(revisions,[1,1,1,1]);p.runner.unmount();
});
test('failed workforce/template writes preserve prior data and cannot return success',async()=>{const p=provider({persistWorkforce:async()=>{throw Error('offline');},persistTemplate:async()=>{throw Error('offline');}});await p.ready();const before=plain({staff:p.ops.staff,duties:p.ops.duties});await assert.rejects(p.ops.updateStaff('STAFF001',{status:'Inactive'}),/offline/);const result=await p.ops.updateDuty('fixture-ward-round',{status:'Inactive'});await p.ready();assert.equal(result.ok,false);assert.equal(result.code,'SAVE_FAILED');assert.match(result.message,/offline/);assert.deepEqual(plain({staff:p.ops.staff,duties:p.ops.duties}),before);assert.equal(p.ops.planningSaving,false);p.runner.unmount();});
test('logout/switch hides previous administrative state and invalidates late save',async()=>{
  const pending=deferred(),p=provider({persistWorkforce:()=>pending.promise});await p.ready();const key=p.ops.sessionKey;const save=p.ops.updateStaff('STAFF001',{status:'Inactive'});const rejected=assert.rejects(save,/Session changed/);
  p.identity({status:'loading',user:null});assert.equal(p.ops.staff.length,0);assert.equal(p.ops.duties.length,0);await p.ready();p.identity({status:'signedIn',user:{uid:'other'}});assert.equal(p.ops.staff.length,0);await p.ready();assert.notEqual(p.ops.sessionKey,key);pending.resolve({...staff(),active:false,revision:2});await rejected;await p.ready();assert.equal(p.ops.staff[0].status,'Active');p.runner.unmount();
});
test('old-session template response and unmounted save cannot repopulate planning data',async()=>{
  const read=deferred(),p=provider({loadTemplates:()=>read.promise});await p.ready();p.identity({status:'signedOut',user:null});await p.ready();read.resolve([templateLib.mapTemplate('old',TEMPLATES[0])]);await p.ready();assert.equal(p.ops.duties.length,0);p.runner.unmount();
  const write=deferred(),q=provider({persistWorkforce:()=>write.promise});await q.ready();const saved=q.ops.updateStaff('STAFF001',{status:'Inactive'}),rejected=assert.rejects(saved,/Session changed/);q.runner.unmount();write.resolve({...staff(),active:false,revision:2});await rejected;
});
test('Firestore mode cannot pretend to add a staff account',async()=>{const p=provider();await p.ready();assert.throws(()=>p.ops.addStaff({name:'fake'}),/administrator provisioning/);assert.equal(p.ops.staff.length,1);p.runner.unmount();});
const nodes=tree=>Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];
const text=tree=>tree==null||typeof tree==='boolean'?'':Array.isArray(tree)?tree.map(text).join(''):typeof tree==='object'?text(tree.props?.children):String(tree);
function screenHarness(name,props={},ops={}){const{react,Runner,element}=hooks();const Screen=loader({react,'react/jsx-runtime':{jsx:element,jsxs:element},'./Icons':{Icon:'Icon'},'./useModalFocus':{useModalFocus(){}},'./OpsProvider':{useOps:()=>ops}})(`web-app/components/ManagementScreens.tsx`)[name];const runner=new Runner(()=>Screen(props));runner.render();return runner;}
for(const form of ['StaffForm','DutyForm'])test(`${form} shows saving and visible failed write; retains edited values`,async()=>{
  const pending=deferred(),props={locations:[{id:'parvo',name:'Parvo Ward'}],onSave:()=>pending.promise,...(form==='StaffForm'?{person:mappings.mapWorkforce('member',staff()),integrated:true}:{duty:templateLib.mapTemplate('template-1',TEMPLATES[0])})};const runner=screenHarness(form,props);
  const valueBefore=nodes(runner.value).filter(n=>n.type==='input').map(n=>n.props.value);const request=runner.value.props.onSubmit({preventDefault(){}});await runner.settle();assert(text(runner.value).includes('Saving'));assert(nodes(runner.value).some(n=>n.type==='button'&&n.props.disabled));pending.reject(Error('Server refused save'));await request;await runner.settle();const notices=nodes(runner.value).filter(n=>n.props.role==='alert'||n.type?.name==='Notice');assert(notices.some(n=>text(n).includes('Server refused save')||n.props.text==='Server refused save'));assert.deepEqual(nodes(runner.value).filter(n=>n.type==='input').map(n=>n.props.value),valueBefore);runner.unmount();
});
test('Johannesburg date inputs use explicit UTC+02 and roundtrip independently of host timezone',()=>{const lib=loader()('web-app/components/ManagementScreens.tsx');assert.equal(lib.utcAvailabilityTime('2026-10-05T08:30'),'2026-10-05T06:30:00.000Z');assert.equal(lib.localAvailabilityTime('2026-10-05T06:30:00.000Z'),'2026-10-05T08:30');});
test('template read adapter uses only the administrative server read and validates fields',async()=>{
  const sdk={collection:(_db,name)=>{assert.equal(name,'dutyTemplates');return name;},getDocsFromServer:async()=>({docs:[{id:'fixed',data:()=>TEMPLATES[0]}]})};const lib=loader({'firebase/firestore':sdk,'../firebase':{getFirebaseDb:()=>({})}})('web-app/lib/planning/templates.ts');assert.equal((await lib.loadTemplates())[0].id,'fixed');assert.throws(()=>lib.mapTemplate('bad',{...TEMPLATES[0],requiredSkills:undefined}));
});
test('HTTP boundary rejects oversized/bad JSON and exposes failure without success',async()=>{const route=loader()('web-app/lib/server/planningRoute.ts');const s=store();for(const [body,status] of [['{',400],['x'.repeat(32001),413]]){const response=await route.planningResponse(new Request('http://localhost',{method:'POST',body}),server.writeTemplate,()=>s);assert.equal(response.status,status);}const response=await route.planningResponse(new Request('http://localhost',{method:'POST',headers:{Authorization:'Bearer admin'},body:JSON.stringify(templateInput())}),async()=>{throw Error('offline');},()=>s);assert.equal(response.status,500);assert.match((await response.json()).error,/failed/);});
