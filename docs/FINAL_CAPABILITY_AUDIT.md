# Final repository capability audit — 5 October 2026

This updates the earlier **“Audit Task 2 compliance”** chat (`01a10bab-1181-7440-9801-c0cbeae76979`) using the implemented Stage 7A–7G changes and Stage 7H release evidence. Authority: `INSY7315_Task1_Source_of_Truth.pdf` in this repository; the locally supplied 68-page `insy7315_mm.pdf`, sections 9.4–9.6 pp.21–23 and numeric Task 2 rubric pp.39–46. The separate marker memorandum was not supplied; no requirements are inferred from it.

**PASS** means the named repository capability has supporting local/emulator evidence. It does not mean hosted operation, every acceptance criterion, a grading result or full SoT compliance. **PARTIAL** explicitly preserves genuine gaps. **DEPLOYMENT PENDING** requires external activation/evidence; **DOCUMENTATION PENDING** requires missing human material; **ACCEPTABLE DEFERRED** is this authorized release scope and does not create an academic exemption.

## Updated operational requirements

| SoT requirement | Current status | Implementation / remaining coverage |
| --- | --- | --- |
| FR-1 identity and role access | PASS | UID-backed Firebase Auth, Employee ID alias, protected supervisor/staff flows, restored sessions; production setup pending |
| FR-2 staff operational maintenance | PASS for existing provisioned workforce; PARTIAL self-service provisioning | 7A durable job category/area/active status/availability/skills with revisions and trusted edits; role/identity creation restricted to trusted administrator |
| FR-3 operational areas | PASS | Durable configurable areas and historical references; existing location probes/rules preserved |
| FR-4 reusable templates and skills | PASS | 7A durable templates/recurrence/instructions/required skills, independent priority/criticality and authoritative source snapshots |
| FR-5 daily/ad hoc duty planning | PASS published workflow; PARTIAL draft durability | Typed create/edit/remove and trusted publication; unpublished session work has no Save Draft/recovery store |
| FR-6 weekly/copy/recurrence | PASS published workflow; PARTIAL draft recovery | Durable restoration, actual previous-publication copy, recurring work and week selection; local edits retained during refresh |
| FR-7 assignment/reassignment | PASS | UID-safe shared assignments, 7B availability/overlap/skills/coverage checks, 7C changes/history, 7D recipient messages |
| FR-8 publish/draft distinction | PASS | Complete immutable snapshots before pointer switch; publisher identity/time; explicit coverage review and visible unpublished changes; archive blocks republication |
| FR-9 task execution | PASS | Own Start/Complete/Unable/Reopen, reason/timestamp retention, canonical statuses and durable 7C event sequence; production auth-context smoke pending |
| FR-10 targeted notifications | PARTIAL | Persistent first/change/reassignment/Unable/critical-gap messages with safe issuer and idempotent read-state-preserving delivery. Scheduled approaching/overdue and authored urgent notices are absent; no background FCM |
| FR-11 scheduling conflicts | PASS | Shared client/server rules, authoritative date/time availability, UID/business identity/area validity, overlap rejection, stale-data transaction recheck |
| FR-12 uncovered critical work | PASS | Explicit staffing/skill exceptions, trusted coverage confirmation, genuine critical-gap monitoring/notification; no emergency/equipment subsystem assumed |
| FR-13 central monitoring | PASS minimum US-09 | Real duty/progress/workforce/event/inbox sources, unique counts, coverage/Unable/overdue exceptions, area grouping, date/area/employee/status, details, Refresh/error/empty/last refreshed |
| FR-14 notes and operational history | PARTIAL overall; PASS trusted committed history | Trusted publication/assignment/progress/archive events; durable contextual task/roster notes remain absent; planner creation edits are session work, not committed audit events |
| FR-15 archive | PASS minimum | Trusted atomic permanent archive, safe attribution, immutable data retained, active exclusion, blocked republish/progress and authorized historical reads |
| US-01/02 roster publication/copy | PASS published path; PARTIAL unsaved work recovery | Durable source copy, shifted independent work and recorded publisher/time; local edits have no recovery store |
| US-03–07 personal work/detail/shared assignment/reassignment/templates | PASS core; PARTIAL contextual notes | Personal time-ordered duties, safe team, trusted assignment changes/messages and durable recurring templates; durable contextual notes remain absent |
| US-08 staff task workflow | PASS core | Personal work/instructions/team and genuine execution; complete physical release ledger pending |
| US-09 supervisor monitoring | PASS minimum | Filters/details/error states and genuine projections validated; advanced analytics not implemented |
| US-10 critical warning / US-11 conflict warning | PASS | Independent critical flag, coverage override, identified overlaps/unavailable staff and trusted rejection |
| US-12 change notification | PASS minimum in-app channel | Persisted messages identify changed work, applicability and issuer; updated personal schedule is fetched on Refresh; no background FCM |
| US-13/14 outreach preparation | PARTIAL | Generic dated work/instructions/team can represent outreach; no structured route/departure/vehicle/equipment-preparation workflow. No fleet/resource subsystem added |
| US-15 historical supervisor access | PASS basic; PARTIAL rich reporting | Week/date/area/employee/status and text search, retained snapshot/progress/event detail; UI uses last pointer and latest 300 week events, no enterprise/version browser/export guarantee |
| US-16 staff historical access | PARTIAL | Own archived/current-pointer weeks, day selection and saved progress read; full duty/area/status search and displayed completion timestamps are not implemented |
| Leave request/approval model | PARTIAL / ACCEPTABLE DEFERRED release scope | Effective leave-related availability persists; request/approval lifecycle is absent |
| NFR reliability/security | PASS tested boundaries; PARTIAL production operations | Rules, revisions, immutable snapshots, session isolation and idempotency pass. Hosted performance, backup/recovery rehearsal, operational retention policy and comprehensive device/accessibility evidence pending |
| Excluded clinical/ezyVet/finance/public scope | PASS | Staff/supervisor operational split retained; no direct ezyVet integration |

## Task 2 rubric/evidence status

The manual governs assessment weights: implementation 210, presentation 60, attendance 30. These are criterion maxima, not marks awarded by this audit.

| Earlier audit ID / manual page | Criterion / maximum | Updated status |
| --- | --- | --- |
| R01 p.39 | Visual design/branding 10 | PARTIAL evidence: preserved Task 1 design and real browser screenshots; final breadth/attribution pending |
| R02 p.39 | UX/feedback 10 | PASS tested core journeys; PARTIAL complete scope/physical evidence |
| R03 p.40 | Responsive/accessibility 15 | PARTIAL: existing web viewport/keyboard QA; comprehensive mobile/tablet/screen-reader/text-scaling evidence pending |
| R04 p.40 | Programming 25 | PASS repository demonstration of typed modules, shared algorithms, validation/transactions and error handling; explanation prepared; no marks asserted |
| R05 p.40 | Database 20 | PASS core durable model; PARTIAL accepted notes/profile/leave/draft/outreach gaps |
| R06 p.41 | APIs 20 | PASS implemented trusted endpoints/workers/SDK flows; hosted end-to-end evidence pending |
| R07 p.41 | Security 20 | PASS local 193+42 rules and trusted-boundary gates; PARTIAL deployment/IAM/rate-limit and broader operational verification |
| R08 p.41 | Data flow/logic 20 | PASS integrated core, PARTIAL full SoT scope including notification timing/notes/outreach/history breadth |
| R09 p.42 | Deployment/connectivity 20 | DEPLOYMENT PENDING: real URLs, database/API connectivity, APK and hosted smoke tests |
| R10 p.42 | Hosted stability/rationale 15 | Architecture rationale documented; DEPLOYMENT PENDING stability/performance/backup evidence |
| R11 p.42 | Branching/workflow 15 | PASS existing feature/integration history and sequential stage commits; final release merge/protection evidence pending |
| R12 p.43 | CI/CD 20 | PASS repository pipeline and local equivalent; DEPLOYMENT PENDING real GitHub run and successful automatic staging/production deployment |
| R13–17 pp.44–45 | Presentation 60 | DOCUMENTATION PENDING human presentation/recording/delivery; README walkthrough prepared |
| R18 p.46 | Individual attendance 30 | DOCUMENTATION PENDING verified lecturer/team attendance/contribution records |

Manual M01–04 implementation requirements now have genuine core persistence/API/security/data-flow evidence, with PARTIAL rows above. M05 hosting and M08 automatic deployment remain DEPLOYMENT PENDING despite prepared jobs. M06/07 branching/testing are implemented; remote runs/protections still need evidence. M09/10 presentation and M12 ARC submission are human pending. M11 source+README is prepared on integration/final; it has not been merged to the default/release branch. M14/15 collaboration/conduct records are human pending. M13 optional presentation documentation is prepared; M16 Task 3 combined-report/EXPO/authenticity requirements remain outside this Task 2 request.

## Architecture reconciliation

- Vercel hosts Next pages and APIs, reconciling older Firebase Hosting text with the agreed Vercel architecture. Firebase Spark rules/indexes deploy from this repository; production Functions are retired.
- Supervisor web/staff mobile follows the accepted detailed journeys and repository contract rather than expanding both roles onto both clients.
- Next Node handlers perform trusted supervisor actions and staff progress mutations. Progress, history and required persistent inbox writes commit atomically through Firebase Admin. The Stage 7C/7D Functions implementation was superseded before production; historical evidence remains in its stage documents.
- Immutable versioned roster occurrences and nested per-UID progress replace the earlier raw-shift design additively. Stable scheduledWorkId retains progress across republish; safe projections avoid private profiles.
- FR-9's four statuses govern persistence. Paused remains local UI and Cancelled/Upcoming are not new stored status contracts.
- Persistent in-app inboxes implement the minimum released channel. FCM, scheduled critical timing and urgent-notice authoring are explicitly absent; do not describe them as completed SoT architecture.
- Historical Stage 3–6 runbooks remain evidence of their original scope. Current README/release documents supersede stale capability claims; app/platform entry documentation now links current instructions.

No percentage or mark readiness estimate is invented. Repository readiness can pass while full academic/operational coverage and cloud evidence remain partial.
