# Stage 6A: emulator identity foundation and session isolation

Starting integration SHA: `f979453bffa1408cff98768be8f023a2f7eff0bc`.
Scope: explicit emulator routing, test identity provisioning, Auth callback races and
session-local OpsProvider isolation. No roster/progress/notification persistence is enabled.

This records the Stage 6A baseline. For the subsequent explicitly enabled workforce and
publication modes, use [the Stage 6B runbook](STAGE_6B_ROSTER_INTEGRATION.md).

## Routing and initialization

Both existing Firebase client boundaries use an explicit `*_FIREBASE_EMULATORS_ENABLED=true`
opt-in. Missing/false flags keep normal Firebase behavior. Enabled mode requires a `demo-`
project ID, an HTTP Auth URL with an explicit port, and Firestore host/port. Invalid opt-in
configuration fails before creating/using services; it never falls back to production.
Static NEXT_PUBLIC/EXPO_PUBLIC references preserve bundler environment inlining.

Auth and Firestore connect before their getters return, once per actual service instance.
Instance registries survive development module reloads. Mobile preserves one initializeAuth
with AsyncStorage persistence per Firebase app; no second Auth authority or app is introduced.
Restart the dev server and reload clients completely after changing environment/routing.

`firebase.emulators.json` references the unchanged authoritative root rules/indexes. It binds
Auth/Firestore on all local interfaces so a physical phone can reach the development machine;
the emulator UI remains loopback-only. Use a trusted development network, not public hosting.
The existing firebase.json, security rules, dependencies and CI are unchanged.

Firebase guidance: [Auth emulator connection](https://firebase.google.com/docs/emulator-suite/connect_auth),
[Firestore emulator connection](https://firebase.google.com/docs/emulator-suite/connect_firestore).
Expo compatibility was checked against the [SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/)
and its [Firebase JS SDK guide](https://docs.expo.dev/guides/using-firebase/).

## Test provisioning

Run `scripts/provision-emulator-e2e.cjs` from the repository root. It uses Node fetch and
emulator REST APIs with the emulator-only owner token; no new packages or credentials.
It requires explicit SAID_EMULATOR_PROVISION=true, both emulator host variables and a
disposable password of at least eight characters. Only loopback host:port values are accepted;
LAN/public/URL/credential endpoints and conflicting project environment values are rejected
before network access. The project is fixed to demo-said-5ce3e. Redirects are rejected.

The script creates missing Auth users, reuses existing fixture accounts by alias and updates
their disposable passwords on rerun. Profiles use the actual returned Auth UIDs. One Firestore
commit replaces only the nine named fixture documents; unrelated data is not deleted.
If a service fails partway through, correct the endpoint/service and rerun to repair fixtures.
The password is never printed or committed. The three accounts share the supplied TEST password.

| Employee ID | Internal alias | Role reference | Job display label |
| --- | --- | --- | --- |
| ADMIN001 | admin001@saidops.internal | system-supervisor | Operations Supervisor |
| STAFF001 | staff001@saidops.internal | system-staff | Nurse |
| STAFF002 | staff002@saidops.internal | system-staff | Veterinary Assistant |

Profiles contain employeeId, firstName, surname, roleId and jobCategory; no contact fixtures.
Job category is display data, never authorization. Role documents contain the exact names
Supervisor/Administrator and Staff Member. Their identities come from their document paths.
Locations: parvo (Parvo Ward, active:true), ward-b (Ward B, active:true), legacy-area
(Legacy Test Area, no active field), retired-area (Retired Test Area, active:false).
No raw shifts, leave, publications, progress, alerts, history, notes or notifications are seeded.

The old mobile seed remains a historical utility and must not be used for this foundation.
Provisioning does not replace OpsProvider's demo workforce with a persisted workforce model;
that connection is outside Stage 6A.

## Later manual preparation commands (PowerShell, separate terminals)

Use the locked Node/npm and Firebase CLI toolchain. Start every block from the repository root.
No manual UI testing was performed in this stage. Emulators must be running before provisioning
or starting the clients. If the configured ports are occupied, close the owning emulator normally
before starting another session; do not run the automated rules suite against manual fixtures.

### 1. Start emulators

```powershell
firebase emulators:start --config firebase.emulators.json --only auth,firestore --project demo-said-5ce3e
```

### 2. Provision accounts and areas

```powershell
$env:SAID_EMULATOR_PROVISION = 'true'
$env:GCLOUD_PROJECT = 'demo-said-5ce3e'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$testPassword = Read-Host 'Disposable emulator-only password (8+ characters)' -AsSecureString
$env:SAID_E2E_TEST_PASSWORD = [System.Net.NetworkCredential]::new('', $testPassword).Password
try { node scripts/provision-emulator-e2e.cjs }
finally { Remove-Item Env:SAID_E2E_TEST_PASSWORD }
```

### 3. Start web against emulators

```powershell
$env:NEXT_PUBLIC_FIREBASE_API_KEY = 'fake-api-key'
$env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'demo-said-5ce3e.firebaseapp.com'
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-said-5ce3e'
$env:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'demo-said-5ce3e.appspot.com'
$env:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '000000000000'
$env:NEXT_PUBLIC_FIREBASE_APP_ID = '1:000000000000:web:emulator-only'
$env:NEXT_PUBLIC_FIREBASE_EMULATORS_ENABLED = 'true'
$env:NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL = 'http://127.0.0.1:9099'
$env:NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST = '127.0.0.1'
$env:NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT = '8080'
$env:NEXT_PUBLIC_MONITORING_BACKEND = 'memory'
Set-Location 'SAID Ops/web-app'
npm run dev
```

### 4. Start mobile against emulators

Replace YOUR_DEVELOPMENT_MACHINE_LAN_IP with the development machine's reachable LAN IP.
The phone and development machine must be able to reach each other. Both the Auth URL and
Firestore host need that address; localhost on a phone refers to the phone itself.
Do not use 0.0.0.0 as a client destination. Desktop clients can use 127.0.0.1 instead.

```powershell
$developmentHost = 'YOUR_DEVELOPMENT_MACHINE_LAN_IP'
$env:EXPO_PUBLIC_FIREBASE_API_KEY = 'fake-api-key'
$env:EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'demo-said-5ce3e.firebaseapp.com'
$env:EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'demo-said-5ce3e'
$env:EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET = 'demo-said-5ce3e.appspot.com'
$env:EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '000000000000'
$env:EXPO_PUBLIC_FIREBASE_APP_ID = '1:000000000000:android:emulator-only'
$env:EXPO_PUBLIC_FIREBASE_EMULATORS_ENABLED = 'true'
$env:EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL = "http://${developmentHost}:9099"
$env:EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST = $developmentHost
$env:EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT = '8080'
$env:EXPO_PUBLIC_MONITORING_BACKEND = 'memory'
Set-Location 'SAID Ops/mobile-app'
npx --no-install expo start --clear --lan
```

These prepare identity/location and fixture UI tests. Staff schedules/progress and web
publication remain local; the supervisor-to-staff persisted workflow is not claimed ready.

## Session fixes

Both AuthProviders invalidate pending profile lookups on every Auth callback, explicit logout
and unmount. They clear old profile state while checking a new user. Successes and failures
must match the current generation and Firebase currentUser UID. Stale failures cannot sign out
the newer account. Explicit logout invalidates before awaiting Firebase.

OpsProvider clears its browser workforce, templates, scheduled work, published snapshots,
refs/counters and derived assignments when authenticated session identity changes. An immediate
owner check masks previous values before reset effects run. Shared locations are only refetched;
no Firestore location is written/deleted by a reset. Same-UID rerenders do not loop/reset.
The workforce save message now explicitly says local session and no Firestore persistence.
Roster publication copy/behavior is unchanged.

## Verification commands

```powershell
node --test scripts/stage6a.test.cjs
$env:SAID_EMULATOR_PROVISION = 'true'
firebase emulators:exec --config firebase.emulators.json --only auth,firestore --project demo-said-5ce3e "node --test scripts/stage6a-provision.test.cjs"
```

Use a fresh isolated emulator session for the five provisioning tests; they assert exactly
three Auth users and only the authorized fixture roots. The tests generate a disposable
password when none is provided and prove password rotation/idempotent UID reuse.
The accumulated WS1/WS2/WS3/WS4 and 193-test security gates are also required before push.

Verified Stage 6A results: 37/37 deterministic auth/session/routing/guard tests, 5/5 real
Auth/Firestore provisioning tests, 34/34 web Jest tests, and 193/193 Firestore security tests.
Web npm ci, lint, build and roster-final; mobile npm ci, typecheck and Expo public config;
and the WS1 location, WS3 save-lock/scheduledWorkId/Auth and WS4 safety probes all passed.
The generated next-env.d.ts route reference was restored and web lint passed again.
Certification used Node 22.23.3/npm 10.9.9 with the existing lockfiles unchanged.
Real provisioning tests used isolated Auth 9097/Firestore 8082 ports; the security suite used
isolated Auth 9096/Firestore 8083 ports. Neither test run used the manual 9099/8080 session.
No manual UI testing, deployment, development merge or Stage 6B work was performed.
