# Stage 6B: real workforce and trusted published rosters

Starting SHA: `67eeb989e3163a9c18e8e676b9fd89baa53f07f4`, branch `integration/final`.
Authority: WORKSTREAM_5_INTEGRATION_CONTRACT.md. Rules and indexes are unchanged.
This stage connects real workforce identities, supervisor publication, and assigned staff reads.
FR-9 progress persistence, supervisor progress, notifications/history and leave remain deferred.

Stage 6C now supplies FR-9 persistence and supervisor progress reads; see
[STAGE_6C_PROGRESS_INTEGRATION.md](STAGE_6C_PROGRESS_INTEGRATION.md). The statements below
describe the Stage 6B baseline; notifications/history and leave remain deferred.

## Explicit modes

| Variable | Default | Integration value |
| --- | --- | --- |
| NEXT_PUBLIC_ROSTER_BACKEND | fixture | firestore |
| SAID_ROSTER_BACKEND (server only) | fixture | firestore |
| EXPO_PUBLIC_ROSTER_BACKEND | fixture | firestore |

Web's switch jointly selects real workforce and trusted publication; server activation is
independent and must also be explicit. Firebase configuration never selects these modes.
Fixture mode retains certified local workforce, roster publication, schedules and tasks.
Mobile fixture mode performs no publication reads. WS4 remains memory-only/blocked live.

Supervisor workforce reads employees through existing client rules. Staff.id and employeeId
are the business ID shown in UI; Staff.uid is the distinct Auth identity. Duplicate/malformed
business IDs produce a visible error. Employee profiles default to Available; session controls
do not write availability, leave or other workforce fields. A local employee without UID may
be edited locally, but assigning it blocks integrated publication with its business ID in the
error. Refresh reloads provisioned identities while preserving same-session availability.

## Trusted publisher

POST `/api/rosters/publish` is a Node.js Next Route Handler. Firebase Admin 14.5.0 is confined
to a server-only module; no credential or Admin module enters browser/mobile bundles.
The server verifies the current Bearer ID token (including revocation), reads employees/{uid},
resolves its roleId and requires the exact Supervisor/Administrator role. Staff, missing and
invalid tokens fail. Payload role, employeeId or UI routing cannot authorize a caller.

Server emulator mode requires SAID_FIREBASE_EMULATORS_ENABLED=true, the fixed
SAID_FIREBASE_PROJECT_ID=demo-said-5ce3e and explicit loopback host:port values for
FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST. No credential is supplied.
It rejects mismatched public/server projects, production emulator projects and public hosts.
The named Admin app survives Next module reloads. Restart after changing environment values.

Non-emulator setup requires SAID_ROSTER_BACKEND=firestore, SAID_FIREBASE_PROJECT_ID matching
the client project, SAID_FIREBASE_EMULATORS_ENABLED=false, and server-side Application Default
Credentials. Unset both emulator-host variables. A hosting service may provide ADC; otherwise
GOOGLE_APPLICATION_CREDENTIALS points to an external service-account file on the server.
Never commit that file or place credential values in NEXT_PUBLIC/EXPO_PUBLIC variables.
Production account provisioning, hosting credentials and deployment have not been completed.

Official references: [Admin setup](https://firebase.google.com/docs/admin/setup),
[Auth emulator](https://firebase.google.com/docs/emulator-suite/connect_auth),
[Firestore emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore),
and [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/).

## Snapshot and identity validation

The request supplies weekStart, explicit confirmCoverage and items with WS2 IDs, timing,
locationId, requiredStaff, isCritical, optional dutyId/template priority, and assignedEmployees
references `{uid,employeeId}`. It accepts no client-supplied team/private fields. The server
validates Monday/week date range, unique path-safe IDs, nonblank title, valid HH:mm interval,
integer staffing 1–100, critical boolean, locations and employee/Auth/role identity matches.
Team names/job categories are derived from profiles, never request projections.

For each version:

```text
publishedRosters/{weekStart}
  weekStart, currentVersion, publishedAt
publishedRosters/{weekStart}/versions/{uuid}
  weekStart, version, itemCount, publishedAt
publishedRosters/{weekStart}/versions/{uuid}/items/{scheduledWorkId}
  scheduledWorkId, weekStart, date, title, description, startTime, endTime,
  locationId, requiredStaff, assignedUids, isCritical, team, dutyId?, priority?
```

`team` contains only employeeId, displayName and jobCategory. This assignment model has no
primary-assignee flag, so none is fabricated. Auth UIDs are confined to assignedUids; contact,
authorization, leave and other private fields never enter the team projection.

Each publish/republish creates a UUID version and atomically creates its version record and
all items with create-only batch writes. An existing version cannot be overwritten. Limit:
400 items (401 document writes including the version record); overflow is rejected, never
truncated. A second transaction checks the committed version and switches the metadata pointer
last. Both timestamps are trusted server timestamps. Failure before that switch leaves the
previous pointer intact; an orphan complete version is harmless and is not selected by staff.
Concurrent publications each remain complete; the last successful pointer transaction wins.

Active and missing-active legacy areas are accepted. Retired/missing/invalid areas are rejected
for a new publication, including republish; prior immutable versions preserve historical
location references and names remain resolvable. Correct the draft area before publishing again.

Incomplete coverage/critical warnings and Publish Anyway remain. Without explicit confirmation,
incomplete staffing is rejected. A confirmed completely uncovered duty is retained with empty
assignedUids/team and is not readable by staff. Every listed assignment must still resolve to
a real Auth UID/profile. An unprovisioned employee can never be converted to an empty assignment.

isCritical is WS2's explicit work snapshot. Priority is sent only when resolved from its WS2
template; ad-hoc priority remains absent in persistence. Mobile maps absent/Medium/Low to its
existing presentation label Normal and High to High. This does not fabricate persisted priority.

## Client behavior

Web Publish awaits the trusted endpoint before updating its local publication snapshot.
Failures show an error and preserve the prior snapshot/lifecycle. Edits made during a request
remain unpublished changes relative to the captured successful snapshot. Account switches
invalidate local completion. Default mode says publication is local to the session; integrated
success says published to staff. Drafts/templates remain local, and remote metadata is not yet
restored as an editable web draft after restart.

Mobile selects the device-local Monday and supports previous/next weeks, Today and Sync Now.
Only a valid authenticated staff profile enables reads in Firestore mode. It reads week metadata,
queries current-version items using assignedUids array-contains auth.uid, then checks the pointer
again. Reads explicitly require the server so offline cached results cannot conceal errors or
an obsolete version. A pointer change retries once; a further change is an ERROR, never stale data. No coworker
profiles or version parent records are queried. LOADING, ERROR, EMPTY and DATA are distinct;
errors have retry controls and never render a successful empty-week message. Account/week changes
immediately mask old data and ignore late responses.

One mapping supplies weekly duties and task details with authoritative scheduledWorkId, date,
timing, descriptions, canonical locations, critical flag, display priority and safe team.
Legacy tuple matching remains only when neither side has a stable ID. Published tasks have
isLive:false so the existing provisional raw-shift adapter is not activated. Their status starts
Scheduled and UI changes remain session-local; there are no taskProgress writes or progress reads.
No checklist, private note, primary teammate or execution timestamp is invented.

## Manual emulator preparation (no manual UI testing performed)

Use the Stage 6A runbook's exact emulator start, provisioning, public Firebase configuration
and client start commands. Start from the repository root in separate PowerShell terminals.
Add these variables to its web terminal BEFORE npm run dev:

```powershell
$env:NEXT_PUBLIC_ROSTER_BACKEND = 'firestore'
$env:SAID_ROSTER_BACKEND = 'firestore'
$env:SAID_FIREBASE_EMULATORS_ENABLED = 'true'
$env:SAID_FIREBASE_PROJECT_ID = 'demo-said-5ce3e'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
```

Add to its Expo terminal BEFORE starting Expo:

```powershell
$env:EXPO_PUBLIC_ROSTER_BACKEND = 'firestore'
```

For a physical phone, public Auth URL and Firestore host must use the development machine's
reachable LAN IP. Server-only Admin endpoints stay loopback. Do not assume a specific LAN IP.
In web, create a dated item in an active area, assign STAFF001/STAFF002 business IDs and publish.
The mobile reader must select the same week; the web's initial demo week is 2026-10-19 while
mobile starts at the current device week. This publication path is ready for subsequent manual
login/scheduling/publish/assignment-privacy checks; task-progress E2E is not ready.

## Automated verification

```powershell
node --test scripts/stage6a.test.cjs scripts/stage6b.test.cjs
$env:SAID_EMULATOR_PROVISION = 'true'
$testConfig = node scripts/create-stage6b-emulator-config.cjs
firebase emulators:exec --config $testConfig --only auth,firestore --project demo-said-5ce3e "node --test scripts/stage6a-provision.test.cjs && node --test scripts/stage6b-emulator.test.cjs"
```

The helper writes only a temporary loopback configuration with OS-allocated free ports and
the unchanged repository rules/indexes. Start it promptly after allocation. It does not stop
existing emulators or alter the manual configuration. Do not run against manual fixtures:
Stage 6A tests intentionally assert only fixture
roots before Stage 6B creates publications. Automated certification also requires full web,
mobile, 193-test security, WS1–WS4 and monitoring Jest regressions. The E2E tests exercise the
actual POST Route Handler with real Admin/Auth/Firestore operations; browser automation is
outside this stage.

Verified results: Stage 6B 37/37 deterministic tests and 10/10 real-emulator E2E tests;
Stage 6A 37/37 auth/session/routing tests and 5/5 real provisioning tests; security 193/193;
monitoring/web Jest 34/34; WS1, WS2 roster-final, WS3 save-lock/stable identity and WS4 safety
probes passed. Web npm ci/lint/default build and the explicitly enabled integration build;
mobile npm ci/typecheck/Expo public config; and repository hygiene passed. The test runtime
was Node 22.23.3/npm 10.9.9. Existing dependency versions remained unchanged; the sole new
direct dependency is web firebase-admin 14.5.0. Rules/indexes/security tests/contracts/CI and
mobile dependencies are unchanged. Admin implementation was absent from browser build chunks.

ADMIN001 login, real STAFF001/STAFF002 scheduling identities, trusted Publish, STAFF001 current
assigned reads and STAFF002 privacy filtering all passed service-level automated checks and
are prepared for later manual UI verification. Progress persistence/E2E is not ready and was
not implemented. No merge into development, deployment or Stage 6C work was performed.
