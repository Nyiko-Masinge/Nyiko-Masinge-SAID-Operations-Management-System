const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, hooks, deferred } = require('./stage6b-test-support.cjs');

const native = {
  View:'View', Text:'Text', Pressable:'Pressable', ScrollView:'ScrollView', Modal:'Modal',
  KeyboardAvoidingView:'KeyboardAvoidingView', TextInput:'TextInput', ActivityIndicator:'ActivityIndicator',
  Platform:{OS:'android'}, StyleSheet:{create:value=>value}, Alert:{alert(){}},
  BackHandler:{addEventListener:()=>({remove(){}})}, useWindowDimensions:()=>({width:390,height:844}),
};
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree,...nodes(tree.props?.children)] : [];

function setup({published=true,status='Scheduled',startedAt}={}) {
  const {react,Runner,element} = hooks();
  const baseLoad = loader();
  const task = {
    ...baseLoad('mobile-app/data/demoTasks.ts').initialDemoShifts[1],
    id:'status-display-work', scheduledWorkId:published?'status-display-work':undefined, shiftDate:'2026-10-23',
    weekStart:'2026-10-19', publicationVersion:published?'v1':undefined,
    status, startedAt, checklist:[], team:[],
  };
  const publication = {state:{status:'DATA',owner:'staff-uid:2026-10-19',version:'v1',tasks:[task]},retry(){}};
  const pending = [], writes = [];
  const authState = {status:'signedIn',user:{uid:'staff-uid'},employee:{id:'staff-uid',employeeId:'STAFF001',firstName:'Test',surname:'Staff'},role:{name:'Staff'},signOut(){}};
  const auth = {useAuth:()=>authState,AuthProvider:'AuthProvider'};
  const load = loader({
    react, 'react/jsx-runtime':{jsx:element,jsxs:element}, 'react-native':native,
    '@expo/vector-icons':{Ionicons:'Icon'}, 'expo-status-bar':{StatusBar:'StatusBar'},
    'react-native-safe-area-context':{SafeAreaView:'SafeAreaView',SafeAreaProvider:'SafeAreaProvider'},
    './components/AuthProvider':auth, './AuthProvider':auth,
    '../lib/firebase':{db:null,FIREBASE_CONFIGURED:false},
    '../lib/useLocations':{useLocations:()=>({locationName:()=> 'Parvo',error:null,retry(){}})},
    './StaffAppHeader':{StaffAppHeader:'StaffAppHeader'},
    './components/TerminalField':{TerminalField:'TerminalField'},
    './components/StaffAlertsScreen':{StaffAlertsScreen:'StaffAlertsScreen'},
    './components/AlertDetailSheet':{AlertDetailSheet:'AlertDetailSheet'},
    './components/NotificationTray':{NotificationTray:'NotificationTray'},
    './components/StaffProfileScreen':{StaffProfileScreen:'StaffProfileScreen'},
    './components/StaffEditProfileScreen':{StaffEditProfileScreen:'StaffEditProfileScreen'},
    './components/SaidLogo':{SaidLogo:'SaidLogo'},
    './components/NotificationProvider':{NotificationsProvider:'NotificationsProvider',useNotifications:()=>({alerts:[],markRead(){},markAllRead(){}})},
    './lib/usePublishedRoster':{usePublishedRoster:()=>publication},
    './lib/publishedRoster':{firestoreRosterEnabled:published,weekFor:()=>task.weekStart},
    '../lib/taskProgress':{
      progressErrorMessage:()=> 'Could not save task progress. Refresh the roster.',
      saveTaskProgress:(current,next,reason)=>{writes.push({current,next,reason});const d=deferred();pending.push(d);return d.promise;},
    },
  });
  function expand(tree) {
    if (tree == null || typeof tree === 'boolean') return [];
    if (Array.isArray(tree)) return tree.flatMap(expand);
    if (typeof tree !== 'object') return [tree];
    if (tree.type==='Modal' && !tree.props.visible) return [];
    if (typeof tree.type==='function') {
      const child = new Runner(()=>tree.type(tree.props)); child.render();
      const result=expand(child.value); child.unmount(); return result;
    }
    return [tree,...expand(tree.props?.children)];
  }
  const App = load('mobile-app/App.tsx').default;
  const sessionNode = nodes(App()).find(n=>n.type?.name==='StaffSession');
  const session = new Runner(()=>sessionNode.type(sessionNode.props)); session.render();
  const contentNode = nodes(session.value).find(n=>n.type?.name==='AppContent');
  const app = new Runner(()=>contentNode.type(contentNode.props));
  const screen = name => nodes(app.value).find(n=>n.type?.name===name);
  const renderScreen = name => {const n=screen(name);assert(n,name);const runner=new Runner(()=>n.type(n.props));runner.render();return runner;};
  const visible = runner => expand(runner.value);
  const labels = runner => visible(runner).filter(n=>typeof n==='string');
  const control = (runner,label) => {const n=visible(runner).find(n=>n.props?.accessibilityLabel===label);assert(n,label);return n.props;};
  app.render();
  return {task,app,session,screen,renderScreen,visible,labels,control,pending,writes,load,Runner};
}

test('restored Completed published task has no stale Not started label without a fixture timestamp',async()=>{
  const c=setup({status:'Completed'});await c.app.settle();
  c.screen('StaffHomeScreen').props.onOpenTaskDetail(c.task.id);await c.app.settle();
  const detail=c.renderScreen('StaffTaskDetailScreen');await detail.settle();
  assert(!c.labels(detail).includes('Not started'));
  assert(c.labels(detail).includes('Task completed'));
  assert(c.control(detail,'Reopen task'));
  detail.unmount();c.app.unmount();c.session.unmount();
});

test('confirmed Start, Complete, Unable and Reopen update every screen, while failure retains confirmed status',async()=>{
  const c=setup();await c.app.settle();
  c.screen('StaffHomeScreen').props.onOpenTaskDetail(c.task.id);await c.app.settle();
  let detailProps=c.screen('StaffTaskDetailScreen').props;
  const detail=new c.Runner(()=>c.screen('StaffTaskDetailScreen').type(detailProps));detail.render();await detail.settle();
  async function assertDisplays(status,label) {
    assert.equal(detailProps.task.status,status);
    const detailLabels=c.labels(detail);
    assert.equal(nodes(detail.value).filter(n=>n.type==='Text'&&n.props.children===label).length,2,'detail badge and former timestamp line agree');
    if(status!=='Scheduled')assert(!detailLabels.includes('Not started'));
    const tasks=[detailProps.task],profile=c.load('mobile-app/data/demoStaffProfile.ts').demoStaffProfile;
    for(const name of ['StaffHomeScreen','StaffWeeklyRosterScreen']) {
      const Screen=c.load(`mobile-app/components/${name}.tsx`)[name];
      const props={tasks,profile,initialView:'week',publicationState:{status:'DATA'},publication:{state:{status:'DATA'},weekStart:c.task.weekStart},onOpenTaskDetail(){}};
      const runner=new c.Runner(()=>Screen(props));runner.render();await runner.settle();
      assert(c.labels(runner).includes(label),`${name}: ${label}`);
      assert(c.visible(runner).some(n=>n.type==='Pressable'&&n.props.accessibilityLabel?.startsWith(`${c.task.title}, ${label}`)),`${name}: accessible status`);
      if(status!=='Scheduled')assert(!c.labels(runner).includes('Not started'));
      if(status==='Unable to Complete')assert(c.labels(runner).includes('Equipment missing'));
      runner.unmount();
    }
  }
  await assertDisplays('Scheduled','Not started');
  for(const [label,status,display] of [
    ['Start task','In Progress','In progress'],['Confirm task completion','Completed','Completed'],
    ['Confirm reopen task','In Progress','In progress'],['Submit unable to complete reason','Unable to Complete','Unable to complete'],
    ['Confirm reopen task','In Progress','In progress'],
  ]) {
    if(status==='Unable to Complete'){c.control(detail,'Mark task unable to complete').onPress();await detail.settle();c.control(detail,'Unable to complete reason').onChangeText(' Equipment missing ');await detail.settle();}
    if(label==='Confirm task completion'){c.control(detail,'Mark task complete').onPress();await detail.settle();}
    if(label==='Confirm reopen task'){c.control(detail,'Reopen task').onPress();await detail.settle();}
    const previous=detailProps.task.status;
    const handler=c.control(detail,label).onPress;
    const writesBefore=c.writes.length;
    const save=handler(), duplicate=handler();
    assert.equal(c.writes.length,writesBefore+1,'duplicate blocked synchronously');
    assert.equal(c.writes.at(-1).current.status,previous);
    const count=c.writes.length;
    assert.equal(c.pending.length,count);
    c.pending.at(-1).reject(Error('offline'));await Promise.all([save,duplicate]);await detail.settle();await c.app.settle();
    assert.equal(c.writes.length,count,'duplicate blocked synchronously');
    assert.equal(c.screen('StaffTaskDetailScreen').props.task.status,previous);
    assert(c.labels(detail).includes('Could not save task progress. Refresh the roster.'));
    await assertDisplays(previous,{'Scheduled':'Not started','In Progress':'In progress','Completed':'Completed','Unable to Complete':'Unable to complete'}[previous]);
    if(status==='Unable to Complete'){c.control(detail,'Mark task unable to complete').onPress();await detail.settle();c.control(detail,'Unable to complete reason').onChangeText('Equipment missing');await detail.settle();}
    if(label==='Confirm task completion'){c.control(detail,'Mark task complete').onPress();await detail.settle();}
    if(label==='Confirm reopen task'){c.control(detail,'Reopen task').onPress();await detail.settle();}
    const retry=c.control(detail,label).onPress();
    c.pending.at(-1).resolve({status,unableToCompleteReason:status==='Unable to Complete'?'Equipment missing':detailProps.task.unableToCompleteReason});
    await retry;await detail.settle();await c.app.settle();
    detailProps=c.screen('StaffTaskDetailScreen').props;detail.render();await detail.settle();
    await assertDisplays(status,display);
    if(label==='Start task') {
      c.control(detail,'Pause task').onPress();await detail.settle();await assertDisplays(status,display);
      assert(!c.labels(detail).includes('Paused'),'local pause does not replace confirmed published progress');
      c.control(detail,'Resume task').onPress();await detail.settle();
    }
  }
  detail.unmount();c.app.unmount();c.session.unmount();
});

test('fixture status chips, pause feedback and started-at presentation remain unchanged',async()=>{
  const c=setup({published:false});
  const profile=c.load('mobile-app/data/demoStaffProfile.ts').demoStaffProfile;
  for(const status of ['Scheduled','In Progress','Completed','Unable to Complete']) {
    const task={...c.task,status,startedAt:status==='Scheduled'?undefined:'09:05'};
    for(const name of ['StaffHomeScreen','StaffWeeklyRosterScreen','StaffTaskDetailScreen']) {
      const Screen=c.load(`mobile-app/components/${name}.tsx`)[name];
      const runner=new c.Runner(()=>Screen({task,tasks:[task],profile,initialView:'week'}));runner.render();await runner.settle();
      assert(c.labels(runner).includes(status),`${name}: fixture ${status}`);
      if(name!=='StaffTaskDetailScreen')assert(c.visible(runner).some(n=>n.type==='Pressable'&&n.props.accessibilityLabel?.startsWith(`${task.title}, ${status}`)),`${name}: fixture task status`);
      if(name==='StaffTaskDetailScreen') {
        assert(c.labels(runner).includes(status==='Scheduled'?'Not started':'Started at 09:05'));
        if(status==='In Progress'){c.control(runner,'Pause task').onPress();await runner.settle();assert(c.labels(runner).includes('Paused'));}
      }
      runner.unmount();
    }
  }
  c.app.unmount();c.session.unmount();
});
