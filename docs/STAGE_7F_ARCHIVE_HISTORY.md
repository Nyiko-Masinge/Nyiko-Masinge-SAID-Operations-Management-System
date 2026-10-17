# Stage 7F — archive and historical access

The supervisor History page reads the selected week's last published snapshot and existing progress, including archived weeks. Date/week, area, employee, canonical progress status and duty-text search narrow the read-only view. It opens the retained instructions and safe team/progress detail. All immutable versions remain stored; this minimal UI shows the last pointer, rather than adding version browsing or enterprise search.

`POST /api/rosters/archive` verifies a revocation-aware Firebase token and exact supervisor role, derives a safe actor, then rechecks role, identity and expected current version in the Admin transaction. It merges `archived`, `archivedAt`, `archivedBy` and an optional bounded reason into the weekly root and creates one deterministic `RosterArchived` event. No version, item, progress or notification is deleted. Retry preserves original attribution and timestamp. No unarchive operation exists.

Publication rejects archived weeks before snapshot creation and again inside the pointer-switch transaction. Active web publication/progress/monitoring and mobile roster readers exclude archived weeks, including an archive observed during loading. The planner disables editing/generation/publication for a loaded archived week; the server remains authoritative for a stale browser. Staff can select Include archived rosters and navigate weeks to their own assigned historical work. Archived task details show read-only history and omit progress actions. Client transactions and Firestore rules reject all new progress writes against an archived week. Existing own progress remains readable.

Staff publication reads retain the established current-pointer-plus-own-assignment rule; archived history retains that pointer. Staff do not gain access to superseded versions, another employee's progress or supervisor audit queries. Supervisors retain historical version access under existing rules. This preserves all original negative tests.

Validation on Node 22.23.3 / npm 10.9.9:

- 13 new deterministic archive tests; 220 tests passed with directly affected publication/progress/restoration/monitoring/scheduling suites. Final focused rerun: 47/47.
- 9 new real Auth/Firestore/Next archive integration tests: authorization, stale pointer, immutable-content equality, safe event, idempotent archive, blocked republish/racing pointer switch, active exclusion, historical progress, staff isolation and revoked role.
- Integration regressions: monitoring 5, progress 8, scheduling/publication 17, restoration 5; all passed.
- Original security suite unchanged: 193/193. Additional Stage 7A rules: 42/42.
- Mobile typecheck, web lint/production build, WS4 probe, repository hygiene and whitespace checks passed.
- In-app browser against disposable emulator data: searched Shared ward care, archived with a reason, retained both duties and Completed shared progress, saw the attributed archive event; active dashboard after Refresh showed zero duties/attention while genuine workforce availability remained one. Screenshot captured locally. Browser server was already running with the preceding rules; write-blocking/security evidence comes from the fresh Stage 7F emulator run.

Initial test invocation omitted the required fixture opt-in and used incorrect security file extensions; the final invocation corrected both and passed every listed suite. Physical-device QA and cloud deployment are not claimed.
