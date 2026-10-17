# Monitoring, alerts, history and notifications: integration notes

Branch: `feature/monitoring-history`. This file records what the branch does, what it deliberately
does **not** do, and which shared contracts it needs central integration to define. Nothing here
should be read as an agreed contract unless a later section says so.

## What the branch provides

| Area | Web (Next.js) | Mobile (Expo) |
|---|---|---|
| Alerts | Detected from the roster (unassigned, understaffed, overlapping, unavailable staff); resolve, override with a note | not applicable |
| History | Audit trail of staff, duty, assignment and alert-resolution events | not applicable |
| Notes | Operational notes attached to an alert | not applicable |
| Notifications | Assignment-change derivation exists; delivery is disabled | Tray/list/detail support local demo notifications; requested live mode reports unavailable |

## Data modes and safe deferral

Both clients default to local in-memory demo repositories even when Firebase is configured.
Web uses NEXT_PUBLIC_MONITORING_BACKEND; mobile uses EXPO_PUBLIC_MONITORING_BACKEND.
Only the literal firestore mode requests live access. Missing configuration is a visible
configuration error; the mobile client also waits for Firebase Auth restoration and requires
an authenticated UID. Demo staff identity is never used for live access.

All live requests currently report integration pending, including authenticated requests:
the provisional notification/history paths and permissions are not approved. There is no
environment flag that overrides this hold. Factories return unavailable repositories; direct
Firestore factory/adapter access is also blocked. No Firestore subscriptions or writes occur.

OpsProvider now combines WS1 shared locations and authenticated access with WS2 session-local ScheduledWork. Monitoring reads dated occurrence snapshots (including ad-hoc items), not an independent assignment store. Its alert reconciliation and automatic history/notification
watchers run only in local demo mode; they are skipped for requested live mode. Re-enabling
live reconciliation requires persisted live operational inputs and approved trusted reconciliation/permissions. WS1 now supplies authenticated actors. Do not map fixtures into live data.

Mobile notifications distinguish loading, failure, successful empty and data states. Subscription
errors and read-write failures are shown in the tray/list/detail UI; failed writes return false.
Notes distinguish initial loading, failure and a successfully empty result.

## Provisional contracts (proposed by this branch, not agreed)

These collections exist because the features needed somewhere to store data. Their shapes are
proposals for central integration to accept, change or replace.

| Collection | Fields |
|---|---|
| `alerts` | `key`, `origin` (Detected/Reported), `type`, `priority`, `state` (Open/Acknowledged/Resolved), `title`, `details`, `area`, `dutyId?`, `staffIds?`, `raisedAt`, `resolvedAt?`, `resolvedBy?`, `resolutionNote?` |
| `auditLogs` | `reference`, `timestamp`, `actor {id,name,role}`, `category`, `action`, `summary`, `details`, `area`, `entityType`, `entityId?`, `before?`, `after?` (follows NFR-27) |
| `notes` | `entityType`, `entityId`, `text`, `author`, `createdAt` |
| `notifications` | `recipientId`, `category` (Emergency/Roster/TaskUpdate/CriticalDuty/Equipment/Facility), `title`, `message`, `createdAt`, `isRead`, `relatedDutyId?`, `relatedAlertId?`, `issuedBy?`, `deliveryStatus` |

Composite indexes needed: `alerts (origin, state)` and `notes (entityType, entityId, createdAt)`, both
in `firestore.indexes.json`.

### Where this differs from the report (9.1.11) and other branches

- **Notifications.** The report specifies a subcollection `employees/{id}/notifications` with
  `id, title, message, category, timestamp, isRead, relatedShiftId`. This branch built a top-level
  `notifications` collection with `recipientId` and different field names. WS5 has locked
  `employees/{uid}/notifications/{notificationId}` as the live path. Its approved nested adapter
  and trusted creation remain central work; the old top-level adapter stays blocked.
  The mobile mapping is isolated in `data/notifications/model.ts` and `firestoreRepository.ts`; the
  web writer is `notificationWriter.ts`.
- **`shifts` vs `duties`.** The report and mobile prototype say shifts; `OpsProvider` says duties.
  `relatedDutyId` follows `OpsProvider`.
- **Task-progress vocabulary.** The agreed canonical FR-9 states are exactly Scheduled, In Progress,
  Completed and Unable to Complete. Publication/monitoring states are separate. Event delivery,
  storage paths and permissions remain pending; no extra persisted progress state is introduced.
- **Mobile deep links.** `relatedDutyId` uses web duty ids, but the mobile task list is a separate
  local dataset with unrelated ids. Notifications therefore only link to the Roster screen, never to
  a specific task, until both apps read the same duties.

## Gaps this branch does not fill

Each needs a shared contract that affects more than one workstream, so none has been invented here.

### Publication events (FR-8)
- **Missing:** WS2 publication lifecycle is integrated and session-local, but no trusted persisted
  publication/event writer is connected. `RosterCreated` and `RosterPublished` exist in the audit action list but are never emitted.
- **Consequence:** "roster published" notifications and History entries are not produced.
- **Needed from the contract:** who emits the event; payload (roster id, date range, published-by,
  timestamp); final persisted publication writer and recipient delivery. WS5 already locks the
  published roster path/version and progress contract; this feature merge does not implement them.

### Progress events (FR-9)
- **Missing:** no integrated event path for a status change made on mobile to reach the web.
  The four canonical FR-9 states are agreed.
- **Consequence:** the Overdue and Unable to Complete alert types cannot be detected (only seeded demo
  examples exist, and only in demo mode); the Dashboard Completed and In Progress cards show "—";
  `DutyStatusChanged` is never emitted; there are no "critical duty approaching/overdue" notifications.
- **Needed from the contract:** the event delivery/transition contract; the event shape (duty id,
  from, to, actor, timestamp, reason for Unable to Complete). WS2 already supplies isCritical
  independently of priority; live event delivery remains deferred.

### Archive and retention (FR-15, NFR-28)
- **Missing:** no roster archive concept, and retention periods are unconfirmed by SAID.
- **Consequence:** History is one growing list capped at the latest 500 entries per view; nothing is
  archived or expired; `Export History` exports what is currently filtered on screen.
- **Needed from the contract:** what "archived" means for a roster; whether History entries move with
  it; retention period and who may delete (live audit access is currently denied by WS5).

## Dashboard values

| Value | Source | Status |
|---|---|---|
| Attention Required, Operational Alerts, area "Attention" | demo monitoring alerts; unavailable on a blocked live request | Demo / integration pending |
| Staff Scheduled, Staff Unavailable, Total Duties, area duty counts | session-local ScheduledWork/workforce in `OpsProvider` | Explicitly labelled Demo data; unavailable during location loading/failure |
| Completed, In Progress | needs progress events | Unavailable, shows "—" |
| Today's Activity | fixture in `data/operations.ts` | Tagged "Demo data" |
| Area names | WS1 shared operational areas | Shared names; associated monitoring counts remain local demo values |

## Other known limitations

- Demo detection/history run locally in the browser. Live reconciliation and notification writes
  are disabled; trusted server logic and concurrency handling remain central integration.
- Root WS5 rules remain unchanged and deny provisional alerts/history/notes and top-level notifications.
- Actors now use WS1 authenticated UID, profile name and application role. Local mutations require
  that identity; repositories and watcher baselines reset per account.
- Resolving an alert and recording it in History are two separate writes. If the second fails the user
  is told exactly that, but the two are not atomic.
- Alerts assignment uses WS2 assignScheduled and retains its duplicate/unavailable/overlap checks.
  Monitoring never owns a second mutable assignment model.
- `NoteAdded` and `SystemBackup` exist in the audit action list but nothing emits them.

## Live adapter hold

Notification derivation and demo history remain available locally. The factories and direct
provisional adapters block live use; no files need to be removed to enforce the hold. A mode
flag cannot release it. WS5 already locks nested notification paths and UID identity. Central integration must implement
the approved nested adapter, operational event inputs and trusted writers before changing the hold.

## Focused verification

Run node scripts/probe-ws4-safety.cjs from the repository root using existing installed
TypeScript. It performs no network requests or Firebase writes. It covers the backend/auth
boundaries, provider loading/error/empty/write failure states, fixture reconciliation hold,
notes initial states and approved runtime/lockfile consistency. Existing web Jest tests remain
in data/monitoring; run npm test -- --runInBand with matching installed test dependencies.
