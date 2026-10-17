// Deterministic WS4 safety probes. Existing TypeScript only; no network or installations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const apps = path.join(root, 'SAID Ops');
const ts = require(path.join(apps, 'web-app/node_modules/typescript'));
const semver = require(path.join(apps, 'mobile-app/node_modules/semver'));
let current;
const element = (type, props) => ({ type, props: props || {} });
const depsEqual = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  createContext: () => ({ Provider: 'Provider' }),
  useContext: () => { throw new Error('Unexpected context access'); },
  useState: initial => {
    const runner = current, i = runner.index++;
    if (!(i in runner.slots)) runner.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [runner.slots[i], value => {
      const next = typeof value === 'function' ? value(runner.slots[i]) : value;
      if (!Object.is(next, runner.slots[i])) { runner.slots[i] = next; runner.dirty = true; }
    }];
  },
  useRef: value => { const r = current, i = r.index++; return r.slots[i] ||= { current: value }; },
  useMemo: (fn, deps) => {
    const r = current, i = r.index++;
    if (!depsEqual(r.slots[i]?.deps, deps)) r.slots[i] = { deps, value: fn() };
    return r.slots[i].value;
  },
  useCallback: (fn, deps) => react.useMemo(() => fn, deps),
  useEffect: (fn, deps) => {
    const r = current, i = r.index++;
    if (!depsEqual(r.slots[i]?.deps, deps)) {
      const previous = r.slots[i];
      r.slots[i] = { deps, cleanup: previous?.cleanup };
      r.effects.push(() => { previous?.cleanup?.(); r.slots[i].cleanup = fn(); });
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
    for (let i = 0; i < 25; i++) {
      await new Promise(resolve => setImmediate(resolve));
      if (!this.dirty) return;
      this.render();
    }
    throw new Error('Repeated effect loop');
  }
  unmount() { for (const slot of this.slots) slot?.cleanup?.(); }
}
function loader(mocks = {}, env = {}) {
  // These probes cover the preserved explicit demo/legacy adapters; Stage 7E tests exercise the live provider.
  mocks = {
    [path.join(apps,'web-app/lib/monitoring/backend.ts')]: {liveMonitoringEnabled:false},
    [path.join(apps,'web-app/components/OperationalMonitoringProvider.tsx')]: {OperationalMonitoringProvider:'LiveProvider'},
    [path.join(apps,'web-app/components/OperationalDashboard.tsx')]: {OperationalDashboard:'LiveDashboard',OperationalHistory:'LiveHistory'},
    ...mocks,
  };
  const cache = new Map();
  function load(file) {
    file = path.resolve(apps, file);
    if (Object.hasOwn(mocks, file)) return mocks[file];
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const source = fs.readFileSync(file, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    vm.runInNewContext(compiled, {
      exports, process: { env },
      require: name => {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element };
        if (name.startsWith('.')) {
          const base = path.resolve(path.dirname(file), name);
          const target = ['.ts', '.tsx', '/index.ts'].map(ext => base + ext).find(p => fs.existsSync(p));
          if (!target) throw new Error('Unresolved module ' + name);
          return load(target);
        }
        throw new Error('Unexpected external module ' + name);
      },
    }, { filename: file });
    return exports;
  }
  return load;
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  if (typeof tree !== 'object') return String(tree);
  return text(tree.props.children);
}
const appPath = relative => path.join(apps, relative);
let firestoreCalls = 0;
const sdk = new Proxy({}, { get: () => () => { firestoreCalls++; throw new Error('Unexpected Firestore operation'); } });
const userAuth = { currentUser: null };
let authListener;
let mobileConfigured = true;
const mobileFirebase = { isFirebaseConfigured: () => mobileConfigured, auth: userAuth, db: {} };
const native = { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: v => v } };
const firebaseKey = appPath('mobile-app/lib/firebase.ts');

async function main() {
  // Restore the entire approved runtime graph, not just the direct manifest.
  const manifest = JSON.parse(fs.readFileSync(appPath('mobile-app/package.json')));
  const lock = JSON.parse(fs.readFileSync(appPath('mobile-app/package-lock.json')));
  const baseManifest = JSON.parse(cp.execFileSync('git', ['show', '64b46ec7ebf3ad40664ae4b036947d242d0494a5:SAID Ops/mobile-app/package.json'], { cwd: root, encoding: 'utf8' }));
  const baseLock = JSON.parse(cp.execFileSync('git', ['show', '64b46ec7ebf3ad40664ae4b036947d242d0494a5:SAID Ops/mobile-app/package-lock.json'], { cwd: root, encoding: 'utf8' }));
  for (const group of ['dependencies', 'devDependencies']) {
    for (const [name, version] of Object.entries(baseManifest[group])) assert.equal(manifest[group][name], version);
    assert.deepEqual(lock.packages[''][group], manifest[group]);
  }
  assert.equal(manifest.dependencies.firebase, '^12.19.0');
  for (const [p, entry] of Object.entries(baseLock.packages)) if (p) assert.equal(lock.packages[p]?.version, entry.version, p);
  for (const [p, entry] of Object.entries(lock.packages)) {
    for (const [dep, range] of Object.entries(entry.dependencies || {})) {
      let parent = p, found;
      while (parent) {
        found = lock.packages[parent + '/node_modules/' + dep];
        if (found) break;
        const index = parent.lastIndexOf('/node_modules/');
        parent = index < 0 ? '' : parent.slice(0, index);
      }
      found ||= lock.packages['node_modules/' + dep];
      assert(found, `${p} missing ${dep}`);
      const versionRange = range.startsWith('npm:') ? range.slice(range.lastIndexOf('@') + 1) : range;
      assert(semver.satisfies(found.version, versionRange), `${p}: ${dep} ${found.version} does not satisfy ${range}`);
    }
  }

  for (const [mode, configured, uid, message] of [
    ['memory', true, null, null], ['firestore', false, null, 'Firebase configuration'],
    ['firestore', true, null, 'Sign in'],
  ]) {
    mobileConfigured = configured; userAuth.currentUser = uid ? { uid } : null;
    const load = loader({ [firebaseKey]: mobileFirebase, 'firebase/firestore': sdk }, { EXPO_PUBLIC_MONITORING_BACKEND: mode });
    const repo = load('mobile-app/data/notifications/createRepository.ts').createNotificationRepository(uid);
    let error, result;
    repo.subscribe(uid || 'demo-staff', data => { result = data; }, cause => { error = cause; });
    if (message) {
      assert(error.message.includes(message)); assert.equal(result, undefined);
      await assert.rejects(repo.markRead('n1', uid || 'demo-staff'));
      await assert.rejects(repo.markAllRead(uid || 'demo-staff'));
    } else {
      assert(result.length > 0);
      await repo.markRead(result[0].id, 'demo-staff'); await repo.markAllRead('demo-staff');
    }
  }
  // A direct provisional adapter cannot bypass the factory or demo/auth gates.
  mobileConfigured = true; userAuth.currentUser = { uid: 'trusted-uid' };
  const directLoad = loader({ [firebaseKey]: mobileFirebase, 'firebase/firestore': sdk }, { EXPO_PUBLIC_MONITORING_BACKEND: 'firestore' });
  const adapter = directLoad('mobile-app/data/notifications/firestoreRepository.ts');
  assert(adapter.createFirestoreNotificationRepository());
  const direct = new adapter.FirestoreNotificationRepository();
  assert.throws(() => direct.subscribe('demo-staff', () => {}), /Sign in/);
  await assert.rejects(direct.markRead('n1', 'other-uid'), /Sign in/);

  // Actual provider lifecycle: subscription failure differs from successful empty.
  let receive, failSubscription, writes = 0;
  const fakeRepo = {
    subscribe: (_id, cb, onError) => { receive = cb; failSubscription = onError; return () => {}; },
    markRead: async () => { writes++; throw new Error('offline'); },
    markAllRead: async () => { writes++; throw new Error('offline'); },
  };
  const factoryKey = appPath('mobile-app/data/notifications/createRepository.ts');
  const loadProvider = loader({ [firebaseKey]: mobileFirebase, [factoryKey]: { notificationBackend: 'memory', createNotificationRepository: () => fakeRepo }, 'firebase/auth': {} });
  const Provider = loadProvider('mobile-app/components/NotificationProvider.tsx').NotificationsProvider;
  const provider = new Runner(() => Provider({ staffId: 'demo-staff', children: null }));
  provider.render(); assert.equal(provider.value.props.value.status, 'loading');
  const loadingFrame = provider.value.props.value;
  failSubscription(new Error('offline')); await provider.settle();
  assert.equal(provider.value.props.value.status, 'error');
  provider.value.props.value.retry(); await provider.settle();
  receive([]); await provider.settle(); assert.equal(provider.value.props.value.status, 'empty');
  const emptyFrame = provider.value.props.value;
  receive([{ id: 'n1', recipientId: 'demo-staff', category: 'Roster', title: 'Roster', message: 'Changed', createdAt: new Date().toISOString(), isRead: false, deliveryStatus: 'Sent' }]);
  await provider.settle(); assert.equal(provider.value.props.value.status, 'data');
  assert.equal(await provider.value.props.value.markRead('n1'), false); await provider.settle();
  assert.equal(provider.value.props.value.status, 'error'); assert(provider.value.props.value.error.includes('Unable to mark'));
  assert.equal(provider.value.props.value.alerts[0].read, false);
  assert.equal(await provider.value.props.value.markAllRead(), false); await provider.settle();
  assert.equal(writes, 2);
  let uiFrame = provider.value.props.value;
  const statusLoad = loader({ 'react-native': native, [appPath('mobile-app/theme/index.ts')]: { colors: {} }, [appPath('mobile-app/components/NotificationProvider.tsx')]: { useNotifications: () => uiFrame } });
  const Status = statusLoad('mobile-app/components/NotificationStatus.tsx').NotificationStatus;
  assert(text(Status({})).includes('Unable to mark'));
  uiFrame = loadingFrame; assert(text(Status({})).includes('Loading notifications')); assert(!text(Status({})).includes('No notifications'));
  uiFrame = emptyFrame; assert(text(Status({})).includes('No notifications yet'));
  provider.unmount();

  // Real factory/provider in live mode waits for Auth, then reports the safe hold with UID.
  let trustedKey;
  const liveLoad = loader({ [firebaseKey]: mobileFirebase, 'firebase/firestore': new Proxy({}, {get:()=>()=>{throw Error('live offline');}}), 'firebase/auth': { onAuthStateChanged: (_auth, cb) => { authListener = cb; return () => {}; } } }, { EXPO_PUBLIC_MONITORING_BACKEND: 'firestore' });
  const realFactory = liveLoad('mobile-app/data/notifications/createRepository.ts');
  const liveProviderLoad = loader({ [firebaseKey]: mobileFirebase, [factoryKey]: { ...realFactory, createNotificationRepository: uid => { trustedKey = uid; return realFactory.createNotificationRepository(uid); } }, 'firebase/auth': { onAuthStateChanged: (_auth, cb) => { authListener = cb; return () => {}; } } });
  const LiveProvider = liveProviderLoad('mobile-app/components/NotificationProvider.tsx').NotificationsProvider;
  const live = new Runner(() => LiveProvider({ staffId: 'demo-staff', children: null }));
  live.render(); await live.settle(); assert.equal(live.value.props.value.status, 'loading');
  authListener(null); await live.settle(); assert.equal(live.value.props.value.status, 'error');
  assert.equal(await live.value.props.value.markRead('n1'), false);
  userAuth.currentUser = { uid: 'trusted-uid' }; authListener(userAuth.currentUser); await live.settle();
  assert.equal(trustedKey, 'trusted-uid'); assert(live.value.props.value.error.includes('Unable to load'));
  userAuth.currentUser = null;
  assert.equal(await live.value.props.value.markAllRead(), false); live.unmount();

  const webBackend = loader()('web-app/data/monitoring/backend.ts');
  const reason = webBackend.monitoringAccessError(true, 'firestore');
  const dataSource = { monitoringBackend: 'memory', monitoringUsesFirestore: false, monitoringUnavailableReason: reason };
  const webLoad = loader({ [appPath('web-app/lib/dataSource.ts')]: dataSource, 'firebase/firestore': sdk, [appPath('web-app/lib/firebase.ts')]: { db: {} } });
  const repos = webLoad('web-app/data/monitoring/createRepositories.ts').createRepositories();
  let syncs = 0, appends = 0, notifications = 0;
  const providerLoad = loader({
    [appPath('web-app/lib/dataSource.ts')]: dataSource,
    [appPath('web-app/data/monitoring/createRepositories.ts')]: { createRepositories: () => ({ ...repos, alerts: { ...repos.alerts, sync: async () => { syncs++; } }, audit: { ...repos.audit, append: async () => { appends++; } } }) },
    [appPath('web-app/data/monitoring/notificationWriter.ts')]: { writeNotification: async () => { notifications++; } },
    [appPath('web-app/components/OpsProvider.tsx')]: { useOps: () => ({ staff: [], duties: [], scheduledWork: [], locationName: id => id, locationsLoading: false, locationsError: null }) },
    [appPath('web-app/components/AuthProvider.tsx')]: { useAuth: () => ({ status: 'signedIn', user: { uid: 'trusted-supervisor' }, employee: { firstName: 'Real', surname: 'Supervisor' }, role: { name: 'Supervisor/Administrator' } }) },
  });
  const Monitoring = providerLoad('web-app/components/MonitoringProvider.tsx').MonitoringProvider;
  const monitoring = new Runner(() => Monitoring({ children: null }));
  monitoring.render(); await monitoring.settle(); monitoring.render(); await monitoring.settle();
  assert.equal(syncs + appends + notifications, 0, 'fixture Ops cannot reconcile/append/send to live collections');
  assert.equal(monitoring.value.props.value.alertsUnavailable, true); monitoring.unmount();
  await assert.rejects(repos.alerts.sync([])); await assert.rejects(repos.audit.append({})); await assert.rejects(repos.notes.add({}));
  assert.throws(() => webLoad('web-app/data/monitoring/firestoreRepositories.ts').createFirestoreRepositories(), /unavailable/);
  await assert.rejects(webLoad('web-app/data/monitoring/notificationWriter.ts').writeNotification({}), /unavailable/);

  let notesCallback, notesError;
  const notesApi = { subscribeNotes: (_type, _id, cb, onError) => { notesCallback = cb; notesError = onError; return () => {}; }, addNote: async () => {} };
  const notesLoad = loader({ [appPath('web-app/components/MonitoringProvider.tsx')]: { useMonitoring: () => notesApi } });
  const Notes = notesLoad('web-app/components/NotesPanel.tsx').NotesPanel;
  let entityId = 'alert-1';
  const notes = new Runner(() => Notes({ entityType: 'alert', entityId }));
  assert(text(notes.render()).includes('Loading notes')); assert(!text(notes.value).includes('No notes yet'));
  notesCallback([]); await notes.settle(); assert(text(notes.value).includes('No notes yet'));
  entityId = 'alert-2'; assert(text(notes.render()).includes('Loading notes')); assert(!text(notes.value).includes('No notes yet'));
  notesError(new Error('offline')); await notes.settle(); assert(text(notes.value).includes('Error loading notes')); assert(!text(notes.value).includes('No notes yet')); notes.unmount();

  // Integration regression: real memory monitoring reads WS2 occurrences, uses WS1 actor,
  // and cannot inherit an independent legacy assignment store or write Firestore.
  let webIdentity = {
    status: 'signedIn', user: { uid: 'real-supervisor-uid' },
    employee: { firstName: 'Authenticated', surname: 'Supervisor' }, role: { name: 'Supervisor/Administrator' },
  };
  const occurrence = { id: 'work-local', title: 'Occurrence edited to afternoon', description: '', date: '2026-10-23', startTime: '14:00', endTime: '15:30', area: 'Old area name', locationId: 'parvo', required: 2, staffIds: [], isCritical: true };
  const opsInput = {
    staff: [{ id: 'local-staff', name: 'Local staff', role: 'Nurse', locationId: 'parvo', availability: 'Available' }],
    duties: [], scheduledWork: [occurrence], locationName: id => id === 'parvo' ? 'Parvo Ward' : id,
    locationsLoading: false, locationsError: null,
    assignments: [{ id: 'legacy-ignored', dutyId: 'missing-template', staffIds: ['fake'] }],
  };
  const memoryLoad = loader({
    [appPath('web-app/lib/dataSource.ts')]: { monitoringBackend: 'memory', monitoringUsesFirestore: false, monitoringUnavailableReason: null },
    [appPath('web-app/components/OpsProvider.tsx')]: { useOps: () => opsInput },
    [appPath('web-app/components/AuthProvider.tsx')]: { useAuth: () => webIdentity },
    [appPath('web-app/lib/firebase.ts')]: { getFirebaseDb: () => { firestoreCalls++; throw new Error('Unexpected database initialization'); } },
    'firebase/firestore': sdk,
  });
  const LocalMonitoring = memoryLoad('web-app/components/MonitoringProvider.tsx').MonitoringProvider;
  const localMonitoring = new Runner(() => LocalMonitoring({ children: null }));
  localMonitoring.render(); await localMonitoring.settle();
  const detected = localMonitoring.value.props.value.openAlerts.find(alert => alert.key === 'staffing:work-local');
  assert(detected); assert(detected.details.includes('14:00')); assert.equal(detected.area, 'Parvo Ward');
  assert(!localMonitoring.value.props.value.openAlerts.some(alert => alert.key.includes('legacy-ignored')));
  const log = await localMonitoring.value.props.value.recordAudit({ category: 'SystemEvent', action: 'RosterCreated', summary: 'Local integration probe', details: '', area: 'Parvo Ward', entityType: 'roster' });
  assert.equal(log.actor.id, 'real-supervisor-uid'); assert.equal(log.actor.name, 'Authenticated Supervisor');
  const savedNote = await localMonitoring.value.props.value.addNote({ entityType: 'alert', entityId: detected.id, text: 'Session-only probe note' });
  assert.equal(savedNote.author.id, 'real-supervisor-uid');
  await localMonitoring.settle();
  webIdentity = { status: 'signedOut', user: null, employee: null, role: null };
  localMonitoring.render(); await localMonitoring.settle();
  await assert.rejects(localMonitoring.value.props.value.recordAudit({}), /Sign in/);
  await assert.rejects(localMonitoring.value.props.value.addNote({}), /Sign in/);
  await assert.rejects(localMonitoring.value.props.value.resolveAlerts(['local-alert']), /Sign in/);
  localMonitoring.unmount();

  // Render actual Dashboard cards: occurrence counts, shared areas, unavailable progress,
  // demo labels and blocked-mode honesty must survive the provider composition.
  let dashboardMonitoring = { openAlerts: [], loading: false, alertsUnavailable: false };
  const dashboardOps = {
    ...opsInput, staff: [{ availability: 'Unavailable' }],
    scheduledWork: [{ ...occurrence, staffIds: ['a','b'] }, { ...occurrence, id: 'work-two', staffIds: ['a'] }],
    locations: [{ id: 'parvo', name: 'Parvo Ward' }], refreshLocations: async () => {},
  };
  const dashboardLoad = loader({
    'react': {...react,useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}]},
    [appPath('web-app/lib/roster/useSupervisorProgress.ts')]: {useSupervisorProgress: () => ({state:{status:'EMPTY',rows:[]},refresh(){}})},
    'next/link': 'Link', [appPath('web-app/components/Icons.tsx')]: { Icon: 'Icon' },
    [appPath('web-app/components/AlertsHistory.tsx')]: { ALERT_ICON: {} },
    [appPath('web-app/components/MonitoringProvider.tsx')]: { useMonitoring: () => dashboardMonitoring },
    [appPath('web-app/components/OpsProvider.tsx')]: { useOps: () => dashboardOps },
  });
  const Dashboard = dashboardLoad('web-app/components/Dashboard.tsx').Dashboard;
  const rawNodes = tree => Array.isArray(tree) ? tree.flatMap(rawNodes) : tree && typeof tree === 'object' ? [tree, ...rawNodes(tree.props.children)] : [];
  const cards = tree => Object.fromEntries(rawNodes(tree).filter(node => node.props.className?.startsWith('stat-card ')).map(node => [text(node.props.children[1]).trim(), text(node.props.children[2]).trim()]));
  const dashboard = Dashboard();
  assert.equal(cards(dashboard)['Staff Scheduled'], '2'); assert.equal(cards(dashboard)['Staff Unavailable'], '1');
  assert.equal(cards(dashboard)['Total Duties'], '2'); assert.equal(cards(dashboard).Completed, '—'); assert.equal(cards(dashboard)['In Progress'], '—');
  // Functions created inside the VM have a different realm, so inspect typeof explicitly.
  const labels = rawNodes(dashboard).filter(node => typeof node.type === 'function').map(node => text(node.type(node.props))).join(' ');
  assert((labels.match(/Demo data/g) || []).length >= 5); assert(text(dashboard).includes('Parvo Ward'));
  dashboardMonitoring = { openAlerts: [], loading: false, alertsUnavailable: true };
  assert.equal(cards(Dashboard())['Attention Required'], '—'); assert(text(Dashboard()).includes('Alerts unavailable'));
  assert(!text(Dashboard()).includes('No open alerts'));
  dashboardOps.locationsLoading = true;
  assert.equal(cards(Dashboard())['Total Duties'], '—'); assert(text(Dashboard()).includes('Loading operational areas'));
  const doc = fs.readFileSync(appPath('web-app/doc/monitoring-integration-gaps.md'), 'utf8').replace(/\r\n/g, '\n');
  assert(doc.includes('canonical FR-9 states are exactly Scheduled, In Progress,\n  Completed and Unable to Complete'));
  assert(!doc.includes('No\n  status list is agreed')); assert(!doc.includes('no shared status list'));
  assert.equal(firestoreCalls, 0);
  process.stdout.write('PASS: WS4 A-K mode/auth boundaries, zero live reads/writes/reconciliation, notification and notes states, failures, canonical FR-9 wording, approved runtime and complete lockfile dependency graph; integrated ScheduledWork monitoring, authenticated actors and dashboard honesty.\n');
}
main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
