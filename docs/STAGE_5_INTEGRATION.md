# Stage 5: certified WS4 notifications, monitoring and history

Starting integration commit: `64b46ec7ebf3ad40664ae4b036947d242d0494a5`.
Certified and fetched WS4 commit: `751f69f06f08177810ec88ec9aadf43547da7dd9`.
Normal non-fast-forward merge into `integration/final`, preserving both parents.
The starting tracked tree was clean. WS5, WS1, WS2 and WS3 were already ancestors;
WS4 was not. The fetched WS4 head matched the certified commit exactly.

## All 10 conflicts and resolutions

Paths below are repository-relative.

| Conflicting file | Exact resolution |
| --- | --- |
| `SAID Ops/mobile-app/.env.example` | Keep WS1 blank public Firebase configuration and warnings; add explicit `EXPO_PUBLIC_MONITORING_BACKEND=memory`. No placeholder configuration is treated as valid. |
| `SAID Ops/mobile-app/App.tsx` | Keep WS1 Employee ID login, restored profile/session, logout and session-only profile saving, and all WS3 task callbacks/types. Replace local alert state/read mutators with WS4 NotificationsProvider/useNotifications. Mount the provider only inside a validated staff session, keyed by Firebase UID; logout/account change unmounts task/profile/notification state. Use the current high-priority alert ID for the emergency shortcut. |
| `SAID Ops/mobile-app/lib/firebase.ts` | Retain integrated WS1/WS3 client byte-for-byte: one app, cached persistent Auth with AsyncStorage, existing nullable auth/db exports and configuration function. Reconcile new WS4 consumers to the function API instead of introducing another client. |
| `SAID Ops/mobile-app/package-lock.json` | Retain complete Stage 4 lock byte-for-byte, including Firebase, AsyncStorage, WS3 Node types/seed dependencies and Expo/RN/React/TypeScript baselines. Existing dependencies already support WS4 notifications. |
| `SAID Ops/web-app/app/layout.tsx` | Preserve WS1 AuthProvider and WS2 OpsProvider, theme startup script, theme.css and print.css; nest one WS4 MonitoringProvider inside OpsProvider. |
| `SAID Ops/web-app/components/AppShell.tsx` | Preserve authenticated employee identity/logout, Locations navigation and WS2 theme/navigation. Add WS4 alert counts, monitoring errors/dismissal, current date and explicit memory-mode copy. Hide counts when loading/unavailable. Replace the unsupported live-logging footer claim with local-monitoring availability copy. |
| `SAID Ops/web-app/components/OpsProvider.tsx` | Keep WS1 shared locations/workforce and all WS2 template, ScheduledWork, assignment and publication actions. Memoize shared location lookup and the existing derived assignment compatibility view; no second mutable assignment model. |
| `SAID Ops/web-app/lib/firebase.ts` | Retain integrated lazy WS1 client byte-for-byte; adapt new WS4 consumers to existing getters and isFirebaseConfigured(). No eager or duplicate app/Auth/Firestore initialization. |
| `SAID Ops/web-app/package-lock.json` | Preserve every existing package version; add missing certified WS4 Jest dependencies. Keep root caniuse-lite 1.0.30001809, with certified 1.0.30001812 nested under new browserslist to satisfy its range without upgrading the integrated graph. npm ci succeeds. |
| `SAID Ops/web-app/package.json` | Preserve integrated runtime and existing development versions; add certified test script and @types/jest, jest, ts-jest development dependencies only. Next remains 15.5.27. |

## Minimal integration edits and automatic-merge review

New read-only `data/monitoring/rosterInput.ts` projects actual WS2 ScheduledWork
occurrences, including ad-hoc work, into the WS4 detector input. IDs, dates, edited
titles/times/duration/required staffing and assignments come from occurrences.
Shared WS1 location names resolve location IDs. Template priority is used independently
of isCritical; scheduling and critical-duty semantics remain unchanged.

MonitoringProvider consumes that view and WS1 authenticated UID/profile/application
role for actors. Local audit/note/resolve mutations require a signed-in actor.
Repositories and initial watcher baselines reset per account. Detection/watchers wait
for shared locations to load successfully, avoiding false initial fixture history.
Alerts suggestions assign through WS2 assignScheduled, retaining its validation.
The old independent assignment store and fixture supervisor identity are not restored.

Dashboard counts actual scheduled occurrences and assigned staff; shared operational
areas replace static area names. Local metrics/activity remain labelled Demo data;
Completed and In Progress remain unavailable. Loading/errors and blocked live requests
do not render successful empty monitoring or invented progress numbers.

WS4 notification tray/list/detail and provider keep Loading, Error, Empty and Data
states, visible write failures and no optimistic success on failed markRead/markAllRead.
Mobile backend/configuration consumers use the existing Firebase configuration function;
requested live mode waits for restored Auth and uses the Firebase UID, never demo staff ID.

Web notificationWriter checks the live hold and memory mode before obtaining Firestore.
Memory mode returns false without initializing or writing Firestore. Factories and direct
provisional adapters remain blocked in requested live mode, even with valid Firebase/Auth.
Root WS5 rules, security tests, platform configuration, CI and locked contract have no changes.

Mobile manifest and lock remain exactly Stage 4. Automatically merged mobile .gitignore
was restored to its broader existing secret-file ignore. The incoming expo-status-bar
plugin entry failed Expo config because the installed component package supplies no config
plugin; app.json was restored to Stage 4. The status bar component/dependency remain intact.
Web's harmless additional .env.local ignore is retained. Only the verified build-generated
next-env.d.ts reference flip was restored; no broad cleanup was used.

Monitoring integration notes now describe the integrated identity, shared locations,
ScheduledWork and existing publication/critical-duty contracts accurately. The approved
notification path remains employees/{uid}/notifications/{notificationId}; its final nested
adapter and trusted creation remain central work. Provisional alerts/history/notes and
top-level notification access remain denied. No deployment, trusted writer, retention
policy, automatic deletion or fake archive infrastructure is introduced.

## Accumulated verification

Portable Node 22.23.3/npm 10.9.9 used for app/security gates, without changing system tools.

- Web npm ci, lint and production build pass on Next 15.5.27. Lint passes again after restoring the generated next-env reference.
- Mobile npm ci and typecheck pass. After removing the invalid incoming plugin entry, public Expo config passes and reports SDK 54.0.0.
- Security npm ci passes. Exact requested Firebase emulator command passes: 193 tests, 193 passed, 0 failed, 0 skipped, exit 0.
- Initial emulator startup found port 8080 held by an orphan from prior validation. Process inspection verified this workspace's rules/demo project and an absent parent; only that guarded PID was stopped. The exact emulator command then passed and shut down.
- WS1 location probe passes all original A-L checks and accumulated roster/location/auth assertions, unchanged from Stage 4.
- WS2 roster-final passes unchanged, including publication, critical duty, print and provider assertions.
- WS3 deterministic probe passes unchanged: Start/Complete/Unable/Reopen duplicates cause one persistence attempt, rejection causes no local success, retry works, fixture tasks cause zero Firestore writes, and scheduledWorkId matching remains correct. Auth restoration/routing and single Firebase persistent Auth checks also pass.
- WS4 safety probe retains all certified A-K checks, adjusted to integrated configuration/provider APIs and the Stage 4 package baseline. It additionally proves authenticated local actors, ad-hoc/edited ScheduledWork input, shared names, dashboard loading/unavailable honesty and zero Firestore calls across memory/blocked live boundaries.
- Actual web script `npm test -- --runInBand` passes: 5 suites, 34 tests. All 30 certified WS4 tests remain; four new projection tests cover edited occurrences, ad-hoc work, date/time conflict behavior and immutable assignment copies/removal.
- Notes initial loading, failure distinct from empty, successful zero-result empty state and save errors pass the WS4 safety probe. History partial failure reporting and fixture/live isolation remain intact.
- FR-9 remains exactly Scheduled, In Progress, Completed, Unable to Complete. Pause remains local-only; publication/alert/event terminology does not add persisted task states.

Final repository hygiene and both working/index git diff --check pass. There are zero
tracked node_modules, no unresolved index entries, no merge markers and no existing
lockfile version drift (mobile has zero added nodes; web has 306). Protected platform,
auth, mobile task/types, WS2 roster and accumulated WS1/WS2/WS3 probes are unchanged.
Push is limited to integration/final after every gate passes. Stage 5 stops there;
development merge and deployment remain outside this stage.
