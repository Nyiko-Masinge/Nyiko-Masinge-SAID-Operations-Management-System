// Trusted TEST fixture writer. No Admin SDK, credentials, production endpoints or SDK fallback.
// Requires explicit opt-in, the fixed demo project, loopback emulator hosts and a TEST password.
const PROJECT_ID = 'demo-said-5ce3e';
const ACCOUNTS = [
  { employeeId: 'ADMIN001', firstName: 'Test', surname: 'Administrator', roleId: 'system-supervisor', jobCategory: 'Operations Supervisor' },
  { employeeId: 'STAFF001', firstName: 'Test', surname: 'Staff One', roleId: 'system-staff', jobCategory: 'Nurse' },
  { employeeId: 'STAFF002', firstName: 'Test', surname: 'Staff Two', roleId: 'system-staff', jobCategory: 'Veterinary Assistant' },
];
const normalAvailability = { normalState: 'Available', state: 'Available', effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveTo: null };
Object.assign(ACCOUNTS[0], { active: true, locationId: 'parvo', availability: normalAvailability, skills: ['Operations Planning'], revision: 1 });
Object.assign(ACCOUNTS[1], { active: true, locationId: 'parvo', availability: normalAvailability, skills: ['Ward Care', 'Animal Handling'], revision: 1 });
Object.assign(ACCOUNTS[2], { active: false, locationId: 'ward-b', availability: { ...normalAvailability, state: 'Training', effectiveFrom: '2026-10-06T06:00:00.000Z', effectiveTo: '2026-10-06T10:00:00.000Z' }, skills: ['Animal Handling'], revision: 1 });
const TEMPLATES = [
  { id: 'fixture-ward-round', name: 'Ward Round', description: 'Routine ward care', locationId: 'parvo', defaultStartTime: '08:00', durationMinutes: 60, recurrence: 'Daily', requiredStaff: 1, priority: 'High', isCritical: false, active: true, requiredSkills: ['Ward Care'], requirements: ['Check ward equipment'], revision: 1 },
  { id: 'fixture-oxygen-check', name: 'Oxygen Check', description: 'Check oxygen supply', locationId: 'ward-b', defaultStartTime: '11:00', durationMinutes: 30, recurrence: 'Mon, Wed, Fri', requiredStaff: 2, priority: 'Low', isCritical: true, active: true, requiredSkills: ['Animal Handling'], requirements: ['Record oxygen reading', 'Report equipment problems'], revision: 1 },
];
const ROLES = [
  { id: 'system-supervisor', name: 'Supervisor/Administrator' },
  { id: 'system-staff', name: 'Staff Member' },
];
const LOCATIONS = [
  { id: 'parvo', name: 'Parvo Ward', active: true },
  { id: 'ward-b', name: 'Ward B', active: true },
  { id: 'legacy-area', name: 'Legacy Test Area' },
  { id: 'retired-area', name: 'Retired Test Area', active: false },
];

function loopbackEndpoint(value, name) {
  // No URLs, credentials, paths, public/LAN hosts or implicit/default ports accepted.
  const match = /^(127\.0\.0\.1|localhost|\[::1\]):([0-9]+)$/.exec(value ?? '');
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 65535) {
    throw new Error(`${name} must be an explicit loopback host:port.`);
  }
  return `http://${value}`;
}

function provisioningConfig(env) {
  if (env.SAID_EMULATOR_PROVISION !== 'true') throw new Error('Set SAID_EMULATOR_PROVISION=true for emulator-only test provisioning.');
  for (const key of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
    if (env[key] && env[key] !== PROJECT_ID) throw new Error(`${key} must equal ${PROJECT_ID}.`);
  }
  const authUrl = loopbackEndpoint(env.FIREBASE_AUTH_EMULATOR_HOST, 'FIREBASE_AUTH_EMULATOR_HOST');
  const firestoreUrl = loopbackEndpoint(env.FIRESTORE_EMULATOR_HOST, 'FIRESTORE_EMULATOR_HOST');
  if (typeof env.SAID_E2E_TEST_PASSWORD !== 'string' || env.SAID_E2E_TEST_PASSWORD.length < 8) {
    throw new Error('Set SAID_E2E_TEST_PASSWORD to a disposable test-only password of at least 8 characters.');
  }
  return { projectId: PROJECT_ID, authUrl, firestoreUrl, password: env.SAID_E2E_TEST_PASSWORD };
}

function alias(employeeId) {
  return employeeId.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '') + '@saidops.internal';
}

async function request(url, body, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Emulator request failed (${response.status}) at ${new URL(url).pathname}. Check emulator logs; rerun repairs partial provisioning.`);
  return response.json();
}

function fields(record) {
  const encode = value => value === null ? { nullValue: null } :
    Array.isArray(value) ? { arrayValue: { values: value.map(encode) } } :
    typeof value === 'object' ? { mapValue: { fields: fields(value) } } :
    typeof value === 'boolean' ? { booleanValue: value } :
    typeof value === 'number' ? { integerValue: String(value) } : { stringValue: value };
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, encode(value)]));
}

async function provision(env = process.env, fetchImpl = fetch) {
  const config = provisioningConfig(env); // All guards run before any network call.
  const accountsUrl = `${config.authUrl}/identitytoolkit.googleapis.com/v1/projects/${config.projectId}/accounts:batchGet`;
  const users = [];
  // Follow pagination to reuse fixtures even when an emulator contains other accounts.
  let nextPageToken;
  do {
    const page = await request(accountsUrl + (nextPageToken ? `?nextPageToken=${encodeURIComponent(nextPageToken)}` : ''), undefined, fetchImpl);
    users.push(...(page.users ?? []));
    nextPageToken = page.nextPageToken;
  } while (nextPageToken);
  const profiles = [];
  for (const account of ACCOUNTS) {
    const email = alias(account.employeeId);
    const existing = users.find(user => user.email === email);
    const result = await request(`${config.authUrl}/identitytoolkit.googleapis.com/v1/accounts:${existing ? 'update' : 'signUp'}?key=fake-api-key`, {
      targetProjectId: config.projectId, email, password: config.password,
      ...(existing ? { localId: existing.localId } : {}),
      displayName: `${account.firstName} ${account.surname}`,
    }, fetchImpl);
    const uid = result.localId;
    if (typeof uid !== 'string' || !uid || uid.includes('/')) throw new Error('Auth emulator returned an invalid UID. No profiles were written.');
    if (existing && uid !== existing.localId) throw new Error('Auth emulator changed an existing fixture UID. No profiles were written.');
    profiles.push({ uid, email, profile: { ...account } });
  }
  const documentRoot = `projects/${config.projectId}/databases/(default)/documents`;
  const writes = [
    ...ROLES.map(({ id, ...role }) => ({ path: `roles/${id}`, record: role })),
    ...LOCATIONS.map(({ id, ...location }) => ({ path: `locations/${id}`, record: location })),
    ...profiles.map(({ uid, profile }) => ({ path: `employees/${uid}`, record: profile })),
    ...TEMPLATES.map(({ id, ...record }) => ({ path: `dutyTemplates/${id}`, record })),
  ].map(({ path, record }) => {
    const planning = path.startsWith('employees/') || path.startsWith('dutyTemplates/');
    const actor = profiles.find(person => person.profile.employeeId === 'ADMIN001').uid;
    return { update: { name: `${documentRoot}/${path}`, fields: fields(planning ? { ...record, createdBy: actor, updatedBy: actor } : record) },
      ...(planning ? { updateTransforms: ['createdAt','updatedAt'].map(fieldPath => ({ fieldPath, setToServerValue: 'REQUEST_TIME' })) } : {}) };
  });
  await request(`${config.firestoreUrl}/v1/${documentRoot}:commit`, { writes }, fetchImpl);
  return { projectId: config.projectId, accounts: profiles.map(({ uid, email, profile }) => ({ uid, email, ...profile })), roles: ROLES, locations: LOCATIONS };
}

module.exports = { PROJECT_ID, ACCOUNTS, ROLES, LOCATIONS, TEMPLATES, fields, alias, provisioningConfig, provision, request };
if (require.main === module) {
  provision().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
