const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, hooks } = require('../../../scripts/stage6b-test-support.cjs');
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '');
function staffScreen() {
  const { react, Runner, element } = hooks();
  const staff = [
    { id:'ADMIN001', employeeId:'ADMIN001', name:'Test Administrator', role:'Operations Supervisor', locationId:'', status:'Active', availability:'Available', workload:0, skills:[] },
    { id:'STAFF001', employeeId:'STAFF001', name:'Test Staff One', role:'Nurse', locationId:'parvo', status:'Active', availability:'Available', workload:0, skills:[] },
    { id:'STAFF002', employeeId:'STAFF002', name:'Test Staff Two', role:'Veterinary Assistant', locationId:'ward-b', status:'Active', availability:'Available', workload:0, skills:[] },
  ];
  const load = loader({react, 'react/jsx-runtime':{jsx:element,jsxs:element}, './Icons':{Icon:'Icon'}, './useModalFocus':{useModalFocus(){}}, './OpsProvider':{useOps:()=>({staff, locations:[], locationName:id=>id, updateStaff(){}, refreshLocations(){}})}});
  const { StaffScreen } = load('web-app/components/ManagementScreens.tsx');
  const runner = new Runner(()=>StaffScreen()); runner.render();
  const control = (type,predicate) => nodes(runner.value).find(n=>(n.type===type || n.type?.name===type) && predicate(n.props)).props;
  return {runner,control,rows:()=>nodes(runner.value).filter(n=>n.type==='tr'&&n.props.onClick).map(text)};
}
test('Employee ID search is trimmed, case-insensitive and includes real workforce IDs',()=>{
  const c=staffScreen(); c.control('input',p=>p['aria-label']==='Search staff').onChange({target:{value:' staff001 '}}); c.runner.render();
  assert.equal(c.rows().length,1); assert.match(c.rows()[0],/Test Staff OneSTAFF001/); c.runner.unmount();
});
test('role filter combines with search and Clear Filters restores all staff',()=>{
  const c=staffScreen();
  c.control('Select',p=>p.label==='Filter staff by role').onChange('Nurse'); c.runner.render();
  assert.equal(c.rows().length,1); assert.match(c.rows()[0],/STAFF001/);
  c.control('input',p=>p['aria-label']==='Search staff').onChange({target:{value:'Two'}}); c.runner.render(); assert.equal(c.rows().length,0);
  c.control('button',p=>text(p.children)==='Clear Filters').onClick(); c.runner.render(); assert.equal(c.rows().length,3); c.runner.unmount();
});
test('staff row keyboard selection shows the selected employee profile',()=>{
  const c=staffScreen(); const row=nodes(c.runner.value).find(n=>n.type==='tr'&&text(n).includes('STAFF001'));
  let prevented=false; const target={}; row.props.onKeyDown({key:'Enter',target,currentTarget:target,preventDefault(){prevented=true;}}); c.runner.render();
  assert(prevented); assert(nodes(c.runner.value).some(n=>n.type==='dd'&&text(n)==='STAFF001')); c.runner.unmount();
});
test('progress header labels its native date control, groups refresh, and preserves Monday-only selection',()=>{
  const {react,Runner,element}=hooks(); let selected, refreshes=0;
  const Dashboard=loader({react,'react/jsx-runtime':{jsx:element,jsxs:element},'next/link':'Link','./Icons':{Icon:'Icon'},'./AlertsHistory':{ALERT_ICON:{}},
    './MonitoringProvider':{useMonitoring:()=>({openAlerts:[],loading:false})},'./OpsProvider':{useOps:()=>({staff:[],scheduledWork:[],locations:[]})},
    '../lib/roster/backend':{firestoreRosterEnabled:true},'../lib/roster/useSupervisorProgress':{useSupervisorProgress:week=>{selected=week;return {state:{status:'EMPTY',rows:[]},refresh(){refreshes++;}};}}
  })('web-app/components/Dashboard.tsx').Dashboard;
  const runner=new Runner(()=>Dashboard());runner.render();
  const input=()=>nodes(runner.value).find(n=>n.type==='input'&&n.props.type==='date').props;
  const controls=nodes(runner.value).find(n=>n.props.className==='progress-controls');
  assert(nodes(controls).some(n=>n.type==='input'&&n.props.id===input().id));
  assert(nodes(controls).some(n=>n.type==='label'&&n.props.htmlFor===input().id&&text(n)==='Week starting'));
  assert(nodes(runner.value).some(n=>n.props.id===input()['aria-describedby']&&text(n)==='Select a Monday.'));
  const refresh=nodes(controls).find(n=>n.type==='button'&&text(n)==='Refresh progress');
  assert.equal(refresh.props.type,'button');refresh.props.onClick();assert.equal(refreshes,1);
  const helper=nodes(runner.value).find(n=>n.props.className==='progress-helper');
  assert(nodes(helper).some(n=>n.type==='strong'&&text(n)==='Current publication'));
  assert.match(text(helper),/One row per assigned staff member\./);
  assert.match(text(helper),/Refresh to retrieve the latest saved task progress\./);
  input().onInput({currentTarget:{value:'2026-10-05'}});runner.render();assert.equal(selected,'2026-10-05');
  input().onChange({target:{value:'2026-10-19'}});runner.render();assert.equal(selected,'2026-10-19');
  input().onInput({currentTarget:{value:'2026-10-20'}});runner.render();assert.equal(selected,'2026-10-19');
  input().onChange({target:{value:''}});runner.render();assert.equal(selected,'2026-10-19');runner.unmount();
});
