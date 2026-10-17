// Deterministic development-fixture probe. No network, Firebase writes, or extra packages.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..', 'SAID Ops');
const ts = require(path.join(root, 'web-app/node_modules/typescript'));
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/operational-areas.json'), 'utf8'));
const records = [...fixture,
  { id: 'ward-active', name: 'Active Ward', active: true },
  { id: 'ward-old', name: 'Old Ward', active: false },
];
let auth = { status: 'loading', user: null };
let reads = 0;
let fail = false;
let pendingRead = null;
const firestore = {
  collection: (_db, name) => ({ name }),
  orderBy: (field) => ({ field }),
  query: (collection, order) => ({ collection, order }),
  getDocs: async (query) => {
    reads++;
    assert.equal(query.collection.name, 'locations');
    assert.equal(query.order.field, 'name');
    if (pendingRead) await pendingRead;
    if (fail) throw new Error('simulated offline request');
    return { docs: records.map(record => ({ id: record.id, data: () => ({ ...record }) })) };
  },
};

// Small hook driver: state updates rerender, effects compare dependencies and run cleanup.
// This tests the actual provider/hook code without Firebase or native device dependencies.
let current;
const equalDeps = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const element = (type, props) => ({ type, props: props || {} });
const react = {
  createContext: () => ({ Provider: 'ContextProvider' }),
  useContext: () => { throw new Error('Unexpected context read'); },
  useState: initial => {
    const runner = current, i = runner.index++;
    if (!(i in runner.slots)) runner.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [runner.slots[i], value => {
      const next = typeof value === 'function' ? value(runner.slots[i]) : value;
      if (!Object.is(next, runner.slots[i])) { runner.slots[i] = next; runner.dirty = true; }
    }];
  },
  useRef: value => {
    const runner = current, i = runner.index++;
    return runner.slots[i] ||= { current: value };
  },
  useMemo: (fn, deps) => {
    const runner = current, i = runner.index++;
    if (!equalDeps(runner.slots[i]?.deps, deps)) runner.slots[i] = { deps, value: fn() };
    return runner.slots[i].value;
  },
  useCallback: (fn, deps) => react.useMemo(() => fn, deps),
  useEffect: (fn, deps) => {
    const runner = current, i = runner.index++;
    if (!equalDeps(runner.slots[i]?.deps, deps)) {
      const previous = runner.slots[i];
      runner.slots[i] = { deps, cleanup: previous?.cleanup };
      runner.effects.push(() => {
        previous?.cleanup?.();
        runner.slots[i].cleanup = fn();
      });
    }
  },
};
class Runner {
  constructor(fn) { this.fn = fn; this.slots = []; this.effects = []; }
  render() {
    this.index = 0; this.dirty = false; current = this;
    this.value = this.fn(); current = null;
    for (const effect of this.effects.splice(0)) effect();
    return this.value;
  }
  async settle() {
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setImmediate(resolve));
      if (!this.dirty) return this.value;
      this.render();
    }
    throw new Error('Repeated render/effect loop');
  }
  unmount() { for (const slot of this.slots) slot?.cleanup?.(); }
}
const rosterCache = new Map();
function loadRoster(name) {
  const file = name.startsWith('../planning/') ? '../planning/' + name.split('/').pop() : name.split('/').pop();
  if (rosterCache.has(file)) return rosterCache.get(file);
  const source = fs.readFileSync(path.join(root, 'web-app/lib/roster', file + '.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  rosterCache.set(file, exports);
  vm.runInNewContext(compiled, { exports, require: dependency => loadRoster(dependency) });
  return exports;
}
function load(relative, mocks, expose = '') {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled + expose, {
    exports, crypto: globalThis.crypto,
    require: name => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element };
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === '../lib/taskStatusDisplay') return load('mobile-app/lib/taskStatusDisplay.ts', {});
      if (name === '../lib/taskProgress') return {saveTaskProgress: () => {throw new Error('Location probe must not persist progress');}, progressErrorMessage: () => 'Refresh the roster.'};
      if (name === '../lib/publishedRoster') return {}; // Fixture weekly screen never invokes the integrated mapper.
      if (name === '../lib/roster/backend') return { firestoreRosterEnabled: false };
      if (name === '../lib/planning/templates') return { loadTemplates: () => { throw new Error('Fixture must not read templates'); } };
      if (name === '../lib/planning/client') return { persistWorkforce: () => { throw new Error('Fixture must not persist workforce'); }, persistTemplate: () => { throw new Error('Fixture must not persist templates'); } };
      if (name === '../lib/planning/model') return { availabilityStates: ['Available','On Duty','On Leave','Training','Unavailable'] };
      if (name === '../lib/roster/currentPublication') return { readCurrentRosterPublication: () => { throw new Error('Fixture must not hydrate publication'); } };
      if (name === '../lib/roster/workforce') return { loadWorkforce: () => { throw new Error('Fixture must not read workforce'); } };
      if (name === '../lib/roster/publishClient') return { persistPublication: () => { throw new Error('Fixture must not persist publication'); }, publicationPayload: () => { throw new Error('Fixture must not build publication'); } };
      if (relative.startsWith('web-app/') && name.startsWith('../lib/roster/')) return loadRoster(name);
      throw new Error(`Unmocked dependency: ${name}`);
    },
  }, { filename: relative });
  return exports;
}
function nodes(tree) {
  if (tree == null || typeof tree === 'boolean') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (typeof tree !== 'object') return [tree];
  if (typeof tree.type === 'function') {
    const runner = new Runner(() => tree.type(tree.props));
    const expanded = runner.render();
    runner.unmount();
    return nodes(expanded);
  }
  return [tree, ...nodes(tree.props.children)];
}
const authModule = { useAuth: () => auth };
async function main() {
  const libs = {};
  for (const app of ['web-app', 'mobile-app']) {
    libs[app] = load(`${app}/lib/locations.ts`, {
      'firebase/firestore': firestore, './firebase': { getFirebaseDb: () => ({}) },
    });
    const all = await libs[app].getAllLocations();
    const active = await libs[app].getActiveLocations();
    assert.equal(all.length, records.length);
    assert(active.some(l => l.id === 'parvo' && l.active === true));
    assert(active.some(l => l.id === 'ward-active'));
    assert(!active.some(l => l.id === 'ward-old'));
    assert.equal(all.find(l => l.id === 'ward-old').name, 'Old Ward');
  }

  const { OpsProvider } = load('web-app/components/OpsProvider.tsx', {
    '../lib/locations': libs['web-app'], './AuthProvider': authModule,
  });
  const provider = new Runner(() => OpsProvider({ children: null }));
  reads = 0;
  provider.render(); await provider.settle();
  await provider.value.props.value.refreshLocations();
  assert.equal(reads, 0, 'no protected read while auth restores');
  auth = { status: 'signedOut', user: null };
  provider.render(); await provider.settle();
  assert.equal(reads, 0, 'no protected read while signed out');
  auth = { status: 'signedIn', user: { uid: 'supervisor-demo' } };
  provider.render(); await provider.settle();
  assert.equal(reads, 1, 'automatic read after sign-in');
  let ops = provider.value.props.value;
  assert.equal(ops.locationName('ward-old'), 'Old Ward');
  assert(!ops.locations.some(l => l.id === 'ward-old'));
  provider.render(); await provider.settle();
  assert.equal(reads, 1, 'state rerender does not refetch');
  fail = true;
  await ops.refreshLocations(); await provider.settle();
  ops = provider.value.props.value;
  assert(ops.locationsError);
  assert.equal(ops.locationName('ward-old'), 'Old Ward', 'failed refresh retains historical data');
  fail = false;
  await ops.refreshLocations(); await provider.settle();
  ops = provider.value.props.value;
  assert.equal(ops.locationsError, null);

  // Invoke actual unexported forms through a probe-only export, without changing app exports.
  const forms = load('web-app/components/ManagementScreens.tsx', {
    './OpsProvider': { useOps: () => ops }, './Icons': { Icon: 'Icon' },
    './useModalFocus': { useModalFocus() {} }, './RosterScreen': { RosterScreen: 'RosterScreen' },
  }, '\nexports.probeForms = { StaffForm, DutyForm };').probeForms;
  for (const [form, props] of [
    [forms.StaffForm, {}], [forms.StaffForm, { person: ops.staff[0] }],
    [forms.DutyForm, {}], [forms.DutyForm, { duty: ops.duties[0] }],
  ]) {
    let saved;
    const runner = new Runner(() => form({ ...props, locations: ops.locations, onSave: value => { saved = value; return { ok: true }; } }));
    runner.render();
    let tree = nodes(runner.value);
    assert(tree.some(n => n.type === 'option' && n.props.value === 'parvo' && n.props.children === 'Parvo Ward'));
    assert(!tree.some(n => n.type === 'option' && n.props.value === 'ward-old' && !n.props.disabled));
    tree.find(n => n.type === 'select' && tree.some(o => o.type === 'option' && o.props.value === 'parvo') && n.props.value === (props.person?.locationId ?? props.duty?.locationId ?? ops.locations[0].id))
      .props.onChange({ target: { value: 'parvo' } });
    runner.render();
    runner.value.props.onSubmit({ preventDefault() {} });
    assert.equal(saved.locationId, 'parvo', 'form saves the shared location ID');
  }
  const retiredForm = new Runner(() => forms.StaffForm({ person: { ...ops.staff[0], locationId: 'ward-old' }, locations: ops.locations, onSave() {} }));
  const retiredOption = nodes(retiredForm.render()).find(n => n.type === 'option' && n.props.value === 'ward-old');
  assert(retiredOption.props.disabled);
  assert(retiredOption.props.children.includes('Old Ward'));

  // Stage 3 uses the same location provider for template and roster operations.
  assert(Array.isArray(ops.scheduledWork));
  assert.equal(ops.duties.find(duty => duty.name === 'Oxygen Check').isCritical, true);
  const templateResult = ops.addDuty({ name: 'Shared Parvo care', description: '', area: 'Parvo Ward', locationId: 'parvo', time: '09:00', duration: '60 min', required: 1, recurrence: 'Daily', priority: 'Medium', isCritical: true, status: 'Active', requirements: [] });
  assert.equal(templateResult.ok, true);
  await provider.settle(); ops = provider.value.props.value;
  const template = ops.duties.find(duty => duty.name === 'Shared Parvo care');
  assert.equal(template.locationId, 'parvo');
  const input = { dutyId: template.id, title: template.name, description: '', date: '2026-11-02', startTime: '09:00', endTime: '10:00', area: 'Parvo Ward', locationId: 'parvo', required: 1 };
  assert.equal(ops.createScheduled(input).ok, true);
  assert.equal(ops.createScheduled({ ...input, dutyId: undefined, locationId: 'ward-old', area: 'Old Ward', date: '2026-11-03' }).code, 'AREA_REQUIRED');
  await provider.settle(); ops = provider.value.props.value;
  const work = ops.scheduledWork.find(item => item.date === input.date);
  assert.equal(work.locationId, 'parvo'); assert.equal(work.isCritical, true);
  assert.equal(ops.assignScheduled(work.id, ops.staff[0].id).ok, true);
  assert.equal(ops.publishWeek('2026-11-02').status, 'published');
  await provider.settle(); ops = provider.value.props.value;
  assert.equal(ops.publishedRoster('2026-11-02').scheduledWork[0].locationId, 'parvo');
  assert.equal(ops.editScheduled(work.id, { ...input, endTime: '10:30' }).ok, true);
  await provider.settle(); ops = provider.value.props.value;
  assert.equal(ops.rosterLifecycle('2026-11-02').hasUnpublishedChanges, true);
  assert.equal(ops.publishedRoster('2026-11-02').scheduledWork[0].endTime, '10:00');
  assert.equal(ops.publishWeek('2026-11-02').republished, true);
  await provider.settle(); ops = provider.value.props.value;
  assert.equal(ops.publishedRoster('2026-11-02').scheduledWork[0].endTime, '10:30');

  // Actual roster editor consumes the same active IDs and retains a retired historical option.
  const { RosterEditor } = load('web-app/components/RosterEditor.tsx', {
    './Icons': { Icon: 'Icon' }, './useModalFocus': { useModalFocus() {} },
  });
  const editorProps = { date: '2026-11-02', templates: [], locations: ops.locations, allLocations: ops.allLocations, onSave() {}, onClose() {} };
  const newEditor = new Runner(() => RosterEditor(editorProps));
  const newOptions = nodes(newEditor.render()).filter(node => node.type === 'option');
  assert(newOptions.some(node => node.props.value === 'parvo' && node.props.children === 'Parvo Ward'));
  assert(!newOptions.some(node => node.props.value === 'ward-old'));
  assert(!newOptions.some(node => node.props.children === 'Intake'));
  newEditor.unmount();
  const oldEditor = new Runner(() => RosterEditor({ ...editorProps, work: { ...work, locationId: 'ward-old', area: 'Old Ward' } }));
  const oldOption = nodes(oldEditor.render()).find(node => node.type === 'option' && node.props.value === 'ward-old');
  assert(oldOption.props.disabled);
  assert(oldOption.props.children.includes('Old Ward'));
  oldEditor.unmount();
  const generated = ops.generateDuties('2026-11-09');
  assert.equal(generated.ok, true);
  assert(generated.created > 0);
  assert(generated.scheduled.filter(item => item.date >= '2026-11-09').every(item => item.locationId === 'parvo'));
  await provider.settle(); ops = provider.value.props.value;

  // A restored session already signed in on first mount loads once.
  reads = 0;
  const restored = new Runner(() => OpsProvider({ children: null }));
  restored.render(); await restored.settle();
  assert.equal(reads, 1);
  restored.unmount();
  // Late responses must not repopulate locations after sign-out.
  let release;
  pendingRead = new Promise(resolve => { release = resolve; });
  const inFlight = provider.value.props.value.refreshLocations();
  auth = { status: 'signedOut', user: null };
  provider.render(); await provider.settle();
  release(); await inFlight; await provider.settle(); pendingRead = null;
  assert.equal(provider.value.props.value.locations.length, 0);
  provider.unmount();

  const { useLocations } = load('mobile-app/lib/useLocations.ts', {
    './locations': libs['mobile-app'], '../components/AuthProvider': authModule,
  });
  reads = 0;
  const hook = new Runner(useLocations);
  hook.render(); await hook.settle(); assert.equal(reads, 0);
  auth = { status: 'signedIn', user: { uid: 'staff-demo' } };
  hook.render(); await hook.settle();
  assert.equal(hook.value.locationName('ward-old'), 'Old Ward');
  assert(!hook.value.locations.some(l => l.id === 'ward-old'));
  fail = true;
  hook.value.retry(); await hook.settle();
  assert(hook.value.error);
  const failedHook = hook.value;
  const native = { KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: 'Modal', TextInput: 'TextInput', Platform: { OS: 'android' }, Alert: { alert() {} }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: v => v } };
  const baseMocks = {
    'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../theme': { colors: {} }, '../lib/useLocations': { useLocations: () => failedHook },
    './StaffHomeScreen': { BottomNavigation: 'BottomNavigation' }, './StaffAppHeader': { StaffAppHeader: 'StaffAppHeader' },
  };
  const demoTasks = load('mobile-app/data/demoTasks.ts', {}).initialDemoShifts;
  baseMocks['../data/demoLocations'] = load('mobile-app/data/demoLocations.ts', {});
  baseMocks['../data/demoEmployees'] = load('mobile-app/data/demoEmployees.ts', {});
  baseMocks['firebase/firestore'] = {};
  baseMocks['../lib/firebase'] = { FIREBASE_CONFIGURED: false, auth: null, db: null };
  const profile = load('mobile-app/data/demoStaffProfile.ts', {}).demoStaffProfile;
  const rosterData = load('mobile-app/data/demoRoster.ts', {});
  for (const [file, exportName, props] of [
    ['StaffWeeklyRosterScreen', 'StaffWeeklyRosterScreen', { initialView: 'week', tasks: demoTasks, profile }],
    ['StaffTaskDetailScreen', 'StaffTaskDetailScreen', { task: demoTasks[0] }],
  ]) {
    const screen = load(`mobile-app/components/${file}.tsx`, { ...baseMocks, '../data/demoRoster': rosterData })[exportName];
    const runner = new Runner(() => screen(props));
    const tree = nodes(runner.render());
    assert(tree.includes('Unable to load operational areas.'));
    const button = tree.find(n => n.props?.accessibilityLabel === 'Retry operational areas');
    const before = reads;
    fail = false;
    button.props.onPress(); await hook.settle();
    assert.equal(reads, before + 1, 'screen retry triggers existing hook read');
    assert.equal(hook.value.error, null);
    runner.unmount();
  }
  hook.unmount();
  process.stdout.write('PASS: A-L location compatibility, historical names, Parvo staff/duty selection, mobile errors/retry, web auth gating/restoration, stable effects, stale-response protection, shared-location roster/template actions and publication isolation.\n');
}
main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
