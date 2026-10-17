import { readFile } from 'node:fs/promises';
import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  doc,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setLogLevel,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';

const projectId = 'demo-said-5ce3e';
const staffUid = 'auth-staff-1';
const coworkerUid = 'auth-staff-2';
const supervisorUid = 'auth-supervisor-1';
const weekStart = '2026-09-28';
const otherWeek = '2026-10-05';
const currentVersion = 'v2';
const staleVersion = 'v1';
const fixedTime = Timestamp.fromDate(new Date('2026-09-27T00:00:00Z'));
const provisionalCollections = [
  // Actual frozen WS4 collection names, including its blocked notification adapter.
  'alerts', 'auditLogs', 'notes', 'notifications',
  // Deferred archive/history names also remain denied, without approving a schema.
  'archive', 'archives', 'operationalHistory',
];
const deniedCollections = [
  'leaveRequests', ...provisionalCollections, 'draftRosters', 'unknownSecurityProbe',
];
let testEnv;

function dbFor(uid = staffUid) {
  return uid === null
    ? testEnv.unauthenticatedContext().firestore()
    : testEnv.authenticatedContext(uid).firestore();
}

function employee(employeeId, roleId, contact = true) {
  const profile = { employeeId, firstName: 'Example', surname: 'Employee', roleId };
  if (contact) Object.assign(profile, {
    contactEmail: employeeId.toLowerCase() + '@example.test',
    phoneNumber: '0000000000',
    profilePictureUrl: '',
  });
  return profile;
}

function itemPath(id = 'work-1', version = currentVersion, week = weekStart) {
  return 'publishedRosters/' + week + '/versions/' + version + '/items/' + id;
}

function progressPath(uid = staffUid, id = 'work-1') {
  return 'employees/' + uid + '/taskProgress/' + id;
}

function notificationPath(uid = staffUid) {
  return 'employees/' + uid + '/notifications/note-1';
}

function publishedItem(id = 'work-1', assignedUids = [staffUid], week = weekStart) {
  return {
    scheduledWorkId: id, weekStart: week, date: week, title: 'Opening',
    description: 'Staff-safe instructions', startTime: '08:00', endTime: '10:00',
    locationId: 'legacy', requiredStaff: assignedUids.length, assignedUids, isCritical: false,
    team: assignedUids.map((uid) => ({
      employeeId: uid === staffUid ? 'EMP-0001' : 'EMP-0002',
      displayName: uid === staffUid ? 'Example One' : 'Example Two',
      jobCategory: 'Nurse',
    })),
  };
}

function progress(overrides = {}) {
  return {
    scheduledWorkId: 'work-1', weekStart, publicationVersion: currentVersion,
    status: 'In Progress', updatedAt: serverTimestamp(), ...overrides,
  };
}

function notification() {
  return {
    id: 'note-1', title: 'Roster updated', message: 'Your roster changed',
    category: 'roster', timestamp: fixedTime, isRead: false,
  };
}

function legacyShift(id = 'shift-1') {
  return {
    id, title: 'Legacy administrative shift', shiftDate: fixedTime,
    startTime: '08:00', endTime: '10:00', status: 'Upcoming',
    description: 'Opening tasks', tag: 'operations', locationId: 'legacy',
    team: [{ employeeId: 'EMP-0001', isPrimary: true }],
  };
}

async function seedRecords(records) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const batch = writeBatch(db);
    for (const [path, data] of records) batch.set(doc(db, path), data);
    await batch.commit();
  });
}

async function seedProgress(status = 'In Progress', overrides = {}, uid = staffUid) {
  await seedRecords([[progressPath(uid), progress({ status, updatedAt: fixedTime, ...overrides })]]);
}

async function republish(assignedUids = [staffUid]) {
  await seedRecords([
    ['publishedRosters/' + weekStart, { weekStart, currentVersion: 'v3', publishedAt: fixedTime }],
    [itemPath('work-1', 'v3'), publishedItem('work-1', assignedUids)],
  ]);
}

async function seed() {
  await seedRecords([
    ['roles/staff-role', { name: 'Staff Member' }],
    ['roles/supervisor-role', { name: 'Supervisor/Administrator' }],
    ['roles/legacy-supervisor-role', { id: 'legacy-supervisor-role', name: 'Supervisor/Administrator' }],
    ['employees/' + staffUid, {
      ...employee('EMP-0001', 'staff-role'), id: 'legacy-value-is-not-identity',
      jobCategory: 'Nurse', locationId: 'legacy',
    }],
    ['employees/' + coworkerUid, employee('EMP-0002', 'staff-role', false)],
    ['employees/' + supervisorUid, employee('EMP-ADMIN', 'supervisor-role')],
    ['locations/legacy', { id: 'legacy', name: 'Main' }],
    ['locations/active', { name: 'Annex', active: true }],
    ['locations/retired', { name: 'Old ward', active: false }],
    ['publishedRosters/' + weekStart, { weekStart, currentVersion, publishedAt: fixedTime }],
    ['publishedRosters/' + otherWeek, { weekStart: otherWeek, currentVersion, publishedAt: fixedTime }],
    [itemPath(), publishedItem()],
    [itemPath('work-2'), publishedItem('work-2', [coworkerUid])],
    [itemPath('work-3'), publishedItem('work-3', [staffUid, coworkerUid])],
    [itemPath('work-1', staleVersion), publishedItem()],
    [itemPath('work-1', currentVersion, otherWeek), publishedItem('work-1', [staffUid], otherWeek)],
    ['publishedRosters/' + weekStart + '/versions/' + currentVersion, { internal: 'private version record' }],
    [progressPath(coworkerUid, 'work-2'), progress({
      scheduledWorkId: 'work-2', status: 'Completed', updatedAt: fixedTime,
    })],
    [notificationPath(), notification()],
    [notificationPath(coworkerUid), { ...notification(), relatedShiftId: 'work-2' }],
    [notificationPath(supervisorUid), notification()],
    ['shifts/shift-1', legacyShift()],
    ...deniedCollections.map((name) => [name + '/record-1', {
      title: 'Private record', employeeId: 'EMP-0001', status: 'Pending',
    }]),
    ['employees/' + staffUid + '/privateData/record-1', { confidential: true }],
  ]);
}

before(async () => {
  // Expected permission denials are asserted below; keep SDK retry logs out of test output.
  setLogLevel('silent');
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  testEnv = await initializeTestEnvironment({ projectId, firestore: { rules } });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

after(async () => {
  await testEnv?.cleanup();
});

// Employees and the exact WS1 authorization names.
test('unauthenticated employee get and list are denied', async () => {
  const db = dbFor(null);
  await assertFails(getDoc(doc(db, 'employees/' + staffUid)));
  await assertFails(getDocs(collection(db, 'employees')));
});

test('staff reads own UID profile with business employeeId and legacy id', async () => {
  const snapshot = await assertSucceeds(getDoc(doc(dbFor(), 'employees/' + staffUid)));
  assert.equal(snapshot.data().employeeId, 'EMP-0001');
  assert.notEqual(snapshot.data().id, staffUid);
});

test('staff cannot get coworker, use business ID as UID, or list workforce', async () => {
  const db = dbFor();
  await assertFails(getDoc(doc(db, 'employees/' + coworkerUid)));
  await assertFails(getDoc(doc(db, 'employees/EMP-0001')));
  await assertFails(getDocs(collection(db, 'employees')));
  await assertFails(getDocs(query(collection(db, 'employees'), where('roleId', '==', 'staff-role'))));
});

test('supervisor reads individual employees and complete workforce', async () => {
  const db = dbFor(supervisorUid);
  await assertSucceeds(getDoc(doc(db, 'employees/' + coworkerUid)));
  const result = await assertSucceeds(getDocs(collection(db, 'employees')));
  assert.equal(result.size, 3);
});

test('own employee and referenced role reads support WS1 bootstrap even for invalid roles', async () => {
  await seedRecords([
    ['employees/auth-invalid', employee('EMP-INVALID', 'invalid-role')],
    ['roles/invalid-role', { name: 'Nurse' }],
  ]);
  const db = dbFor('auth-invalid');
  await assertSucceeds(getDoc(doc(db, 'employees/auth-invalid')));
  await assertSucceeds(getDoc(doc(db, 'roles/invalid-role')));
  await assertFails(getDocs(collection(db, 'employees')));
});

for (const field of ['contactEmail', 'phoneNumber', 'profilePictureUrl']) {
  test('staff cannot update, add or remove own profile field ' + field, async () => {
    await assertFails(updateDoc(doc(dbFor(), 'employees/' + staffUid), { [field]: 'Updated value' }));
    const db = dbFor(coworkerUid);
    await assertFails(updateDoc(doc(db, 'employees/' + coworkerUid), { [field]: 'New value' }));
    await assertFails(updateDoc(doc(dbFor(), 'employees/' + staffUid), { [field]: deleteField() }));
    await assertFails(updateDoc(doc(dbFor(), 'employees/' + staffUid), { [field]: 42 }));
  });
}

for (const [field, value] of Object.entries({
  employeeId: 'EMP-FORGED', roleId: 'supervisor-role', id: staffUid,
  uid: supervisorUid, jobCategory: 'Supervisor/Administrator', locationId: 'retired',
  firstName: 'Forged name', surname: 'Forged surname', email: 'old-field@example.test',
  authorizationRole: 'Supervisor/Administrator', isAdmin: true,
})) {
  test('staff cannot change or inject protected employee field ' + field, async () => {
    await assertFails(updateDoc(doc(dbFor(), 'employees/' + staffUid), { [field]: value }));
  });
}

test('staff cannot edit coworker profile', async () => {
  await assertFails(updateDoc(doc(dbFor(), 'employees/' + coworkerUid), { phoneNumber: '111' }));
});

test('supervisor cannot mutate employee profile or protected fields', async () => {
  const db = dbFor(supervisorUid);
  for (const [field, value] of Object.entries({
    firstName: 'Updated', surname: 'Name', contactEmail: 'contact@example.test',
    phoneNumber: '111', profilePictureUrl: 'https://example.test/photo.png',
  })) {
    await assertFails(updateDoc(doc(db, 'employees/' + staffUid), { [field]: value }));
    await assertFails(updateDoc(doc(db, 'employees/' + coworkerUid), { [field]: value }));
  }
  for (const changes of [
    { employeeId: 'EMP-FORGED' }, { roleId: 'supervisor-role' }, { id: coworkerUid },
    { jobCategory: 'Administrator' }, { locationId: 'retired' }, { isAdmin: true },
    { firstName: 42 }, { roleId: deleteField() },
  ]) await assertFails(updateDoc(doc(db, 'employees/' + coworkerUid), changes));
});

for (const uid of [staffUid, supervisorUid, null]) {
  test('employee client provisioning and deletion denied for ' + uid, async () => {
    const db = dbFor(uid);
    await assertFails(setDoc(doc(db, 'employees/auth-new'), employee('EMP-NEW', 'staff-role')));
    await assertFails(deleteDoc(doc(db, 'employees/' + staffUid)));
  });
}

const invalidAuthorities = [
  ['missing employee', null, null],
  ['missing roleId', { employeeId: 'EMP-BAD', firstName: 'Bad', surname: 'Role' }, null],
  ['nonstring roleId', employee('EMP-BAD', 42), null],
  ['missing role document', employee('EMP-BAD', 'bad-role'), null],
  ['unknown name', employee('EMP-BAD', 'bad-role'), { name: 'Administrator' }],
  ['old supervisor name', employee('EMP-BAD', 'bad-role'), { name: 'supervisor' }],
  ['old staff name', employee('EMP-BAD', 'bad-role'), { name: 'staff' }],
  ['job category role', employee('EMP-BAD', 'bad-role'), { name: 'Nurse' }],
  ['missing role name', employee('EMP-BAD', 'bad-role'), { id: 'bad-role' }],
  ['mismatched role id', employee('EMP-BAD', 'bad-role'), { id: 'supervisor-role', name: 'Supervisor/Administrator' }],
  ['null role id', employee('EMP-BAD', 'bad-role'), { id: null, name: 'Supervisor/Administrator' }],
  ['privileged job category only', { ...employee('EMP-BAD', 'staff-role'), jobCategory: 'Supervisor/Administrator' }, null],
];
for (const [label, profile, role] of invalidAuthorities) {
  test(label + ' cannot gain supervisor privileges', async () => {
    const records = [];
    if (profile) records.push(['employees/auth-bad', profile]);
    if (role) records.push(['roles/bad-role', role]);
    if (records.length) await seedRecords(records);
    const db = dbFor('auth-bad');
    await assertFails(getDoc(doc(db, 'employees/' + coworkerUid)));
    await assertFails(getDocs(collection(db, 'employees')));
    await assertFails(setDoc(doc(db, 'locations/forged'), { name: 'Forged', active: true }));
    await assertFails(getDoc(doc(db, 'shifts/shift-1')));
    await assertFails(getDoc(doc(db, itemPath('work-2'))));
  });
}

test('matching optional legacy role id preserves certified supervisor privilege', async () => {
  await seedRecords([['employees/auth-legacy-admin', employee('EMP-LEGACY', 'legacy-supervisor-role')]]);
  await assertSucceeds(getDocs(collection(dbFor('auth-legacy-admin'), 'employees')));
});

test('auth token claims do not override provisioned role', async () => {
  const db = testEnv.authenticatedContext(staffUid, { role: 'Supervisor/Administrator', admin: true }).firestore();
  await assertFails(getDocs(collection(db, 'employees')));
  await assertFails(setDoc(doc(db, 'locations/forged'), { name: 'Forged' }));
});

test('staff and supervisor get only their own referenced role without a stored id', async () => {
  for (const [uid, ownRole, otherRole] of [
    [staffUid, 'staff-role', 'supervisor-role'], [supervisorUid, 'supervisor-role', 'staff-role'],
  ]) {
    const db = dbFor(uid);
    await assertSucceeds(getDoc(doc(db, 'roles/' + ownRole)));
    await assertFails(getDoc(doc(db, 'roles/' + otherRole)));
    await assertFails(getDocs(collection(db, 'roles')));
  }
  await assertFails(getDoc(doc(dbFor(null), 'roles/staff-role')));
});

for (const uid of [staffUid, supervisorUid, null]) {
  test('role creation, escalation, and deletion denied for ' + uid, async () => {
    const db = dbFor(uid);
    await assertFails(setDoc(doc(db, 'roles/forged'), { name: 'Supervisor/Administrator' }));
    await assertFails(updateDoc(doc(db, 'roles/staff-role'), { name: 'Supervisor/Administrator' }));
    await assertFails(deleteDoc(doc(db, 'roles/staff-role')));
  });
}

// Locations: test the actual certified orderBy(name) query without filtering out legacy records.
test('authenticated locations include legacy, active and retired records', async () => {
  const db = dbFor();
  const result = await assertSucceeds(getDocs(query(collection(db, 'locations'), orderBy('name'))));
  assert.equal(result.size, 3);
  assert.equal((await assertSucceeds(getDoc(doc(db, 'locations/legacy')))).data().active, undefined);
  assert.equal((await assertSucceeds(getDoc(doc(db, 'locations/retired')))).data().active, false);
});

test('unauthenticated location get and list denied', async () => {
  const db = dbFor(null);
  await assertFails(getDoc(doc(db, 'locations/legacy')));
  await assertFails(getDocs(collection(db, 'locations')));
});

for (const [label, data] of [
  ['WS1 new', { name: 'New ward', active: true }],
  ['retired', { name: 'Retired ward', active: false }],
  ['legacy', { id: 'new', name: 'Legacy ward' }],
  ['legacy with active', { id: 'new', name: 'Legacy ward', active: true }],
]) {
  test('supervisor creates ' + label + ' location', async () => {
    await assertSucceeds(setDoc(doc(dbFor(supervisorUid), 'locations/new'), data));
  });
}

test('supervisor renames, retires and reactivates legacy and new locations', async () => {
  const db = dbFor(supervisorUid);
  for (const id of ['legacy', 'active']) {
    const ref = doc(db, 'locations/' + id);
    await assertSucceeds(updateDoc(ref, { name: 'Renamed', active: false }));
    await assertSucceeds(updateDoc(ref, { active: true }));
    const snapshot = await assertSucceeds(getDoc(ref));
    assert.equal(snapshot.data().active, true);
    if (id === 'legacy') assert.equal(snapshot.data().id, 'legacy');
    else assert.equal(snapshot.data().id, undefined);
  }
});

for (const [label, data] of [
  ['mismatched id', { name: 'New', id: 'wrong' }],
  ['extra field', { name: 'New', active: true, isAdmin: true }],
  ['missing name', { active: true }],
  ['nonstring name', { name: 42 }],
  ['nonboolean active', { name: 'New', active: 'true' }],
  ['nonstring id', { name: 'New', id: 42 }],
]) {
  test('supervisor location creation rejects ' + label, async () => {
    await assertFails(setDoc(doc(dbFor(supervisorUid), 'locations/new'), data));
  });
}

test('location updates cannot spoof/remove/add id or inject unrelated fields', async () => {
  const db = dbFor(supervisorUid);
  for (const changes of [{ id: 'wrong' }, { id: deleteField() }, { extra: true }, { name: deleteField() }, { active: null }]) {
    await assertFails(updateDoc(doc(db, 'locations/legacy'), changes));
  }
  await assertFails(updateDoc(doc(db, 'locations/active'), { id: 'active' }));
  await seedRecords([['locations/corrupt', { id: 'wrong', name: 'Corrupt' }]]);
  await assertFails(updateDoc(doc(db, 'locations/corrupt'), { name: 'Rename' }));
});

for (const uid of [staffUid, null]) {
  test('location create, rename, retirement and deletion denied for ' + uid, async () => {
    const db = dbFor(uid);
    await assertFails(setDoc(doc(db, 'locations/new'), { name: 'New', active: true }));
    await assertFails(updateDoc(doc(db, 'locations/legacy'), { name: 'Rename' }));
    await assertFails(updateDoc(doc(db, 'locations/active'), { active: false }));
    await assertFails(deleteDoc(doc(db, 'locations/legacy')));
  });
}

test('supervisor location deletion denied', async () => {
  await assertFails(deleteDoc(doc(dbFor(supervisorUid), 'locations/legacy')));
});

// Immutable published snapshots and query authorization.
test('authenticated users discover current publication metadata', async () => {
  for (const uid of [staffUid, supervisorUid]) {
    const db = dbFor(uid);
    const snapshot = await assertSucceeds(getDoc(doc(db, 'publishedRosters/' + weekStart)));
    assert.equal(snapshot.data().currentVersion, currentVersion);
    await assertSucceeds(getDocs(collection(db, 'publishedRosters')));
  }
  await assertFails(getDoc(doc(dbFor(null), 'publishedRosters/' + weekStart)));
  await assertFails(getDocs(collection(dbFor(null), 'publishedRosters')));
});

test('staff reads own and shared current items with safe teammate projection', async () => {
  const db = dbFor();
  await assertSucceeds(getDoc(doc(db, itemPath())));
  const snapshot = await assertSucceeds(getDoc(doc(db, itemPath('work-3'))));
  assert.deepEqual(Object.keys(snapshot.data().team[1]).sort(), ['displayName', 'employeeId', 'jobCategory']);
  await assertFails(getDoc(doc(db, 'employees/' + coworkerUid)));
});

test('staff cannot read coworker-only or stale assigned published items', async () => {
  const db = dbFor();
  await assertFails(getDoc(doc(db, itemPath('work-2'))));
  await assertFails(getDoc(doc(db, itemPath('work-1', staleVersion))));
});

test('staff current-version array-contains query returns only assigned items', async () => {
  const db = dbFor();
  const result = await assertSucceeds(getDocs(query(
    collection(db, 'publishedRosters/' + weekStart + '/versions/' + currentVersion + '/items'),
    where('assignedUids', 'array-contains', staffUid),
    orderBy('date'), orderBy('startTime'),
  )));
  assert.deepEqual(result.docs.map((d) => d.id).sort(), ['work-1', 'work-3']);
});

test('staff unfiltered, wrong UID, multi-UID and stale publication queries denied', async () => {
  const db = dbFor();
  const currentItems = collection(db, 'publishedRosters/' + weekStart + '/versions/' + currentVersion + '/items');
  await assertFails(getDocs(currentItems));
  await assertFails(getDocs(query(currentItems, where('assignedUids', 'array-contains', coworkerUid))));
  await assertFails(getDocs(query(currentItems, where('assignedUids', 'array-contains-any', [staffUid, coworkerUid]))));
  await assertFails(getDocs(query(
    collection(db, 'publishedRosters/' + weekStart + '/versions/' + staleVersion + '/items'),
    where('assignedUids', 'array-contains', staffUid),
  )));
  await assertFails(getDocs(query(collectionGroup(db, 'items'), where('assignedUids', 'array-contains', staffUid))));
});

test('supervisor reads full current and historical published snapshots', async () => {
  const db = dbFor(supervisorUid);
  for (const version of [currentVersion, staleVersion]) {
    await assertSucceeds(getDoc(doc(db, itemPath('work-1', version))));
    const result = await assertSucceeds(getDocs(collection(db, 'publishedRosters/' + weekStart + '/versions/' + version + '/items')));
    assert.equal(result.size, version === currentVersion ? 3 : 1);
  }
});

test('unauthenticated published item get and list denied', async () => {
  const db = dbFor(null);
  await assertFails(getDoc(doc(db, itemPath())));
  await assertFails(getDocs(query(
    collection(db, 'publishedRosters/' + weekStart + '/versions/' + currentVersion + '/items'),
    where('assignedUids', 'array-contains', staffUid),
  )));
});

for (const uid of [staffUid, supervisorUid, null]) {
  test('publication metadata and item create/update/delete denied for ' + uid, async () => {
    const db = dbFor(uid);
    await assertFails(setDoc(doc(db, 'publishedRosters/2026-10-12'), {
      weekStart: '2026-10-12', currentVersion: 'v1', publishedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(db, 'publishedRosters/' + weekStart), { currentVersion: staleVersion }));
    await assertFails(deleteDoc(doc(db, 'publishedRosters/' + weekStart)));
    await assertFails(setDoc(doc(db, itemPath('forged')), publishedItem('forged')));
    await assertFails(updateDoc(doc(db, itemPath()), { title: 'Changed' }));
    await assertFails(deleteDoc(doc(db, itemPath())));
  });
}

test('version parent records are not an approved client data surface', async () => {
  for (const uid of [staffUid, supervisorUid]) {
    const db = dbFor(uid);
    const path = 'publishedRosters/' + weekStart + '/versions/' + currentVersion;
    await assertFails(getDoc(doc(db, path)));
    await assertFails(setDoc(doc(db, path), { internal: 'Forged' }));
    await assertFails(deleteDoc(doc(db, path)));
  }
});

// FR-9: absence means Scheduled; server timestamps and current assignment govern persistence.
test('assigned owner cannot create progress directly; trusted seeded progress remains readable', async () => {
  const db = dbFor();
  const ref = doc(db, progressPath());
  assert.equal((await assertSucceeds(getDoc(ref))).exists(), false);
  await assertFails(setDoc(ref, progress()));
  await seedProgress();
  const snapshot = await assertSucceeds(getDoc(ref));
  assert.equal(snapshot.data().status, 'In Progress');
  assert.ok(snapshot.data().updatedAt instanceof Timestamp);
});

for (const status of ['Scheduled', 'Completed', 'Unable to Complete', 'Paused', 'Upcoming', 'in progress']) {
  test('first progress persistence rejects status ' + status, async () => {
    await assertFails(setDoc(doc(dbFor(), progressPath()), progress({ status, unableToCompleteReason: 'Valid reason' })));
  });
}

test('unassigned owner cannot create progress', async () => {
  await assertFails(setDoc(doc(dbFor(), progressPath(staffUid, 'work-2')), progress({ scheduledWorkId: 'work-2' })));
});

test('progress UID ownership cannot be forged even for shared assignments', async () => {
  await assertFails(setDoc(doc(dbFor(), progressPath(coworkerUid, 'work-3')), progress({ scheduledWorkId: 'work-3' })));
});

test('progress scheduledWorkId must equal document path', async () => {
  await assertFails(setDoc(doc(dbFor(), progressPath()), progress({ scheduledWorkId: 'work-3' })));
});

test('progress cannot refer to stale or missing publications/items', async () => {
  const db = dbFor();
  for (const changes of [
    { publicationVersion: staleVersion }, { publicationVersion: 'missing' },
    { weekStart: '2027-01-04' },
  ]) await assertFails(setDoc(doc(db, progressPath()), progress(changes)));
  await assertFails(setDoc(doc(db, progressPath(staffUid, 'missing-work')), progress({ scheduledWorkId: 'missing-work' })));
});

test('progress rejects inconsistent trusted item identity/week fields', async () => {
  for (const changes of [{ scheduledWorkId: 'wrong' }, { weekStart: otherWeek }]) {
    await seedRecords([[itemPath(), { ...publishedItem(), ...changes }]]);
    await assertFails(setDoc(doc(dbFor(), progressPath()), progress()));
  }
});

for (const field of ['scheduledWorkId', 'weekStart', 'publicationVersion', 'status', 'updatedAt']) {
  test('progress requires field ' + field, async () => {
    const data = progress();
    delete data[field];
    await assertFails(setDoc(doc(dbFor(), progressPath()), data));
  });
}

for (const [label, changes] of [
  ['numeric version', { publicationVersion: 2 }],
  ['empty version', { publicationVersion: '' }],
  ['timestamp week', { weekStart: fixedTime }],
  ['empty week', { weekStart: '' }],
  ['client timestamp', { updatedAt: fixedTime }],
  ['future timestamp', { updatedAt: Timestamp.fromDate(new Date('2099-01-01T00:00:00Z')) }],
  ['string timestamp', { updatedAt: '2026-09-28' }],
  ['nonstring optional reason', { unableToCompleteReason: 42 }],
]) {
  test('progress create rejects ' + label, async () => {
    await assertFails(setDoc(doc(dbFor(), progressPath()), progress(changes)));
  });
}

for (const [from, to] of [
  ['In Progress', 'Completed'],
  ['In Progress', 'Unable to Complete'],
  ['Completed', 'In Progress'],
  ['Unable to Complete', 'In Progress'],
]) {
  test('FR-9 transition ' + from + ' to ' + to + ' requires trusted API', async () => {
    await seedProgress(from, { unableToCompleteReason: 'Preserved prior reason' });
    const db = dbFor();
    const changes = { status: to, updatedAt: serverTimestamp() };
    if (to === 'Unable to Complete') changes.unableToCompleteReason = '  Equipment unavailable  ';
    await assertFails(updateDoc(doc(db, progressPath()), changes));
    const snapshot = await assertSucceeds(getDoc(doc(db, progressPath())));
    assert.equal(snapshot.data().status, from);
    if (to === 'In Progress') assert.equal(snapshot.data().unableToCompleteReason, 'Preserved prior reason');
  });
}

for (const [label, reason] of [
  ['missing', undefined], ['empty', ''], ['spaces', '   '],
  ['whitespace', ' \t\r\n '], ['nonbreaking spaces', '\u00a0\u00a0'],
  ['BOM', '\ufeff'], ['em spaces', '\u2003\u2003'], ['line separators', '\u2028\u2029'],
  ['all JavaScript trim whitespace', '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'],
  ['number', 42], ['null', null],
]) {
  test('entering Unable to Complete rejects ' + label + ' reason', async () => {
    await seedProgress();
    const changes = { status: 'Unable to Complete', updatedAt: serverTimestamp() };
    if (reason !== undefined) changes.unableToCompleteReason = reason;
    await assertFails(updateDoc(doc(dbFor(), progressPath()), changes));
  });
}

test('direct Unable mutation denied even with a long nonblank reason', async () => {
  await seedProgress();
  await assertFails(updateDoc(doc(dbFor(), progressPath()), {
    status: 'Unable to Complete', unableToCompleteReason: 'x'.repeat(2001), updatedAt: serverTimestamp(),
  }));
});

test('direct Unable mutation denied even with multiline Unicode content', async () => {
  await seedProgress();
  const reason = '\u00a0\nEquipment\nunavailable\n\ufeff';
  assert.notEqual(reason.trim(), '');
  await assertFails(updateDoc(doc(dbFor(), progressPath()), {
    status: 'Unable to Complete', unableToCompleteReason: reason, updatedAt: serverTimestamp(),
  }));
});

const persistedStatuses = ['In Progress', 'Completed', 'Unable to Complete'];
for (const from of persistedStatuses) {
  for (const to of [...persistedStatuses, 'Scheduled', 'Paused', 'Upcoming']) {
    const allowed = (from === 'In Progress' && ['Completed', 'Unable to Complete'].includes(to))
      || (['Completed', 'Unable to Complete'].includes(from) && to === 'In Progress');
    if (allowed) continue;
    test('FR-9 invalid transition ' + from + ' to ' + to + ' denied', async () => {
      await seedProgress(from, { unableToCompleteReason: 'Existing reason' });
      await assertFails(updateDoc(doc(dbFor(), progressPath()), {
        status: to, unableToCompleteReason: 'Valid reason', updatedAt: serverTimestamp(),
      }));
    });
  }
}

test('progress updates protect identity and week even if alternate work is assigned', async () => {
  await seedProgress();
  const db = dbFor();
  for (const changes of [
    { scheduledWorkId: 'work-3' }, { weekStart: otherWeek }, { weekStart: deleteField() },
  ]) await assertFails(updateDoc(doc(db, progressPath()), { ...changes, status: 'Completed', updatedAt: serverTimestamp() }));
});

for (const field of ['assignedUids', 'title', 'locationId', 'publishedAt', 'currentVersion', 'team', 'employeeId']) {
  test('progress create/update rejects scheduling or identity injection ' + field, async () => {
    const db = dbFor();
    await assertFails(setDoc(doc(db, progressPath()), progress({ [field]: 'Forged' })));
    await seedProgress();
    await assertFails(updateDoc(doc(db, progressPath()), {
      [field]: 'Forged', status: 'Completed', updatedAt: serverTimestamp(),
    }));
  });
}

test('progress update requires fresh server/request-time timestamp', async () => {
  await seedProgress();
  const ref = doc(dbFor(), progressPath());
  await assertFails(updateDoc(ref, { status: 'Completed' }));
  await assertFails(updateDoc(ref, { status: 'Completed', updatedAt: fixedTime }));
  await assertFails(updateDoc(ref, { status: 'Completed', updatedAt: 'now' }));
  await assertFails(updateDoc(ref, { status: 'Completed', publicationVersion: deleteField(), updatedAt: serverTimestamp() }));
});

test('republication preserves readable progress; client version migration remains denied', async () => {
  await seedProgress('Completed', { unableToCompleteReason: 'Prior reason' });
  await republish();
  const db = dbFor();
  const ref = doc(db, progressPath());
  const before = await assertSucceeds(getDoc(ref));
  assert.equal(before.data().status, 'Completed');
  assert.equal(before.data().publicationVersion, currentVersion);
  await assertFails(updateDoc(ref, { status: 'In Progress', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { status: 'In Progress', publicationVersion: 'v3', updatedAt: serverTimestamp() }));
  const after = await assertSucceeds(getDoc(ref));
  assert.equal(after.data().publicationVersion, currentVersion);
  assert.equal(after.data().unableToCompleteReason, 'Prior reason');
  await assertFails(getDoc(doc(db, itemPath())));
  await assertSucceeds(getDoc(doc(db, itemPath('work-1', 'v3'))));
});

test('republication removing assignment blocks progress updates', async () => {
  await seedProgress();
  await republish([coworkerUid]);
  await assertFails(updateDoc(doc(dbFor(), progressPath()), {
    status: 'Completed', publicationVersion: 'v3', updatedAt: serverTimestamp(),
  }));
});

test('owner reads/lists own progress; coworker get/list/update denied', async () => {
  await seedProgress();
  const ownDb = dbFor();
  await assertSucceeds(getDoc(doc(ownDb, progressPath())));
  await assertSucceeds(getDocs(collection(ownDb, 'employees/' + staffUid + '/taskProgress')));
  const db = dbFor(coworkerUid);
  await assertFails(getDoc(doc(db, progressPath())));
  await assertFails(getDocs(collection(db, 'employees/' + staffUid + '/taskProgress')));
  await assertFails(updateDoc(doc(db, progressPath()), { status: 'Completed', updatedAt: serverTimestamp() }));
});

test('supervisor monitors progress but cannot impersonate staff writes', async () => {
  await seedProgress();
  const db = dbFor(supervisorUid);
  await assertSucceeds(getDoc(doc(db, progressPath())));
  await assertSucceeds(getDocs(collection(db, 'employees/' + staffUid + '/taskProgress')));
  await assertFails(updateDoc(doc(db, progressPath()), { status: 'Completed', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, progressPath(staffUid, 'work-3')), progress({ scheduledWorkId: 'work-3' })));
  await seedRecords([[itemPath(), publishedItem('work-1', [supervisorUid])]]);
  await assertFails(setDoc(doc(db, progressPath(supervisorUid)), progress()));
});

test('unauthenticated progress get/list/create/update denied', async () => {
  await seedProgress();
  const db = dbFor(null);
  await assertFails(getDoc(doc(db, progressPath())));
  await assertFails(getDocs(collection(db, 'employees/' + staffUid + '/taskProgress')));
  await assertFails(setDoc(doc(db, progressPath(staffUid, 'work-3')), progress({ scheduledWorkId: 'work-3' })));
  await assertFails(updateDoc(doc(db, progressPath()), { status: 'Completed', updatedAt: serverTimestamp() }));
});

test('progress deletion denied to owner, coworker and supervisor', async () => {
  await seedProgress();
  for (const uid of [staffUid, coworkerUid, supervisorUid, null]) {
    await assertFails(deleteDoc(doc(dbFor(uid), progressPath())));
  }
});

// Nested notification ownership is independent of supervisor workforce reads.
test('owner reads and lists own minimum notifications without relatedShiftId', async () => {
  const db = dbFor();
  await assertSucceeds(getDoc(doc(db, notificationPath())));
  const result = await assertSucceeds(getDocs(query(
    collection(db, 'employees/' + staffUid + '/notifications'), orderBy('timestamp', 'desc'),
  )));
  assert.equal(result.size, 1);
});

test('staff, supervisor and unauthenticated callers cannot read another user notifications', async () => {
  for (const uid of [coworkerUid, supervisorUid, null]) {
    const db = dbFor(uid);
    await assertFails(getDoc(doc(db, notificationPath())));
    await assertFails(getDocs(collection(db, 'employees/' + staffUid + '/notifications')));
    await assertFails(updateDoc(doc(db, notificationPath()), { isRead: true }));
  }
});

test('owners including supervisor may toggle only boolean isRead', async () => {
  for (const uid of [staffUid, supervisorUid]) {
    const db = dbFor(uid);
    const ref = doc(db, notificationPath(uid));
    await assertSucceeds(updateDoc(ref, { isRead: true }));
    await assertSucceeds(updateDoc(ref, { isRead: false }));
    await assertFails(updateDoc(ref, { isRead: 'true' }));
    await assertFails(updateDoc(ref, { isRead: deleteField() }));
  }
});

for (const field of ['id', 'title', 'message', 'category', 'timestamp', 'relatedShiftId', 'recipientId']) {
  test('notification cannot mutate or inject content ' + field, async () => {
    const ref = doc(dbFor(), notificationPath());
    await assertFails(updateDoc(ref, { [field]: 'Forged', isRead: true }));
    if (notification()[field] !== undefined) {
      await assertFails(updateDoc(ref, { [field]: deleteField(), isRead: true }));
    }
  });
}

for (const uid of [staffUid, supervisorUid, null]) {
  test('notification client create/delete denied for ' + uid, async () => {
    const db = dbFor(uid);
    await assertFails(setDoc(doc(db, 'employees/' + staffUid + '/notifications/new'), { ...notification(), id: 'new' }));
    await assertFails(deleteDoc(doc(db, notificationPath())));
  });
}

// All denied surfaces exercise real existing documents as well as new writes.
for (const name of deniedCollections) {
  for (const uid of [staffUid, supervisorUid, null]) {
    test(name + ' get/list/create/update/delete denied for ' + uid, async () => {
      const db = dbFor(uid);
      await assertFails(getDoc(doc(db, name + '/record-1')));
      await assertFails(getDocs(collection(db, name)));
      await assertFails(setDoc(doc(db, name + '/new'), { status: 'Pending', employeeId: 'EMP-0001' }));
      await assertFails(updateDoc(doc(db, name + '/record-1'), {
        status: 'Approved', approvedByEmployeeId: 'EMP-ADMIN',
      }));
      await assertFails(deleteDoc(doc(db, name + '/record-1')));
    });
  }
}

test('staff leave ownership query is denied until implementation', async () => {
  await assertFails(getDocs(query(
    collection(dbFor(), 'leaveRequests'), where('employeeId', '==', 'EMP-0001'), orderBy('startDate', 'desc'),
  )));
});

test('raw shifts deny staff get/list and allow only supervisor administrative reads', async () => {
  const db = dbFor();
  await assertFails(getDoc(doc(db, 'shifts/shift-1')));
  await assertFails(getDocs(collection(db, 'shifts')));
  await assertFails(getDocs(query(collection(db, 'shifts'), where('shiftDate', '==', fixedTime))));
  const supervisorDb = dbFor(supervisorUid);
  await assertSucceeds(getDoc(doc(supervisorDb, 'shifts/shift-1')));
  await assertSucceeds(getDocs(collection(supervisorDb, 'shifts')));
  await assertFails(getDoc(doc(dbFor(null), 'shifts/shift-1')));
});

for (const uid of [staffUid, supervisorUid, null]) {
  test('raw shift create/progress mutation/delete denied for ' + uid, async () => {
    const db = dbFor(uid);
    await assertFails(setDoc(doc(db, 'shifts/new'), legacyShift('new')));
    await assertFails(updateDoc(doc(db, 'shifts/shift-1'), { status: 'Completed' }));
    await assertFails(deleteDoc(doc(db, 'shifts/shift-1')));
  });
}

test('unknown employee subcollection denied despite readable parent', async () => {
  for (const uid of [staffUid, supervisorUid]) {
    const db = dbFor(uid);
    const path = 'employees/' + staffUid + '/privateData';
    await assertFails(getDoc(doc(db, path + '/record-1')));
    await assertFails(getDocs(collection(db, path)));
    await assertFails(setDoc(doc(db, path + '/new'), { confidential: true }));
    await assertFails(deleteDoc(doc(db, path + '/record-1')));
  }
});

test('atomic publication escalation and progress write cannot bypass trusted publication boundary', async () => {
  const db = dbFor();
  const batch = writeBatch(db);
  batch.update(doc(db, 'publishedRosters/' + weekStart), { currentVersion: staleVersion });
  batch.set(doc(db, progressPath()), progress({ publicationVersion: staleVersion }));
  await assertFails(batch.commit());
  assert.equal((await assertSucceeds(getDoc(doc(db, 'publishedRosters/' + weekStart)))).data().currentVersion, currentVersion);
  assert.equal((await assertSucceeds(getDoc(doc(db, progressPath())))).exists(), false);
});

test('atomic employee role escalation cannot authorize location management', async () => {
  const db = dbFor();
  const batch = writeBatch(db);
  batch.update(doc(db, 'employees/' + staffUid), { roleId: 'supervisor-role' });
  batch.set(doc(db, 'locations/forged'), { name: 'Forged', active: true });
  await assertFails(batch.commit());
  assert.equal((await assertSucceeds(getDoc(doc(db, 'employees/' + staffUid)))).data().roleId, 'staff-role');
});

test('multiple assigned direct progress writes denied atomically', async () => {
  const db = dbFor();
  const batch = writeBatch(db);
  for (const id of ['work-1', 'work-3']) {
    batch.set(doc(db, progressPath(staffUid, id)), progress({ scheduledWorkId: id }));
  }
  await assertFails(batch.commit());
  const result = await assertSucceeds(getDocs(collection(db, 'employees/' + staffUid + '/taskProgress')));
  assert.equal(result.size, 0);
});
