# Stage 7B — trusted scheduling validation and durable source copying

Started on `integration/final` at `b2a0ea30f24e0231403bfd635a59e1e6cfce5081`,
with a clean checkout and Stage 7A present. The installed versions matched the
requested baseline. Scope follows Task 1 FR-6/US-02 (copy and review reusable
rosters), assignment/conflict requirements, and the certified Task 2 occurrence,
Critical and immutable publication contracts.

## Validation gap and shared model

The earlier trusted publisher checked Auth/profile identity, locations, basic
shape and coverage, but omitted operational active/availability checks, overlap
and template skills. Bypassing the planner could therefore publish invalid work.

`lib/roster/scheduling.ts` supplies pure, Firebase/React-independent functions
for half-open overlaps, bounded staffing, unique coverage, dated availability,
collective skills and coverage issues. The planner and trusted publisher share
these definitions; template maintenance also shares the staffing bound.
`lib/roster/snapshot.ts` deep-copies assignment, skills and checklist arrays.

## Trusted rules and snapshots

- Every assigned UID must resolve to a provisioned, enabled Auth user and its
  employee document, with the requested business Employee ID and a valid role.
  An optional stored UID must match the document key. Duplicate UIDs in one item
  and duplicate business identities across distinct UIDs anywhere in the week
  are rejected. Display names/job categories come from server-read profiles.
- Assigned employees must explicitly be active and have a complete Stage 7A
  operational profile: job category, location identity, valid availability and
  bounded unique skills. Missing operational fields do not default to Available.
- Occurrence times are Johannesburg UTC+02:00. On Leave, Training or Unavailable
  windows reject any intersecting assignment, including a window starting inside
  the work. Effective start is inclusive, end exclusive; null end is ongoing.
  Future/expired unrelated windows do not reject. Available/On Duty normal states
  apply outside the window, independently of the current wall-clock display.
- Overlap is always a hard rejection: partial, contained and identical intervals
  conflict for a shared employee. Adjacent end/start times are allowed. Different
  employees can work at the same time.
- Required staffing is a whole number from 1 through 100. Coverage counts unique
  validated identities. The dated occurrence's staffing requirement remains
  editable, as certified by the earlier occurrence contract; it need not equal
  a later template default.
- Scheduled locations must exist, have a coherent canonical ID/name and be
  operational. Explicit inactive/retired or malformed records reject. Existing
  WS1 legacy records without an `active` field retain their certified active
  interpretation. Historical readers still resolve retired names.
- Template-backed work reads the current durable template. Missing, deactivated
  or invalid sources require reload/repair before publication. Required skills
  come from that record, are collectively satisfied case-insensitively, and are
  separate from checklist instructions. Any staffing/skills gap receives a clear
  review before publishing. The existing deliberate `confirmCoverage` / Publish
  Anyway action permits these gaps, including critical gaps; success returns the
  unresolved issues and warnings. It never bypasses identity, profile, active,
  availability, overlap, malformed data or location failures.
- Critical remains independent of Priority. A current critical source cannot be
  downgraded by a forged false occurrence flag; an already critical occurrence
  stays critical. Legitimate High/Medium/Low occurrence priority is preserved.
  Description, dated times/location, staffing, Critical, Priority, server-resolved
  skills and checklist are stored in the complete immutable occurrence snapshot.
  Later template edits/deactivation cannot change that version.

## Stale facts, pointer safety and response contract

The publisher caches current server reads for this request, including the
publisher's role, assigned profiles/roles, scheduled locations and templates.
After the existing create-only atomic snapshot batch succeeds, the existing
pointer transaction rereads those authoritative records and compares their full
contents (including revision/update metadata and legacy records). A concurrent
change rejects with 409 `STALE_AUTHORITATIVE_DATA`; Firestore transaction retry
protects the interval between the reread and pointer commit. There is no locking
system or extra durable validation collection. A complete orphan snapshot after
a rejected pointer switch is harmless and never becomes current.

400 responses distinguish `INACTIVE_EMPLOYEE`, `UNAVAILABLE_EMPLOYEE`, `OVERLAP`,
`INVALID_LOCATION`, `INVALID_STAFFING`, `INVALID_EMPLOYEE`, `MALFORMED_DATA` and
`COVERAGE_CONFIRMATION_REQUIRED`. Coverage responses carry work titles, validated
counts, Critical and missing skills for the existing confirmation dialog. 401/403
authorization, 413 size and sanitized 500 failure behavior remain intact. No raw
Firebase/Admin exception or stack is returned.

The provider commits Published state only after confirmed success and reconciles
the authoritative response using field signatures, preserving concurrent edits.
Rejected publication leaves the prior current pointer and local builder intact;
coverage rejection opens review rather than a success banner. Public snapshot
copies cannot mutate stored skills/checklists.

## Durable Copy Previous and unsaved work

In Firestore mode Copy Previous always reads the actual previous week's current
publication with the existing server-only SDK reader and pointer recheck. It does
not require a prior week in browser memory or use local unsaved source work.
The immutable source is restored into scheduling shapes and copied seven days
forward with new ScheduledWork IDs, source template identity, assignments and
snapshot fields. These copies are editable local planning state. Publication
revalidates their identities/active status/dated availability/skills against
current facts. Retired locations and inactive source templates cannot silently
become current operational work.

Copy appends and skips equivalent existing occurrences; it never replaces target
work, including edits made while the read was pending. The UI explains that
target work was kept and assignments will be checked again. Copy failure and
late prior-session responses cannot overwrite planning state. There is no durable
Save Draft. The previous demo-only copying flow retains its session behavior.

## Verification

| Gate | Result |
| --- | --- |
| Repository hygiene / diff whitespace | Pass |
| Web npm ci / TypeScript lint / production build | Pass |
| Mobile npm ci / typecheck / public Expo config | Pass; SDK 54 |
| Stage 6A / 6B / 6C deterministic | 37 / 37 / 43 passed |
| Restoration / occurrence / supervisor QA / mobile status | 30 / 11 / 4 / 3 passed |
| Stage 7A focused | 48 passed |
| Stage 7B focused | 63 passed |
| Deterministic combined | 276 passed; zero failures/skips |
| WS1 / WS2 roster-final / WS3 / WS4 | Pass |
| Monitoring Jest | 5 suites, 34 tests passed |
| Original security suite | 193 passed; unchanged test file |
| Stage 7A additional rules | 42 passed; unchanged test file |
| Real Stage 6A / 6B / 6C / restoration / 7A emulator | 5 / 10 / 8 / 5 / 12 passed |
| Real Stage 7B Auth/Firestore scheduling E2E | 17 passed |

New tests cover the requested 37 scenarios plus interval boundaries, Training,
UID/profile coherence, cross-item business duplicates, malformed arrays, current
Critical anti-downgrade, stale publisher roles, account isolation, copy failures,
concurrent target edits and snapshot reconciliation. Real emulator tests use
ADMIN001/STAFF001/STAFF002, actual Next routes, transaction races and the real
staff mobile reader. Deterministic/idempotent provisioning is reused unchanged.
Earlier positive publication fixtures were supplied complete operational fields;
the Stage 6B/6C two-staff scenarios explicitly activate STAFF002 only in their
test setup. The Stage 7A default inactive fixture remains intact. No security
negative assertion was removed or weakened.

Browser QA passed with ADMIN001 on a separate loopback Auth/Firestore emulator:
valid template-backed STAFF001 publication; visible overlap rejection; successful
back-to-back republish; authoritative unavailability rejected despite a stale
browser view; reload makes the planner reject too; error banner without success
and Published - Unpublished changes retained; pointer/snapshot unchanged. A
forged HTTP request with `confirmCoverage:true` also rejected unavailability.
After a reload into the next empty week, Copy Previous fetched both persisted
duties, kept a local target edit, retained assignments, shifted dates and produced
editable Draft copies. Editing the copy did not alter the source. The real E2E
mobile reader independently confirms staff still see the prior publication after
rejection. Local screenshot: `.cache/stage7b-browser.png`.

Initial sandbox npm cache/Firebase CLI access failures were resolved through
authorized execution. A test Firebase binding and an array-copy typing issue
were repaired before the final passing runs. Browser Fast Refresh required a
reload during source edits; the final UI checks passed after that reload.

No Firestore rules change was necessary. Publication writes remain denied to
ordinary clients. No dependency additions/upgrades or manifest/lockfile changes:
Next 15.5.27, sharp 0.35.4, Expo 54.0.37 and React Native 0.81.5. No mobile runtime
change, new durable collection, history/event recording, notification, monitoring,
archive, merge or deployment. There are no remaining Stage 7B blockers.

## Exact changed files

```text
SAID Ops/web-app/app/api/rosters/publish/route.ts
SAID Ops/web-app/components/OpsProvider.tsx
SAID Ops/web-app/components/RosterScreen.tsx
SAID Ops/web-app/lib/roster/currentPublication.ts
SAID Ops/web-app/lib/roster/generation.ts
SAID Ops/web-app/lib/roster/operations.ts
SAID Ops/web-app/lib/roster/publication.ts
SAID Ops/web-app/lib/roster/publishClient.ts
SAID Ops/web-app/lib/roster/rules.ts
SAID Ops/web-app/lib/roster/scheduling.ts
SAID Ops/web-app/lib/roster/snapshot.ts
SAID Ops/web-app/lib/roster/templates.ts
SAID Ops/web-app/lib/roster/types.ts
SAID Ops/web-app/lib/server/admin.ts
SAID Ops/web-app/lib/server/planning.ts
SAID Ops/web-app/lib/server/publication.ts
SAID Ops/web-app/tests/roster-template-occurrence.test.cjs
docs/STAGE_7B_TRUSTED_SCHEDULING.md
scripts/probe-ws1-locations.cjs
scripts/roster-restoration.test.cjs
scripts/stage6b-emulator.test.cjs
scripts/stage6b.test.cjs
scripts/stage6c-emulator.test.cjs
scripts/stage7a-emulator.test.cjs
scripts/stage7b-emulator.test.cjs
scripts/stage7b.test.cjs
```
