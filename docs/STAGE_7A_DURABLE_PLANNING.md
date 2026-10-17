# Stage 7A - durable planning records

Starting branch: `integration/final`. Starting SHA:
`59f97c81b92bebe3d9f432ca222196725df08b74`. Working tree was clean.
Stage 6A/6B/6C, template occurrence work, supervisor QA, mobile status work,
roster restoration and sharp hardening were confirmed ancestors.

This stage implements durable workforce operational maintenance and reusable
duty templates. It does not implement durable roster drafts, trusted scheduling
validation, leave approvals, history, notifications, monitoring, archive,
CI/CD or deployment. Publication payloads and immutable versions are unchanged.
Task 1 sections 9.1.5 and 9.1.11 and the agreed UID/Employee ID integration
contract informed this implementation.

## Workforce contract

`employees/{uid}` remains keyed by Firebase Auth UID. The separate business
`employeeId`, `firstName`, `surname` and `roleId` remain administrator-managed.
Existing contact/photo fields and other trusted profile fields are preserved.
The mirrored web/mobile Employee types permit legacy identity reads without
requiring newly introduced operational fields to exist.

| Operational field | Persisted representation |
| --- | --- |
| `jobCategory` | Nonblank string, maximum 120 characters; never an authorization role |
| `locationId` | Canonical operational area ID |
| `active` | One canonical boolean; no persisted status/isActive alternative |
| `availability` | The dated object below |
| `skills` | At most 32 unique, trimmed nonblank labels; maximum 80 characters each |
| `revision` | Integer incremented atomically on each operational write |
| `updatedAt`, `updatedBy` | Firestore server timestamp and verified supervisor UID |
| `createdAt`, `createdBy` | Trusted provisioning metadata where initialized |

Skills labels are case-insensitively unique. An explicitly reviewed empty list
means no skills recorded. Missing/invalid skills are represented as unknown in
the read projection (`skillsKnown: false`), with an empty display array for old
callers, never an implicit persisted empty list. Missing active/availability
fields display as "Not provisioned". Production reads never manufacture Active
or Available. Invalid identity mappings fail the workforce read.

The UI's `status`, `role` and current `availability` are compatibility projections
for existing screens. They are not additional Firestore authority. Workload is
still local demo data and is shown as a dash in integrated mode. Full name and
contact fields are read-only in the Stage 7A integrated operational form.

## Availability semantics

```ts
availability: {
  normalState: 'Available' | 'On Duty';
  state: 'Available' | 'On Duty' | 'On Leave' | 'Training' | 'Unavailable';
  effectiveFrom: string; // UTC ISO instant, inclusive
  effectiveTo: string | null; // UTC ISO instant, exclusive; null = ongoing
}
```

Instants use canonical `YYYY-MM-DDTHH:mm:ss.sssZ` strings. The selected window
state applies from the start up to, but excluding, the end. Outside the window,
the normal state applies. End, if supplied, must follow start. One effective
window is maintained per employee; a full leave/exception history is deferred.
The supervisor form explicitly labels facility time (Africa/Johannesburg,
UTC+02:00) and converts it to UTC independently of the browser timezone.
The read adapter derives the current display state. A later scheduler can
compare an occurrence interval against the saved window. No trusted publisher
validation was added here; existing local scheduling behavior remains separate.

## Template contract

`dutyTemplates/{templateId}` is the durable reusable definition.

| Field | Persisted representation |
| --- | --- |
| `name`, `description` | Name maximum 200; description maximum 4,000 characters |
| `locationId` | Canonical default area |
| `defaultStartTime` | HH:mm facility time |
| `durationMinutes` | Positive integer; end must be before midnight, matching the planner |
| `recurrence` | Daily / Mon, Wed, Fri / Tue, Thu |
| `requiredStaff` | Integer from 1 to 100 |
| `priority` | High / Medium / Low, independent of Critical |
| `isCritical`, `active` | Explicit, independent booleans |
| `requiredSkills` | Same bounded skills representation as workforce |
| `requirements` | Separate checklist/instructions: at most 32 unique entries, maximum 500 characters each |
| `createdAt`, `updatedAt` | Firestore server timestamps |
| `createdBy`, `updatedBy` | Verified supervisor Auth UID |
| `revision` | Atomic integer revision |

The adapter maps these to the existing planner's `time`, `duration`, `required`,
`status` and resolved `area` display. Create, edit, duplicate and activate/
deactivate are durable. Deactivation preserves the record. Existing retired
location references can be retained; new selections must use valid active or
legacy-active locations. Recovered template references from published
occurrences are session-only and excluded from template administration.
Neither template writes nor deactivation writes touch ScheduledWork or any
published roster document. Existing occurrences keep their snapshots.

## Trusted writes and reads

The existing explicit Firestore roster backend flag also enables planning
persistence; Firebase configuration alone does not enable it. The same server
project/emulator guards and existing firebase-admin 14.5.0 SDK are reused.

- `POST /api/planning/workforce`: `{ uid, expectedRevision, fields }`; only
  jobCategory, locationId, active, availability and skills are accepted.
- `POST /api/planning/templates`: `{ templateId, expectedRevision, create, fields }`.
- Both verify the Firebase ID token (including revocation), then resolve the
  caller's current employee/role to exactly Supervisor/Administrator.
- Admin transactions check the expected revision before writing approved
  fields, attribution and server timestamps. Revision mismatches/collisions
  return 409 and require reload. Unknown/protected payload keys are rejected.
- Only the canonical workforce/template paths can be written. There is no
  account creation, delete, draft or publication operation in these APIs.
- Workforce and templates use SDK reads from the server, avoiding offline cached
  administrative success. Permission-denied/network failures remain visible.
- UI updates follow confirmed persistence; failed requests retain old values
  and form input. Synchronous locks prevent duplicate saves. Loading, error,
  empty, data, saving, success and failure states are explicit.
- Logout/account switches invalidate pending reads/writes, immediately mask
  prior data, clear provider memory and remount child screens to discard form
  values. The new authorized account reloads its permitted data.

Client employee writes remain denied. The only rules addition is supervisor
get/list access to dutyTemplates; every client template create/update/delete
remains denied. Published roster, progress and unknown-path rules are unchanged.
The original 193-case rules test file is unchanged. Its npm test command names
that file explicitly; `test:stage7a` runs the additional rules suite separately,
preserving the certified CI count without changing CI.

## Staff provisioning decision

No existing trusted production Auth provisioning API was available. Building
one would expand this stage into account administration. Add Staff is disabled
and labeled "administrator setup" in integrated mode; fixture mode clearly
labels it local demo. Programmatic integrated add attempts also fail.

Production setup remains an administrator operation: use the established alias
normalization, reject duplicate/colliding Employee IDs, create the Auth account,
and initialize its UID-keyed profile/role and all reviewed operational fields.
Do not run the emulator provisioner against production. It still requires the
fixed demo project, explicit loopback endpoints, opt-in and disposable password.

The emulator provisioner explicitly initializes ADMIN001 and STAFF001 as active
at Parvo Ward; STAFF002 as inactive at Ward B with a dated Training window. All
have representative skills. Fixed template IDs provide a normal High/noncritical
ward round and a Low/critical oxygen check with distinct skills/checklists.
Server metadata is initialized through emulator commit transforms. Reruns reuse
existing Auth UIDs/business IDs and overwrite only named test fixtures, without
duplicate templates. This is intentional fixture repair/reset, not production
migration or preservation of manual fixture edits.

## Verification

| Gate | Result |
| --- | --- |
| Repository hygiene and diff whitespace | Pass |
| Web npm ci / lint / production build | Pass |
| Mobile npm ci / typecheck / Expo public config | Pass; SDK 54 |
| Stage 6A deterministic | 37/37 |
| Stage 6B deterministic | 37/37 |
| Stage 6C deterministic | 43/43 |
| Restoration deterministic | 30/30 |
| Template occurrence / supervisor QA / mobile status | 11/11, 4/4, 3/3 |
| WS1 / WS2 roster-final / WS3 / WS4 probes | Pass |
| Monitoring Jest | 34/34 |
| Stage 7A deterministic | 48/48 |
| Certified security baseline (unchanged cases) | 193/193 |
| Separate Stage 7A rules | 42/42 |
| Real emulator Stage 6A / 6B / 6C / restoration | 5/5, 10/10, 8/8, 5/5 |
| Real emulator Stage 7A persistence | 12/12 |

New tests cover authorized reads/writes and restart reload, inactive status,
dated availability, skills, protected-field forgery, revision races, account
isolation, failed-save state retention, template soft deactivation/reactivation,
checklist/skills separation, independent Priority/Critical and immutable
published snapshots. Real provisioning reruns verify stable UIDs/IDs and no
duplicate workforce/templates. Existing test harnesses gained the new template
read dependency; the old workforce default assertion now checks unknown fields
instead of the explicitly disallowed fabricated Available state. No security
negative case was weakened or removed.

No dependency additions/upgrades or app lockfile changes. Next is 15.5.27,
sharp 0.35.4, Expo ~54.0.37 and React Native 0.81.5. Both client Firebase ranges
remain ^12.19.0; firebase-admin remains 14.5.0. The [Expo SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/)
was consulted for the mirrored mobile type-only change; no native runtime flow
was changed.

## Browser smoke

Passed against a separate isolated Auth/Firestore emulator and local Next.js
server, signed in as ADMIN001. Loaded all three real workforce profiles,
changed STAFF001's primary location from Parvo Ward to Ward B, refreshed and
confirmed Ward B persisted. Created "Stage 7A Browser Smoke" (Low priority,
Critical, required skill Animal Handling, checklist Record QA reading), refreshed
and confirmed it remained. Deactivated, refreshed and confirmed Inactive;
reactivated, refreshed and confirmed Active. Add Staff was visibly disabled and
labeled administrator setup. Only this isolated session's QA records were
changed. Browser evidence is saved locally at `.cache/stage7a-browser.png`.

## Exact changed files

```text
SAID Ops/mobile-app/lib/employee.ts
SAID Ops/web-app/.env.example
SAID Ops/web-app/app/api/planning/templates/route.ts
SAID Ops/web-app/app/api/planning/workforce/route.ts
SAID Ops/web-app/components/AppShell.tsx
SAID Ops/web-app/components/ManagementScreens.tsx
SAID Ops/web-app/components/OpsProvider.tsx
SAID Ops/web-app/components/RosterScreen.tsx
SAID Ops/web-app/lib/employee.ts
SAID Ops/web-app/lib/planning/client.ts
SAID Ops/web-app/lib/planning/model.ts
SAID Ops/web-app/lib/planning/templates.ts
SAID Ops/web-app/lib/roster/currentPublication.ts
SAID Ops/web-app/lib/roster/templates.ts
SAID Ops/web-app/lib/roster/types.ts
SAID Ops/web-app/lib/roster/workforce.ts
SAID Ops/web-app/lib/server/admin.ts
SAID Ops/web-app/lib/server/planning.ts
SAID Ops/web-app/lib/server/planningRoute.ts
docs/STAGE_7A_DURABLE_PLANNING.md
firestore.rules
scripts/probe-ws1-locations.cjs
scripts/provision-emulator-e2e.cjs
scripts/roster-restoration-emulator.test.cjs
scripts/roster-restoration.test.cjs
scripts/stage6a-provision.test.cjs
scripts/stage6b.test.cjs
scripts/stage7a-emulator.test.cjs
scripts/stage7a.test.cjs
security-tests/package.json
security-tests/stage7a.rules.test.mjs
```

No README rewrite, dependency upgrade, merge or deployment. Generated Next.js
type reference changes are excluded from the commit. Temporary test logs,
emulator configuration, fixtures and screenshots remain ignored local artifacts.
There are no remaining Stage 7A blockers. Initial sandbox npm/emulator access
failures were resolved through authorized execution; a restoration harness
dependency was updated and its full suite then passed.
