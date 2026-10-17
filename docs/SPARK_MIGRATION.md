# Firebase Spark compatibility migration — 2026-10-05

Starting release: `30dec7ab761541a1075356d9b81c02bafe9aeac0`, clean working tree; local and remote `integration/final`, `development`, and `main` identical. Starting CI passed on all three branches. GitHub reported `DEPLOYMENTS_ENABLED` unset and zero deployments. No billing, provider settings or deployments were changed.

Production uses **Vercel Next.js trusted APIs + Firebase Spark Authentication/Firestore/rules/indexes + EAS mobile distribution**. No production Cloud Functions, Blaze plan or Firebase payment method is required. Frameworks, application manifests and lockfiles remain at the certified baseline, including Next 15.5.27, sharp 0.35.4, Expo 54.0.37, RN 0.81.5 and existing React/TypeScript/Firebase versions. Existing web Firebase Admin 14.5.0 is reused.

## Responsibilities and atomicity

| Retired worker | Current owner |
| --- | --- |
| `recordTaskProgress` | `POST /api/mobile/task-progress`, verified Auth/profile actor and trusted progress transaction |
| `queueOperationalNotifications` | Authoritative progress/publication operation derives recipients and notification content |
| `deliverOperationalNotifications` | Same transaction creates deterministic recipient inbox documents directly |

Mobile submits a Firebase ID token in `Authorization: Bearer …` and JSON `scheduledWorkId`, `weekStart`, `expectedStatus`, requested `status`, unique `requestId`, and `unableToCompleteReason` only when entering Unable. Week identifies the roster to verify; it is not proof of ownership. UID, Employee ID, role, actor, recipients, assignment and publication version are not accepted from mobile.

The existing Admin configuration verifies tokens with revocation checking. Within the transaction, the server reads `employees/{verifiedUid}`, its authoritative role, the published roster root, current immutable occurrence, existing progress and request receipt. Only Staff Members assigned to that current occurrence may mutate progress. Missing/invalid tokens return 401; nonstaff/unassigned requests return 403; archive/stale state/request-ID reuse returns 409; malformed input/illegal transitions/blank Unable reasons return 400. Unexpected failures return a safe 500 message.

The five canonical transitions are Scheduled → In Progress; In Progress → Completed/Unable to Complete; Completed/Unable to Complete → In Progress. No persisted Paused state is added. Absence of progress represents Scheduled. Reopen retains the prior inability reason. Republishing preserves stable scheduled-work progress; a later legitimate transition records the current authoritative version.

One Admin transaction writes `employees/{uid}/taskProgress/{scheduledWorkId}`, one `operationalEvents/{eventId}`, and all required `employees/{supervisorUid}/notifications/{notificationId}` records. Progress identity/week/version/status/reason and server timestamps are preserved. Event type is TaskStarted, TaskCompleted, TaskUnableToComplete or TaskReopened, with verified safe profile identity, authenticated-staff provenance, before/after, reason and trusted timestamps.

The event ID hashes the verified UID and request ID. The event also stores a normalized request fingerprint and original result as its durable receipt. Concurrent or lost-response retries return the same result and create no additional event/inbox writes. Reusing a request ID for a different action is rejected. Existing notification documents are never overwritten, including `isRead=true`. All reads precede transaction writes. Commit failure rolls back progress, event and required inbox creation together; success is returned only after commit.

Supervisor recipients come from authoritative role and employee documents in the same transaction, using the preserved Stage 7D active-supervisor rule. No fixture UID or ADMIN001 constant determines production recipients.

Publication still first commits the immutable snapshot. Its final pointer-switch transaction creates existing publication/assignment events exactly once and now also creates all required inbox records before committing the pointer. First/changed publication, removed/new assignees and critical coverage warnings preserve Stage 7D recipients/content and deterministic IDs. Failure leaves the previous pointer and event/inbox state unchanged. Retrying an already committed version does not reset inbox read state. Archive events remain in their existing trusted operation.

## Mobile, rules and pipeline

Live mobile uses the trusted API, retains ambiguous-failure request IDs for retries, checks account identity before/after asynchronous work and reports success only for a valid successful response. Firestore remains the authorized progress reload source. Existing synchronous action locks and demo isolation are preserved. Confirmed success clears cached request IDs; ambiguous failures retain them. Later actions, including after another device reopens work, therefore produce fresh events.

Rules now deny all client progress creates/updates/deletes; authorized own reads and supervisor monitoring reads remain. Original cross-user/privacy denials are retained. The original 193-test security suite remains the same size; superseded direct-write positives now prove denial and trusted seeded progress readability. Additional rules remain intact.

Active Firebase delivery is exactly `--only firestore:rules,firestore:indexes`. `firebase.json` contains no Functions codebase. CI installs no Functions runtime and runs no Functions emulator. Pure historical Functions tests remain; the historical actual-trigger test is explicitly retired and superseded by the Next HTTP E2E. `functions/` and Stage 7C/7D evidence are retained and clearly marked historical. Never run retired triggers alongside the new writer.

`DEPLOYMENTS_ENABLED` remains false/unset. Gated Vercel and EAS delivery behavior is retained. No deployment is part of this migration.

## Production environment

Web/Vercel uses the six matching public fields:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=<public Firebase value>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<public Firebase value>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=said-ops
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<public Firebase value>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<public Firebase value>
NEXT_PUBLIC_FIREBASE_APP_ID=<public Firebase value>
NEXT_PUBLIC_ROSTER_BACKEND=firestore
NEXT_PUBLIC_MONITORING_BACKEND=firestore
SAID_ROSTER_BACKEND=firestore
SAID_FIREBASE_PROJECT_ID=said-ops
SAID_FIREBASE_SERVICE_ACCOUNT_JSON=<server-only runtime credential>
```

Leave all emulator variables unset in production web runtime. Existing explicit false opt-out flags are also accepted, while demo project IDs or emulator endpoints are rejected. Keep credentials out of public variables/source.

Mobile uses matching `EXPO_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, and `APP_ID` (each prefixed `EXPO_PUBLIC_FIREBASE_`), plus:

```dotenv
EXPO_PUBLIC_ROSTER_BACKEND=firestore
EXPO_PUBLIC_MONITORING_BACKEND=firestore
EXPO_PUBLIC_FIREBASE_EMULATORS_ENABLED=false
EXPO_PUBLIC_API_BASE_URL=<deployed trusted web/API HTTPS origin>
```

The origin is intentionally not hard-coded before deployment. Local HTTP is permitted only with explicit mobile emulator opt-in. Vercel/EAS account setup and hosted smoke evidence remain the existing deployment prerequisites. Spark quotas remain applicable; exceeding them must fail visibly without enabling billing.

## Verification evidence

Focused validation passed: trusted progress/mobile/workflow deterministic tests; original 193 + additional 42 rules tests; affected progress/notification/monitoring/archive emulator suites; actual Next HTTP E2E. The portable test host runs real Next routing in one owned process and exits cleanly on Windows/Linux. No Functions emulator is involved.

The HTTP E2E proves ADMIN001 publication; STAFF001 authentication and mobile adapter Start; supervisor In Progress monitoring; Complete and Completed Reopen; a second task Unable/reopen; authoritative supervisor inbox delivery; concurrent retry idempotency and read-state preservation; STAFF002 assignment isolation; direct own/cross-user Firestore-write denial; and archive blocking new progress. ADMIN001/STAFF001/STAFF002 are disposable emulator business identities only.

Complete final release totals, log hashes, unchanged dependency evidence and the exact changed-file list are recorded in [spark-migration-summary.json](evidence/spark-migration-summary.json). Historical certification evidence is preserved separately. CI/branch synchronization is verified against the resulting commit after the full local release gate passes.

Provider references: [Admin SDK on an existing server](https://firebase.google.com/docs/admin/setup), [Firestore atomic transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Firestore free quotas and paid features](https://firebase.google.com/docs/firestore/quotas), [Expo public environment variables](https://docs.expo.dev/guides/environment-variables/).
