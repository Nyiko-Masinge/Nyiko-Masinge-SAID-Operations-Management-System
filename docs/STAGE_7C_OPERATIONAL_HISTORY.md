# Stage 7C: trusted operational history

Starting SHA: `a1eef8a99bf736a609627b7e09159abd952a4944`, branch `integration/final`.

The trusted publisher stores a bounded safe `publishedBy` identity on version and
week metadata. Its existing pointer transaction reads immutable prior/new items,
derives assignment changes by stable ScheduledWork ID, and atomically creates
RosterPublished/RosterRepublished and AssignmentAdded/Removed/Reassigned events
in `operationalEvents`. Failed snapshot creation, stale authoritative facts or
failed pointer transactions cannot commit a false publication event. Planner
edits remain unpublished local state and generate no trusted events.

The scoped Node 22 functions package pins firebase-admin 14.5.0 and
firebase-functions 7.4.0 (the latter explicitly supports Admin 14). Both app
manifests/lockfiles and their certified dependency baseline remain unchanged.
`recordTaskProgress` uses a v2 Firestore auth-context trigger on the certified
nested progress path. It maps actual before/after snapshots to TaskStarted,
TaskCompleted, TaskUnableToComplete and TaskReopened. Hashing the CloudEvent ID
gives create-only idempotency; duplicate delivery preserves the original event,
and out-of-order delivery records each transition without overwriting another.
Occurred time comes from the progress server timestamp, separately from recorded
time. Reason is bounded at 2,000 characters. Events do not contain private profiles.

Matching end-user auth context resolves safe identity from that exact immutable
publication. Service/system/missing context is explicitly identified as such,
never guessed to be staff. `progressOwnerUid` independently identifies the owner
of the affected progress. The Functions emulator omits staff auth context; its
system provenance is retained honestly. Production auth-context propagation must
be checked during deployment smoke testing before claiming user attribution for
every cloud-triggered write. No client-supplied audit actor is accepted.

Rules permit supervisor event reads only. All clients, including supervisors,
are denied event creation/update/deletion. Staff use their own task progress and
notifications rather than gaining visibility of other employees' event history.
No indexes changed. No cloud deployment occurred.

Validation on Node 22.23.3/npm 10.9.9:

- Focused deterministic history tests: 25 passed (8 publication, 17 functions).
- Affected deterministic 6B/6C/7A/7B/restoration: 221 passed; combined 246/246.
- Focused real Auth/Firestore tests: 4 passed, including atomic failure and rules.
- Actual Functions emulator: 1 passed; rapid Start/Complete captured durably.
- Original security tests: 193 passed; original test file unchanged.
- Stage 7A rules: 42 passed; unchanged test file.
- Publication/progress/scheduling emulator regressions: 10/8/17 passed.
- Web lint/production build, functions syntax, hygiene and diff whitespace passed.

The shared emulator runner clears only the explicitly guarded loopback demo
database between resetting suites. Initial fixture contamination and Windows
function-source/package-resolution errors were corrected before passing runs.
Generated Next type references are restored, and local logs remain ignored.

References: [Firebase trigger ordering, retries and auth context](https://firebase.google.com/docs/functions/firestore-events),
[Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/).
