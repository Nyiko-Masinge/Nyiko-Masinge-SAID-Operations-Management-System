// Actual Add Roster Item controls -> form submission -> certified scheduling/publication.
const test = require('node:test');
const assert = require('node:assert/strict');
const {loader,hooks,plain} = require('../../../scripts/stage6b-test-support.cjs');
const date = '2026-10-19';
const locations = [{id:'ward-b',name:'Ward B',active:true},{id:'parvo',name:'Parvo Ward',active:true}];
const templates = [
  {id:'ward-round',name:'General Ward AM Round',description:'Morning ward checks and care',time:'08:30',duration:'90 min',area:'Ward B',locationId:'ward-b',required:1,priority:'Medium',isCritical:false,status:'Active',recurrence:'Daily',requirements:[]},
  {id:'critical-care',name:'Critical care check',description:'Check critical care equipment',time:'11:00',duration:'30 min',area:'Parvo Ward',locationId:'parvo',required:2,priority:'Low',isCritical:true,status:'Active',recurrence:'Daily',requirements:[]},
];
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree,...nodes(tree.props?.children)] : [];
function editor({work}={}) {
  const {react,Runner,element}=hooks(),load=loader({react,'react/jsx-runtime':{jsx:element,jsxs:element},'./Icons':{Icon:'Icon'},'./useModalFocus':{useModalFocus(){}}});
  const {RosterEditor}=load('web-app/components/RosterEditor.tsx');
  const {createScheduledWork,editScheduledWork}=load('web-app/lib/roster/operations.ts');
  let saved, failure;
  const runner=new Runner(()=>RosterEditor({date,templates,locations,allLocations:locations,work,onClose(){},onSave(input){
    const result=work?editScheduledWork(work.id,input,[work],templates):createScheduledWork('e2e-occurrence',input,[],templates);
    if(!result.ok){failure=result.code;return result.code;}saved=result.scheduled[0];
  }}));
  runner.render();
  const field=name=>{const node=nodes(runner.value).find(item=>item.props?.name===name);assert(node,`Missing ${name}`);return node.props;};
  const change=(name,value)=>{const input=field(name);assert(!input.readOnly&&!input.disabled,`${name} must be editable`);input.onChange({target:{value}});runner.render();};
  function submit() {
    // Node has no DOM form. Capture the actual current named, enabled controls just as
    // browser FormData does; keep exercising the component's real submit handler.
    const entries=nodes(runner.value).filter(item=>['input','select'].includes(item.type)&&item.props.name&&!item.props.disabled).map(item=>[item.props.name,String(item.props.value)]);
    const NativeFormData=globalThis.FormData;
    globalThis.FormData=class {constructor(){this.values=new Map(entries);}get(name){return this.values.get(name)??null;}};
    try{nodes(runner.value).find(item=>item.type==='form').props.onSubmit({preventDefault(){},currentTarget:{}});}finally{globalThis.FormData=NativeFormData;}
    runner.render();return {saved,failure};
  }
  return {runner,field,change,submit,load};
}
test('A: selecting General Ward template prefills all occurrence defaults',()=>{
  const c=editor();c.change('dutyId','critical-care');c.change('dutyId','ward-round');
  for(const [name,value]of Object.entries({dutyId:'ward-round',title:templates[0].name,description:templates[0].description,date,startTime:'08:30',endTime:'10:00',locationId:'ward-b',required:1}))assert.equal(c.field(name).value,value);
  c.runner.unmount();
});
test('B-F: editable occurrence fields save independent values without mutating the template',()=>{
  const before=plain(templates),c=editor();
  const values={title:'E2E Test - Parvo Ward Round',description:'Specific Parvo care instructions',date:'2026-10-20',startTime:'09:15',endTime:'10:45',locationId:'parvo',required:'3'};
  for(const [name,value]of Object.entries(values))c.change(name,value);
  const {saved,failure}=c.submit();assert.equal(failure,undefined);
  assert.deepEqual(saved,{...values,required:3,area:'Parvo Ward',id:'e2e-occurrence',dutyId:'ward-round',staffIds:[],isCritical:false,priority:'Medium',requiredSkills:[],requirements:[]});
  assert.deepEqual(plain(templates),before);assert.equal(templates[0].name,'General Ward AM Round');assert.equal(templates[0].priority,'Medium');
  c.runner.unmount();
});
test('G: switching templates replaces prior edits with newly selected defaults',()=>{
  const c=editor();c.change('title','Old custom title');c.change('description','Old custom description');c.change('startTime','07:00');c.change('endTime','08:00');c.change('required','8');c.change('date','2026-10-21');
  c.change('dutyId','critical-care');
  for(const [name,value]of Object.entries({dutyId:'critical-care',title:templates[1].name,description:templates[1].description,startTime:'11:00',endTime:'11:30',locationId:'parvo',required:2,date:'2026-10-21'}))assert.equal(c.field(name).value,value);
  const {saved}=c.submit();assert.equal(saved.isCritical,true);assert.equal(saved.dutyId,'critical-care');assert.equal(templates[1].priority,'Low');c.runner.unmount();
});
test('H: template -> Ad Hoc -> template clears source-specific values and restores defaults',()=>{
  const c=editor();c.change('dutyId','critical-care');c.change('title','Discard on source switch');c.change('source','adhoc');
  for(const [name,value]of Object.entries({title:'',description:'',startTime:'08:00',endTime:'09:00',locationId:'ward-b',required:1,date}))assert.equal(c.field(name).value,value);
  assert(!nodes(c.runner.value).some(item=>item.props?.name==='dutyId'));
  c.change('title','Manual operational work');c.change('description','Manual instructions');c.change('locationId','parvo');c.change('required','4');
  const {saved}=c.submit();assert.equal(saved.dutyId,undefined);assert.equal(saved.title,'Manual operational work');assert.equal(saved.description,'Manual instructions');assert.equal(saved.area,'Parvo Ward');assert.equal(saved.required,4);assert.equal(saved.isCritical,false);
  c.change('source','template');assert.equal(c.field('dutyId').value,'ward-round');assert.equal(c.field('title').value,templates[0].name);assert.equal(c.field('required').value,1);c.runner.unmount();
});
test('edited occurrence snapshot survives later template edits and is what publication contains',()=>{
  const c=editor();c.change('title','E2E Test - Parvo Ward Round');c.change('description','Occurrence instructions');const {saved}=c.submit();const before=plain(saved);
  const changed=templates.map(t=>({...t,name:'Later template name',description:'Later template description',time:'13:00',required:8,isCritical:true}));
  const {publishRoster}=c.load('web-app/lib/roster/publication.ts');const publication=publishRoster(date,[saved],changed,{},true);
  assert.equal(publication.status,'published');assert.deepEqual(plain(publication.snapshot.scheduledWork[0]),before);assert.deepEqual(plain(saved),before);c.runner.unmount();
});
for(const [name,value,code]of [['title','  ','TITLE_REQUIRED'],['date','2026-02-30','INVALID_DATE'],['endTime','07:00','INVALID_INTERVAL'],['required','0','INVALID_REQUIRED'],['required','1.5','INVALID_REQUIRED']])test(`template occurrence retains ${code} validation`,()=>{
  const c=editor();c.change(name,value);const result=c.submit();assert.equal(result.saved,undefined);assert.equal(result.failure,code);assert.equal(c.field(name).value,name==='required'?Number(value):value);c.runner.unmount();
});
test('existing template-backed Edit Roster Item keeps certified title/description controls',()=>{
  const work={id:'existing',dutyId:'ward-round',title:'Saved occurrence title',description:'Saved occurrence description',date,startTime:'08:30',endTime:'10:00',area:'Ward B',locationId:'ward-b',required:1,staffIds:[],isCritical:false};
  const c=editor({work});assert.equal(c.field('title').readOnly,true);assert.equal(c.field('description').readOnly,true);assert.equal(c.field('title').value,work.title);c.runner.unmount();
});
