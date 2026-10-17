# Pre-production Spark amendment

The persistence paths and canonical transitions below remain authoritative. Before production, the direct-client progress writer and Stage 7C/7D Functions sender were superseded by authenticated Next `POST /api/mobile/task-progress` and publication transactions. Clients now read authorized progress and cannot write it directly. Verified tokens/profiles, current assignment, canonical transitions and archive checks gate an atomic progress/event/required-inbox commit. Notification documents use the certified `createdAt`, `eventId`, safe `issuedBy`, week/version/work identity and `isRead` contract, with document ID derived deterministically. See [SPARK_MIGRATION.md](SPARK_MIGRATION.md); earlier provisional adapter/deferred-work statements below describe the original integration baseline.

# Authoritative central integration contract

This is the single authoritative central integration contract for the WS5 takeover on
`feature/platform-devops`. It records the integration decisions authorized for this pass,
derived from the certified implementations below. PLATFORM_DEVOPS.md describes platform
operations and must refer here rather than define a competing contract. The requirements
and authority order in DEVELOPMENT_CONTRACT.md continue to apply.

| Certified workstream | Frozen SHA | Implementation evidence |
| --- | --- | --- |
| WS1 access-workforce | `16d4a1d7fc85996e76803208daba7074026bc957` | Both clients' authIdentity.ts, employee.ts, roles.ts and AuthProvider; web locations.ts |
| WS2 roster-scheduling | `5cbc33cc286bceadbb0aa85e362e0779e8bef6e7` | Web lib/roster/types.ts, publication.ts and OpsProvider |
| WS3 mobile-operations | `17cf756742b5f2eaf2d34dcf38fafb0ec3d541fe` | Mobile types/tasks.ts, StaffTaskDetailScreen and StaffWeeklyRosterScreen |
| WS4 monitoring-history | `751f69f06f08177810ec88ec9aadf43547da7dd9` | Notification/monitoring repositories, providers, integration notes and safety probe |

**LOCKED FOR INTEGRATION** means the target contract is decided, not that it is deployed
or already implemented. **DEFERRED / TRUSTED-SERVER INTEGRATION** identifies work that
must remain unavailable until its implementation and security checks exist.

This pass changes documentation and repository hygiene only. Current firestore.rules,
security tests, CI and application adapters are unchanged and do not yet enforce every
decision here. In particular, their older role/profile/location assumptions and leave
permissions must be aligned in the next security pass before live activation.

## Auth and employee profiles — LOCKED FOR INTEGRATION

Certified WS1 governs client identity behavior. The user-facing credential is Employee ID
plus password. Both clients normalize the ID identically:

1. Trim.
2. Lowercase.
3. Replace internal whitespace with `-`.
4. Remove characters outside `[a-z0-9._-]`.

The synthetic Firebase-only alias is `<normalizedEmployeeId>@saidops.internal`.
Firebase Email/Password is used internally; this alias is not a mailbox or contact address.

```text
Employee ID -> normalized synthetic alias -> Firebase Auth -> auth.uid
            -> employees/{uid} -> business employee profile
```

The employee document path is keyed by Firebase UID. The business identifier is
`employeeId`, not the UID. WS1 derives its client `id` from the document path; a stored
legacy `id` must not be interpreted as the authoritative business Employee ID.

Required profile fields follow WS1: `employeeId`, `firstName`, `surname`, `roleId`.
Optional contact fields use the actual certified names: `contactEmail`, `phoneNumber`,
`profilePictureUrl`. Phone/photo are not mandatory. Never use the synthetic alias as
`contactEmail`, and never derive business identity from the typed login value alone.

`roleId` resolves through `roles/{roleId}`. System authorization values are exactly
`Staff Member` and `Supervisor/Administrator`. Operational job categories are separate;
a job title such as Nurse does not confer privilege. A successful Firebase sign-in still
requires an authorized employee profile and role.

Staff read their own profile and may update only their own contact/photo fields.
Employee identity and privilege are not staff-selectable. Client account/profile
provisioning, role changes and employee deletion are denied; trusted provisioning is a
separate operation. Supervisors may read workforce profiles and update non-identity
profile fields, subject to the aligned rules.

Trusted provisioning must use the same alias normalization and detect duplicate/colliding
normalized IDs. Live provisioning and administrator password reset are deferred; no
mailbox reset flow or provisioning implementation is claimed here.

## Operational areas — LOCKED FOR INTEGRATION

Certified WS1 governs `locations/{locationId}`:

| Field | Representation |
| --- | --- |
| Document path | Canonical location ID |
| `name` | Required string |
| `active` | Optional boolean; missing means active, false means retired |
| Legacy stored `id` | Optional; if present it should match the path |

New WS1 records contain `name` and `active: true`; do not require a stored `id`.
Active and legacy records are available for new selections. Retired records are excluded
from new selections but remain readable/resolvable for historical references. Preserve
WS1's legacy-aware selection behavior rather than using a query that excludes missing
`active` fields.

Supervisors may create, rename, retire and reactivate locations. No client deletion is
authorized unless a later central lifecycle decision permits it.

## Published roster — LOCKED FOR INTEGRATION

The central persistence structure is:

```text
publishedRosters/{weekStart}
publishedRosters/{weekStart}/versions/{version}/items/{scheduledWorkId}
```

Week metadata contains `weekStart`, `currentVersion` and `publishedAt`.
The current-version reference selects a complete published snapshot; it must not expose
a partly written version. Item records are immutable within their version. Republishing
creates a new version rather than editing an earlier published snapshot.

Preserve certified WS2's existing `ScheduledWork.id` as `scheduledWorkId`, matching
the item path. Draft edits must not change the snapshot staff currently see. WS2's
`Draft`/`Published` lifecycle and `hasUnpublishedChanges` are separate from FR-9
execution status; do not introduce a per-item publication flag as a substitute.

| Published item field | Certified source / integration requirement |
| --- | --- |
| `scheduledWorkId` | Existing WS2 ScheduledWork.id |
| `date`, `weekStart` | WS2 local YYYY-MM-DD date and week identity |
| `title`, `description` | WS2 work title and staff-safe operational instructions |
| `startTime`, `endTime` | WS2 HH:mm values on the work date |
| `locationId` | Resolve WS2 area to the canonical WS1 location ID during integration |
| `requiredStaff` | WS2 required staffing count |
| `assignedUids` | Trusted resolution of assigned WS2 staffIds to provisioned Firebase UIDs |
| `dutyId` | Optional existing template reference; absent for ad-hoc work |
| `isCritical` | WS2's snapshotted critical flag |
| `priority` | Only when legitimately resolved and frozen at publication |
| `team` | The minimal teammate projection specified below |

No fixture identity, area name or demo record may be substituted for a trusted UID or
canonical location ID. Reject unresolved production mappings rather than publish fake
records. Due time/duration display can be derived from existing timing fields; this
contract does not invent checklist persistence or private notes.

WS2 currently has no persisted Firestore implementation. Its publication snapshots are
session-only copies. Publication persistence is central integration work. Historical
WS2 snapshots have no priority field or publication version: do not claim otherwise.
If needed, an ad-hoc priority default remains a central implementation decision.

Staff read only the current published version, and only items assigned to their
authenticated UID. The staff item query must constrain `assignedUids` with
`array-contains auth.uid` in that version. Supervisors may read the complete published
snapshot. Draft data is not staff-readable. Exact ordering/query indexes must be
emulator-tested before indexes are finalized.

## Coworker privacy — LOCKED FOR INTEGRATION

Do not grant ordinary staff broad reads of coworker employee documents. Publish only
the team display information required by WS3:

```text
team: [{ employeeId, displayName, jobCategory }]
```

Derive initials from `displayName`. Preserve `isPrimary` only if the actual assignment
data supplies it. The job category is an operational display label, not the system
authorization role. Exclude `contactEmail`, phone, leave information, authorization
role and private profile data. Rules cannot hide selected fields inside an otherwise
readable document; privacy requires this dedicated projection.

## FR-9 task progress — LOCKED FOR INTEGRATION

Canonical persisted statuses are exactly:

- Scheduled
- In Progress
- Completed
- Unable to Complete

The central path is `employees/{uid}/taskProgress/{scheduledWorkId}`.
Required fields are `scheduledWorkId`, `weekStart`, `publicationVersion`, `status`
and `updatedAt`; `unableToCompleteReason` is optional except when entering the unable
state. `updatedAt` is a server timestamp, not a client-authoritative clock value.

Allowed WS3 transitions are:

| From | To |
| --- | --- |
| Scheduled | In Progress |
| In Progress | Completed |
| In Progress | Unable to Complete |
| Completed | In Progress |
| Unable to Complete | In Progress |

Reopen preserves the prior inability reason. Entering Unable to Complete requires a
trimmed, nonblank reason. Pause remains local UI state, not a persisted canonical status.
The primary identity is `scheduledWorkId`. The legacy tuple matcher applies only when
both sides lack stable IDs; it must not become the new persisted identity contract.

Staff may write only their own progress for work assigned to them in the current
published roster, referencing its current publication version. They may not modify
scheduling/publication data, write another employee's progress, or delete progress.
Supervisor reads may be permitted. Republishing must not automatically reset progress
for the same stable scheduled-work identity.

Central adapters must migrate WS3's provisional raw-shift writes to this path and preserve
its synchronous useRef save lock, authenticated writes, fixture/live separation, transition
actions and visible persistence errors. The existing clients are not claimed to use this
new persistence path yet.

## Notifications — LOCKED FOR INTEGRATION

Use `employees/{uid}/notifications/{notificationId}`.
Minimum fields are `id`, `title`, `message`, `category`, Firestore `timestamp`,
and boolean `isRead`. `relatedShiftId` is optional; reconcile its scheduled-work reference
centrally rather than inventing a second identity.

Ordinary staff read only their own notifications and may update only `isRead`.
They cannot create notifications, modify content or delete notifications. Trusted/system
creation is deferred.

Central adapters must reconcile WS4's provisional top-level `notifications`, `recipientId`,
`createdAt` and related-duty fields with this ownership path and timestamp representation.
WS4 live adapters remain disabled until the central adapter and trusted sender work exist.
A configured Firebase project or explicit live flag does not release that hold.

## Leave — CLIENT ACCESS DENIED UNTIL IMPLEMENTED

Task 1 includes leave concepts, but no certified functional submission/approval workflow
exists. **CLIENT ACCESS DENIED UNTIL FUNCTIONAL WORKFLOW IS IMPLEMENTED.**
Older WS5 tests expecting successful leave writes are not approval of a live workflow.
The current rules/tests still contain that legacy permission; changing them belongs to
the next security pass, not this documentation pass.

## Alerts, history, notes and archive — DEFERRED / TRUSTED-SERVER INTEGRATION

WS4 provides useful demo/local monitoring, operational history and notes. Its live
`alerts`, `auditLogs` and `notes` shapes remain provisional. Until approved schemas and
trusted writers exist, deny client writes and deletes, keep unapproved reads denied,
and leave WS4 live adapters disabled. Fixture operational inputs must never reconcile
live alerts or append production history.

Do not invent retention periods, auto-deletion, an archive lifecycle or server writers.
The local history view/export and its result cap do not constitute durable archival or
retention infrastructure.

## Raw shifts and security defaults — LOCKED FOR INTEGRATION

Raw/legacy `shifts` are not the new staff published-roster contract. Ordinary staff access
remains denied unless a specific adapter is explicitly authorized centrally. Such an
exception is not granted here. Do not mix legacy shift status with per-user FR-9 progress.

Unknown collections deny by default. Destructive operational client deletes deny by
default. Trusted provisioning is separate from client permissions. Any future server
operation that bypasses Rules must independently authenticate, authorize, validate
ownership and validate its payload.

## Remaining work — DEFERRED / TRUSTED-SERVER INTEGRATION

- Trusted roster publication writer, validated identity/location mappings and coherent version switching.
- Central client composition and adapters for certified WS1/WS2/WS3/WS4; no frozen branch is merged here.
- Server-side monitoring reconciliation against confirmed live operational inputs.
- Trusted notification sender and production payload validation.
- Final archive/retention policy and any corresponding lifecycle implementation.
- Firebase live project provisioning, Auth configuration and trusted account administration.
- Final indexes after exact queries and permission denials are emulator-tested.
- Production deployment credentials/configuration and separately authorized deployment.

The repository currently records Firebase project alias `said-5ce3e`; this is not evidence
that live provisioning, configuration or deployment is complete. Keep credentials out of
clients/source. Existing public variable names remain `EXPO_PUBLIC_FIREBASE_*` and
`NEXT_PUBLIC_FIREBASE_*`. Rules tests use only the isolated `demo-said-5ce3e` emulator.
