// Exercises actual integrated TSX handlers with the WS1 deterministic hook driver.
// All Auth/Firestore boundaries are mocked: no network or persisted writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const driverSource = fs.readFileSync(path.join(__dirname, 'probe-ws1-locations.cjs'), 'utf8');
const boundary = driverSource.indexOf('async function main()');
assert(boundary > 0);
const driver = {};
vm.runInNewContext(driverSource.slice(0, boundary).replace('exports, crypto: globalThis.crypto,', 'exports, Error, process: fixtureProcess, crypto: globalThis.crypto,') + '\ndriver.load = load; driver.Runner = Runner; driver.nodes = nodes;', {
  driver, require, __dirname, globalThis, setImmediate, Error,
  fixtureProcess: { env: Object.fromEntries(['API_KEY','AUTH_DOMAIN','PROJECT_ID','STORAGE_BUCKET','MESSAGING_SENDER_ID','APP_ID'].map(key => ['EXPO_PUBLIC_FIREBASE_' + key, 'probe-' + key])) },
});
const { load, Runner, nodes } = driver;

const native = {
  ActivityIndicator: 'ActivityIndicator', Alert: { alert() {} }, BackHandler: { addEventListener: () => ({ remove() {} }) },
  KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: 'Modal', Platform: { OS: 'android' },
  Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View',
  useWindowDimensions: () => ({ height: 820, width: 390 }), StyleSheet: { create: value => value },
};
const demoTasks = load('mobile-app/data/demoTasks.ts', {}).initialDemoShifts;
const profile = load('mobile-app/data/demoStaffProfile.ts', {}).demoStaffProfile;
const sharedLocation = { locationName: id => id === 'ward-old' ? 'Retired Ward Name' : id, error: null, retry() {} };
const baseMocks = {
  'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' },
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', SafeAreaProvider: 'SafeAreaProvider' },
  '../theme': { colors: {} }, '../lib/useLocations': { useLocations: () => sharedLocation },
  '../data/demoLocations': load('mobile-app/data/demoLocations.ts', {}),
  '../data/demoEmployees': load('mobile-app/data/demoEmployees.ts', {}),
  '../lib/taskProgress': { saveTaskProgress: async (_task,status,reason) => ({status,...(reason?{unableToCompleteReason:reason}:{})}), progressErrorMessage: () => 'Could not save task progress. Refresh the roster.' },
  './StaffHomeScreen': { BottomNavigation: 'BottomNavigation' }, './StaffAppHeader': { StaffAppHeader: 'StaffAppHeader' },
};
const tick = () => new Promise(resolve => setImmediate(resolve));
const rawNodes = tree => Array.isArray(tree) ? tree.flatMap(rawNodes) : tree && typeof tree === 'object' ? [tree, ...rawNodes(tree.props?.children)] : [];
const control = (tree, label) => {
  const found = nodes(tree).find(node => node.props?.accessibilityLabel === label);
  assert(found, `Missing actual UI control: ${label}`);
  return found.props;
};

async function taskProbe(action, initialStatus, nextStatus) {
  let attempts = 0, resolveWrite, rejectWrite, payload;
  const callbacks = [];
  const task = { ...demoTasks[1], id: 'live-owned-shift', locationId: 'ward-old', isLive: true, status: initialStatus };
  const Screen = load('mobile-app/components/StaffTaskDetailScreen.tsx', {
    ...baseMocks, '../lib/taskProgress': {
      progressErrorMessage: () => 'Could not save task progress. Refresh the roster.',
      saveTaskProgress: (currentTask,status,reason) => {
        assert.equal(currentTask.id,task.id); assert.equal(callbacks.length,0);
        attempts++; payload={status,...(reason?{unableToCompleteReason:reason}:{})};
        return new Promise((resolve,reject)=>{resolveWrite=()=>resolve(payload);rejectWrite=reject;});
      },
    },
  }).StaffTaskDetailScreen;
  const props = {
    task, onStartTask: id => callbacks.push(['Start', id]), onMarkComplete: id => callbacks.push(['Complete', id]),
    onReopenTask: id => callbacks.push(['Reopen', id]), onMarkUnableToComplete: (id, reason) => callbacks.push(['Unable', id, reason]),
  };
  const runner = new Runner(() => Screen(props));
  runner.render(); await runner.settle();
  assert(nodes(runner.value).includes('Retired Ward Name'));
  if (action === 'Unable') {
    control(runner.value, 'Unable to complete reason').onChangeText('   '); runner.render();
    await control(runner.value, 'Submit unable to complete reason').onPress();
    assert.equal(attempts, 0); assert(nodes(runner.render()).includes('Enter a reason before submitting.'));
    control(runner.value, 'Unable to complete reason').onChangeText('  equipment unavailable  '); runner.render();
  }
  const label = { Start: 'Start task', Complete: 'Confirm task completion', Unable: 'Submit unable to complete reason', Reopen: 'Confirm reopen task' }[action];
  const handler = control(runner.value, label).onPress;
  const first = handler(); const duplicate = handler();
  assert.equal(attempts, 1, `${action}: two synchronous calls must cause one persistence attempt`);
  assert.equal(payload.status, nextStatus); assert.equal(callbacks.length, 0);
  if (action === 'Unable') assert.equal(payload.unableToCompleteReason, 'equipment unavailable');
  // Reject persistence, confirm the UI and parent state have no false success.
  rejectWrite(new Error('permission-denied from probe'));
  await Promise.all([first, duplicate]); await runner.settle();
  assert.equal(callbacks.length, 0);
  assert(nodes(runner.value).includes('Could not save task progress. Refresh the roster.'));
  assert(!nodes(runner.value).includes('permission-denied from probe'));
  assert.equal(rawNodes(runner.value).find(node => node.props?.status)?.props.status, initialStatus);
  // The finally block must have released the lock, allowing retry after rejection.
  if (action === 'Unable') {
    control(runner.value, 'Unable to complete reason').onChangeText('equipment unavailable'); runner.render();
  }
  const retry = control(runner.value, label).onPress();
  assert.equal(attempts, 2); resolveWrite(); await retry; await runner.settle();
  assert.equal(callbacks.length, 1); assert.equal(callbacks[0][0], action);
  assert.equal(rawNodes(runner.value).find(node => node.props?.status)?.props.status, nextStatus);
  runner.unmount();
  console.log(`PASS ${action}: duplicate calls=1 write; rejection=0 local successes; retry=1 success; lock released.`);
}

async function fixtureAndGates() {
  for (const mode of ['fixture', 'signedOut', 'unconfigured']) {
    let writes = 0, successes = 0;
    const task = { ...demoTasks[2], status: 'Scheduled', isLive: mode !== 'fixture' };
    const Screen = load('mobile-app/components/StaffTaskDetailScreen.tsx', {
      ...baseMocks,
      '../lib/taskProgress': { progressErrorMessage: () => 'Refresh the roster.', saveTaskProgress: async (_task,status) => { if(mode!=='fixture') throw Error('blocked'); return {status}; } },
      'firebase/firestore': { updateDoc: () => { writes++; }, getDoc: async () => ({ exists: () => false }), doc: () => ({}) },
      '../lib/firebase': { FIREBASE_CONFIGURED: mode !== 'unconfigured', db: mode === 'unconfigured' ? null : {}, auth: { currentUser: mode === 'signedOut' ? null : { uid: 'real-auth-uid' } } },
    }).StaffTaskDetailScreen;
    const runner = new Runner(() => Screen({ task, onStartTask: () => successes++ }));
    runner.render(); await runner.settle(); control(runner.value, 'Start task').onPress(); await runner.settle();
    assert.equal(writes, 0); assert.equal(successes, mode === 'fixture' ? 1 : 0);
    runner.unmount(); console.log(`PASS ${mode}: 0 Firestore writes; ${successes} local successes.`);
  }
}

function matcherProbe() {
  const data = load('mobile-app/data/demoRoster.ts', {});
  const module = load('mobile-app/components/StaffWeeklyRosterScreen.tsx', {
    ...baseMocks, '../data/demoRoster': data,
  }, '\nexports.matcher = rosterIdentityMatch;');
  const duty = data.demoRosterWeeks[0].days[4].duties[0];
  const task = demoTasks[0];
  assert(module.matcher(duty, task), 'neither ID uses fixture tuple');
  assert(!module.matcher({ ...duty, title: 'other' }, task), 'tuple difference must not match');
  assert(!module.matcher({ ...duty, scheduledWorkId: 'a' }, task), 'duty-only ID');
  assert(!module.matcher(duty, { ...task, scheduledWorkId: 'a' }), 'task-only ID');
  assert(!module.matcher({ ...duty, scheduledWorkId: 'a' }, { ...task, scheduledWorkId: 'b' }), 'different IDs');
  assert(module.matcher({ ...duty, title: 'different', scheduledWorkId: 'a' }, { ...task, scheduledWorkId: 'a' }), 'same IDs override tuple');
  const historical = { ...data.demoRosterWeeks[0], days: [{ ...data.demoRosterWeeks[0].days[0], duties: [{ ...duty, locationId: 'ward-old' }] }] };
  const Roster = load('mobile-app/components/StaffWeeklyRosterScreen.tsx', { ...baseMocks, '../data/demoRoster': { demoRosterWeeks: [historical] } }).StaffWeeklyRosterScreen;
  const runner = new Runner(() => Roster({ initialView: 'week', tasks: demoTasks, profile }));
  assert(nodes(runner.render()).includes('Retired Ward Name')); runner.unmount();
  console.log('PASS matcher: neither=tuple fallback; either one-sided=false; different=false; same=true. Roster retired name resolved.');
}

function firebaseProbe() {
  let appCount = 0, authCount = 0, storageCount = 0;
  const app = {}, auth = { currentUser: null }, db = {};
  const firebase = load('mobile-app/lib/firebase.ts', {
    'firebase/app': { getApps: () => appCount ? [app] : [], getApp: () => app, initializeApp: () => { appCount++; return app; } },
    'firebase/auth': { initializeAuth: actualApp => { assert.equal(actualApp, app); authCount++; return auth; }, getReactNativePersistence: () => { storageCount++; return {}; } },
    'firebase/firestore': { getFirestore: actualApp => { assert.equal(actualApp, app); return db; } },
    '@react-native-async-storage/async-storage': {},
  });
  assert.equal(firebase.auth, firebase.getFirebaseAuth()); assert.equal(firebase.db, firebase.getFirebaseDb());
  assert.equal(appCount, 1); assert.equal(authCount, 1); assert.equal(storageCount, 1);
  console.log('PASS Firebase: one app, one persistent Auth initialization, shared WS1/WS3 handles.');
}

async function authProbe() {
  let listener, unsubscribe = false, signOuts = 0, login, systemRole = 'Staff Member';
  const reads = [], auth = { currentUser: null }, db = {};
  const emit = async user => { auth.currentUser = user; await listener(user); };
  const identity = load('mobile-app/lib/authIdentity.ts', {});
  const roles = load('mobile-app/lib/roles.ts', {});
  const Provider = load('mobile-app/components/AuthProvider.tsx', {
    '../lib/firebase': { isFirebaseConfigured: () => true, getFirebaseAuth: () => auth, getFirebaseDb: () => db },
    '../lib/authIdentity': identity, '../lib/roles': roles,
    'firebase/auth': {
      onAuthStateChanged: (actualAuth, callback) => { assert.equal(actualAuth, auth); listener = callback; return () => { unsubscribe = true; }; },
      signInWithEmailAndPassword: async (...args) => { login = args; },
      signOut: async actualAuth => { assert.equal(actualAuth, auth); signOuts++; await emit(null); },
    },
    'firebase/firestore': {
      doc: (actualDb, collection, id) => { assert.equal(actualDb, db); return { collection, id }; },
      getDoc: async reference => {
        reads.push(reference);
        return { id: reference.id, exists: () => true, data: () => reference.collection === 'employees' ? {
          employeeId: 'EMP-008', firstName: 'Real', surname: 'Employee', roleId: 'role-real',
        } : { name: systemRole } };
      },
    },
  }).AuthProvider;
  const runner = new Runner(() => Provider({ children: 'staff-screen' }));
  runner.render(); assert.equal(runner.value.props.value.status, 'loading');
  await emit({ uid: 'restored-real-uid' }); await runner.settle();
  let value = runner.value.props.value;
  assert.equal(value.status, 'signedIn'); assert.equal(value.employee.id, 'restored-real-uid');
  assert.equal(value.employee.employeeId, 'EMP-008'); assert.equal(value.role.name, 'Staff Member');
  assert.equal(reads[0].collection, 'employees'); assert.equal(reads[0].id, 'restored-real-uid');
  await value.signIn('  EMP 008!  ', 'password-fixture');
  assert.equal(login[0], auth); assert.equal(login[1], 'emp-008@saidops.internal'); assert.equal(login[2], 'password-fixture');
  await value.signOut(); await runner.settle(); assert.equal(runner.value.props.value.status, 'signedOut');
  systemRole = 'Supervisor/Administrator';
  await emit({ uid: 'supervisor-uid' }); await runner.settle();
  assert.equal(runner.value.props.value.status, 'signedOut'); assert.equal(signOuts, 2);
  assert(runner.value.props.value.accessError.includes('web app'));
  runner.unmount(); assert(unsubscribe);
  const appSource = fs.readFileSync(path.join(__dirname, '../SAID Ops/mobile-app/App.tsx'), 'utf8');
  assert.equal((appSource.match(/<AuthProvider>/g) || []).length, 1);
  assert(appSource.includes("if (status !== 'signedIn') return <LoginScreen />;"));
  for (const screen of ['StaffHomeScreen','StaffWeeklyRosterScreen','StaffTaskDetailScreen']) assert(appSource.includes('<' + screen));
  const homeSource = fs.readFileSync(path.join(__dirname, '../SAID Ops/mobile-app/components/StaffHomeScreen.tsx'), 'utf8');
  assert(homeSource.includes('const USE_LIVE_HOME_FIRESTORE = false;')); assert(!homeSource.includes('DEMO_EMPLOYEE_ID'));
  assert(!/updateDoc|setDoc|writeBatch/.test(appSource));
  for (const file of ['StaffEditProfileScreen.tsx','StaffProfileScreen.tsx']) {
    const source = fs.readFileSync(path.join(__dirname, '../SAID Ops/mobile-app/components/', file), 'utf8');
    assert(!/updateDoc|setDoc|writeBatch/.test(source)); assert(source.includes('session only'));
  }
  console.log('PASS Auth/profile: restored UID profile, business Employee ID, normalized alias, staff role, logout, supervisor rejection, one App provider, WS3 staff routes, fixture gate, no employee writes.');
}

async function main() {
  for (const args of [['Start','Scheduled','In Progress'], ['Complete','In Progress','Completed'], ['Unable','In Progress','Unable to Complete'], ['Reopen','Completed','In Progress']]) await taskProbe(...args);
  await fixtureAndGates(); matcherProbe(); firebaseProbe(); await authProbe();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
