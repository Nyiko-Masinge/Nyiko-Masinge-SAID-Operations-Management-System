# Stage 4: certified WS3 mobile operations

Starting integration commit: `a9388a64a554a860d5025f636e51fb493e95a02a`.
Certified and fetched WS3 commit: `17cf756742b5f2eaf2d34dcf38fafb0ec3d541fe`.
Normal non-fast-forward merge into `integration/final`, preserving both parents.
WS5, WS1 and WS2 were already ancestors. WS4 is excluded.

## All 17 conflicts and resolutions

Paths below are repository-relative.

| Conflicting file | Exact resolution |
| --- | --- |
| `.github/workflows/ci.yml` | Retain integrated WS5 workflow byte-for-byte. Historical WS3 web CI is outside its declared authority. |
| `SAID Ops/mobile-app/components/StaffHomeScreen.tsx` | Combine WS3 canonical status counts/cards, dated shifts, team rendering, fixture banner and disabled live flag with WS1 location lookup/error/retry. Retired shared names win; demo names only fill missing fixture names. Dormant live filter uses authenticated UID, never the demo employee. Live document path supplies ID; optional scheduledWorkId is carried through mapping. |
| `SAID Ops/mobile-app/components/StaffProfileScreen.tsx` | Retain WS1 logout and shared primary-location name resolution; use WS3 DemoShift and canonical status overview. Save notice explicitly says session only. |
| `SAID Ops/mobile-app/components/StaffTaskDetailScreen.tsx` | Retain certified WS3 execution, reason validation, synchronous useRef lock, await-before-local-success, finally release, visible errors and retry. Add WS1 shared location lookup/error/retry with retired-name resolution; fixture-only fallback names never mask live IDs. |
| `SAID Ops/mobile-app/components/StaffWeeklyRosterScreen.tsx` | Retain WS3 dated model, all four states, Unable reason display, touch targets and identity matcher; thread WS1 locationName through DaySection/DutyCard, with shared errors/retry and retired names. |
| `SAID Ops/mobile-app/data/demoRoster.ts` | Replace obsolete time/lowercase-status fixtures with certified dated start/end/shiftDate/canonical-status records, preserving locationId references for WS1 lookup. No persisted publication linkage. |
| `SAID Ops/mobile-app/data/demoTasks.ts` | Use certified dated DemoShift fixture records, teams, reason-compatible fields and canonical statuses, retaining locationId references for shared lookup. No live marker is added to fixtures. |
| `SAID Ops/mobile-app/lib/firebase.ts` | Preserve WS1 single app, cached initializeAuth and AsyncStorage persistence; expose WS3 nullable auth/db and FIREBASE_CONFIGURED through those same functions. Configuration does not enable live task reads. |
| `SAID Ops/mobile-app/package-lock.json` | Retain integrated graph and add certified missing WS3 nodes. Only existing versions intentionally changed are @types/node 26.2.0→26.6.4 and required undici-types 8.3.0→8.9.0. These satisfy WS3's new direct Node types dependency; no unrelated version drift. |
| `SAID Ops/mobile-app/types/roster.ts` | Use canonical ShiftStatus, dated start/end/shiftDate and optional scheduledWorkId; keep locationId shared-location reference. Remove obsolete sharedTaskId/name-placeholder assumptions. |
| `SAID Ops/mobile-app/types/tasks.ts` | Use certified DemoShift, exact FR-9 states, optional scheduledWorkId/isLive, reason and checklist/team fields; keep locationId and clarify fixture/shared-area boundary. |
| `SAID Ops/web-app/.env.example` | Retain integrated WS1/WS5 configuration examples byte-for-byte. |
| `SAID Ops/web-app/app/layout.tsx` | Retain integrated single WS1 AuthProvider + WS2 OpsProvider, theme and print setup byte-for-byte. |
| `SAID Ops/web-app/app/page.tsx` | Retain integrated Employee ID login byte-for-byte. |
| `SAID Ops/web-app/components/AppShell.tsx` | Retain integrated authentication, locations, logout and WS2 theme/navigation byte-for-byte. |
| `SAID Ops/web-app/package-lock.json` | Retain complete integrated WS1/WS2/WS5 graph byte-for-byte. |
| `SAID Ops/web-app/package.json` | Retain integrated dependencies and Next 15.5.27 byte-for-byte. |

## Automatically merged files and minimal integration edits

Mobile App auto-merged WS1 login/provider/profile loading and WS3 task callbacks/types.
Reviewed and retained this composition. Add an immediate signed-out render boundary,
reset local task/profile state on logout, and show empty contact email when absent
instead of substituting the demo employee's contact identity. Exactly one AuthProvider
and one navigation tree remain. Authenticated staff reach WS3 fixture screens.

StaffEditProfileScreen auto-merged its WS1 operational-area behavior with WS3 touch
targets. Retain both and replace cross-system save claims with session-only copy.
No employee-profile writes or credential updates are introduced. Profile edits reset
on logout. Firebase Auth still restores its AsyncStorage session and rejects supervisor
accounts for staff access.

Mobile package.json auto-merged AsyncStorage and expo-dev-client with WS3 Node types,
react-dom and react-native-web. Baselines remain Expo 54.0.37, RN 0.81.5, React 19.1.0,
TypeScript 5.9.3, Firebase 12.19.0, AsyncStorage 2.2.0 and expo-dev-client 6.0.21.
Certified additions are react-dom 19.1.0 and react-native-web 0.21.3; Node types 26.6.4
remain a dev dependency. tsconfig keeps WS3's Node type visibility for the seed script.

Keep WS3 demo employee/location data, types, Firestore seed data and seed script.
The seed is a historical standalone fixture utility, not an application write path;
its comment now states WS5 denies unauthenticated writes and forbids use against the
shared project. It was not executed. README now describes the actual auth/fixture
composition. Retain the development-contract theatre-space question without collapsing
the two fixture IDs.

## Every historical web cleanup

These incoming files did not exist at the starting integration commit. They are
explicitly outside WS3 authority and are omitted from the merge result:

- `SAID Ops/web-app/.firebaserc`: superseded by root WS5 project configuration.
- `SAID Ops/web-app/firebase.json`: superseded by root WS5 emulator/config authority.
- `SAID Ops/web-app/firestore.rules`: competing rule set; root WS5 rules remain sole authority.
- `SAID Ops/web-app/lib/firebase/auth.tsx`: competing AuthProvider/session cookie stack; WS1 provider remains active.
- `SAID Ops/web-app/lib/firebase/config.ts`: duplicate Firebase client; WS1 client remains active.
- `SAID Ops/web-app/middleware.ts`: historical said-ops-auth cookie redirects would reject legitimate WS1 client sessions.
- `SAID Ops/web-app/services/employees.ts`: superseded historical Firebase client/service path.
- `SAID Ops/web-app/services/locations.ts`: superseded historical Firebase client/service path.
- `SAID Ops/web-app/services/roles.ts`: superseded historical Firebase client/service path.
- `SAID Ops/web-app/services/shifts.ts`: historical raw-shift implementation outside WS2 roster/WS5 progress contracts.
- `SAID Ops/web-app/tests/rules.test.ts`: tests obsolete web-local rules; root 193-test WS5 suite remains authoritative.

Restore automatically merged web `.gitignore` and `next-env.d.ts` to integrated
baseline. The web tree, root platform files, security tests and CI have no net change
from Stage 3. Build-generated next-env reference flip was checked and restored alone.

## Verification

Use portable Node 22.23.3/npm 10.9.9 for accumulated gates, without changing system tools.

- Repository hygiene passes, zero tracked node_modules, no merge markers, git diff --check passes.
- Web npm ci, lint and production build pass on Next 15.5.27; lint passes again after next-env restoration.
- Mobile npm ci and typecheck pass; Expo public config reports SDK 54.0.0.
- Security npm ci passes. Exact requested emulator command passes: 193 tests, 193 passed, 0 failed, 0 skipped, exit 0.
- First emulator startup encountered occupied port 8080. Read-only process inspection identified a Java emulator using this exact workspace's rules/demo project, whose parent no longer existed. Only that verified orphan PID was stopped. The exact command then passed and shut down its emulators normally.
- WS1 location probe passes all original A–L checks and Stage 3 roster/location assertions. Only fixture export/import and native/Firebase mocks changed to support WS3 screen imports.
- WS2 roster-final passes all milestone 3/4, final, hardening, print, critical duty and provider assertions unchanged.
- New deterministic `scripts/probe-ws3-mobile.cjs` exercises actual integrated TSX handlers using the WS1 hook driver, with mocked Firestore/Auth boundaries. It adds no production exports or behavior.
- For each Start, Complete, Unable and Reopen: two immediate calls cause exactly one persistence attempt; before resolution, no local success; rejection gives visible error and unchanged task/parent state; retry makes a second attempt and exactly one success. Unable rejects blank reasons and trims valid reasons. Lock releases in finally.
- Fixture Start makes zero Firestore writes and one local success. Signed-out/unconfigured live attempts make zero writes and zero local successes.
- Matcher: neither ID permits exact title/date/start tuple; differing tuple fails; either one-sided ID fails; different IDs fail; same IDs succeeds even if tuple differs.
- Actual task/roster renders resolve retired shared names. Actual AuthProvider restores UID profile/business employeeId, normalizes internal alias, logs out, rejects supervisors and unsubscribes. Firebase probe proves one app and one persistent Auth initialization with shared handles.

Live task reads remain explicitly disabled. Raw live shift writes are still rejected
by unchanged WS5 rules and surface failure; this stage does not invent published roster
persistence/progress mapping. WS4 notifications/monitoring/history/notes are unmerged.
