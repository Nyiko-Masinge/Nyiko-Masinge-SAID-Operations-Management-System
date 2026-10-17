# Stage 6C: secure staff progress and supervisor visibility

Starting SHA: `bb4f5cb0426f93b473c502cad8247f651e2eb9b6`, branch `integration/final`.
Authority: WORKSTREAM_5_INTEGRATION_CONTRACT.md. No dependencies, rules or indexes changed.

## Modes and data flow

Reuse the Stage 6A emulator setup and Stage 6B publisher configuration. There is no new
progress switch. `EXPO_PUBLIC_ROSTER_BACKEND=firestore` enables nested progress for mobile
published tasks; `NEXT_PUBLIC_ROSTER_BACKEND=firestore` enables the supervisor reader.
Both default to fixture. Merely configuring Firebase does not activate progress.
Fixture reads/writes remain local and perform zero progress operations against Firestore.

Mobile loads its current assigned publication, then reads only
`employees/{auth.uid}/taskProgress/{scheduledWorkId}` for those tasks. Missing progress is
Scheduled. Existing progress supplies the effective status and any prior inability reason.
Home, weekly roster, task detail and local task counters share the merged task state.
Any failed progress read yields ERROR with no false Scheduled rows. Sync/refresh retries
the complete roster/progress read. Session and week changes mask old responses immediately.

Task Detail no longer reads or updates raw `shifts`. Its dedicated progress adapter uses
a client transaction: read current week metadata, read that version's known assigned item,
read own progress, verify the effective transition, then create/update progress. Creation
persists In Progress, never Scheduled. Identity and week remain immutable on updates.
Every write uses a server timestamp. Unable requires a trimmed nonblank reason. Reopen
preserves the previous reason. Pause and checklist remain local; there are no deletes.

The synchronous ref lock covers Start, Complete, Unable and Reopen. Visible saving begins
before the adapter call; confirmed state and callbacks follow successful persistence.
Failure keeps the last confirmed status, releases the lock and permits retry. Staff see
nontechnical messages and a Refresh roster control. Permission, assignment or stale-state
failures request refresh. Unmount/task scope changes suppress late success callbacks.

Republishing the same assigned stable ID does not reset existing progress. Read the
current publication and retain the old progress status/reason. A legitimate next action
migrates the progress publicationVersion inside the transaction. The displayed task's
publicationVersion still describes the snapshot it was loaded from; refresh updates that
snapshot. Assignment removal rejects stale writes and excludes the old assignment from
the supervisor's current roster join. Cross-week reuse of a progress ID fails safely;
IDs must remain stable and unique for scheduled occurrences.

## Supervisor dashboard

The existing Dashboard offers Published task progress in Firestore roster mode. Choose
a Monday and Refresh progress. The authenticated web SDK reads the current immutable
publication and each assigned UID's specific nested progress document, then rechecks
the current pointer. The safe team projection follows trusted publisher assignment order.
No employee-profile reads or Admin SDK are needed by this reader.

Rows show duty title, safe staff display identity, canonical status, retained inability
reason and last saved server time. A row represents one staff assignment, so a shared
duty can contribute multiple rows. Completed/In Progress metrics count these rows only
when genuine integrated DATA is available. LOADING, ERROR and EMPTY remain distinct;
unavailable progress metrics show an em dash. This is a refresh-based view, not a live
subscription. Existing fixture activity and local workforce/roster metrics remain labelled.
The reader retains both current publication and saved progress version internally.

WS4 notification, alerts, notes and history adapters remain disabled. Reading FR-9 progress
does not generate monitoring/history records or mutate those repositories.

## Automated validation

Deterministic suite: `node --test scripts/stage6c.test.cjs`.
Emulator suite: `node --test scripts/stage6c-emulator.test.cjs`.
Run the provisioning, Stage 6B and Stage 6C suites in that order in one fresh isolated
Auth/Firestore run; Stage 6B verifies no progress was created before Stage 6C begins.
Run the destructive rules-test fixtures separately in a fresh Firestore instance.

On Windows, use the certified Node 22.23.3 toolchain. For Firebase CLI, set
XDG_CONFIG_HOME to a temporary directory. Generate an isolated config with
`node scripts/create-stage6b-emulator-config.cjs`; it allocates free local ports and points
to the unchanged authoritative rules/indexes. Set SAID_EMULATOR_PROVISION=true and
GCLOUD_PROJECT=demo-said-5ce3e. Pass the generated absolute config to:

```text
firebase emulators:exec --config <temporary-config> --only auth,firestore --project demo-said-5ce3e "node --test scripts/stage6a-provision.test.cjs && node --test scripts/stage6b-emulator.test.cjs && node --test scripts/stage6c-emulator.test.cjs"
```

The E2E tests use random temporary passwords, trusted Stage 6A provisioning and the actual
Stage 6B POST publisher. They exercise both staff, all canonical statuses, inability/reopen,
supervisor joins, coworker denials, republish/version migration and assignment removal.

Final automated results: repository hygiene passed; web/mobile/security npm ci passed;
web lint plus fixture and Firestore-mode production builds passed; mobile typecheck and
Expo public configuration passed. Unchanged security suite: 193/193. WS1 location probe,
WS2 roster-final, WS3 save-lock/matcher and WS4 safety probes passed; WS4 Jest: 34/34.
Stage 6A: 37 deterministic + 5 provisioning. Stage 6B: 37 deterministic + 10 emulator.
Stage 6C: 43 deterministic + 8 emulator. Only the generated next-env reference flip is
restored. Earlier harness/import and transient emulator connection failures were diagnosed
and the final isolated accumulated E2E run passed. Lockfiles/rules remain unchanged.

Exact Stage 6C files (relative to the repository root):

- SAID Ops/mobile-app/App.tsx
- SAID Ops/mobile-app/components/StaffHomeScreen.tsx
- SAID Ops/mobile-app/components/StaffTaskDetailScreen.tsx
- SAID Ops/mobile-app/components/StaffWeeklyRosterScreen.tsx
- SAID Ops/mobile-app/lib/taskProgress.ts
- SAID Ops/mobile-app/lib/usePublishedRoster.ts
- SAID Ops/web-app/components/Dashboard.tsx
- SAID Ops/web-app/lib/roster/progress.ts
- SAID Ops/web-app/lib/roster/useSupervisorProgress.ts
- docs/STAGE_6B_ROSTER_INTEGRATION.md
- docs/STAGE_6C_PROGRESS_INTEGRATION.md
- scripts/probe-ws1-locations.cjs
- scripts/probe-ws3-mobile.cjs
- scripts/probe-ws4-safety.cjs
- scripts/stage6b.test.cjs
- scripts/stage6c.test.cjs
- scripts/stage6c-emulator.test.cjs

## Manual core readiness

READY below means supported and automated at the Auth/SDK/handler/component level;
browser/device UI validation has not been performed. Configure the clients against the
same Stage 6A demo project and use its provisioned ADMIN001/STAFF001 credentials.
Use the same Monday on web roster, mobile roster and supervisor progress selector.

| Step | Readiness | Limits / evidence |
| --- | --- | --- |
| ADMIN001 web login | READY | Certified supervisor Auth/profile/role and emulator identity |
| Admin manages operational data | PARTIAL | Locations persist; workforce controls/templates/drafts are session-local, provisioned UIDs required |
| Admin creates/publishes roster | READY | Session draft, trusted complete publication and real assigned UIDs |
| STAFF001 mobile login | READY | Certified staff Auth/profile/role and emulator identity |
| STAFF001 sees published roster | READY | Current assigned publication with safe team projection and progress |
| STAFF001 executes task | READY | Four actions, synchronous save lock; pause/checklist local |
| Progress persists securely | READY | Nested transactional writes tested against unchanged rules |
| Admin observes progress | READY | Dashboard current-week assignment join; explicit refresh required |

Remaining gaps: manual browser/device testing; durable workforce/templates/drafts;
production provisioning/credentials; notifications/history/notes/leave/archive and deployment.
No development merge or automatic manual UI test is part of Stage 6C.

References: [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions),
[server timestamps](https://firebase.google.com/docs/firestore/manage-data/add-data#server_timestamp),
[Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/).
