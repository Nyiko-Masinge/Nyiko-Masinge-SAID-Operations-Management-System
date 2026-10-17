# Task 2 development contract

This is coordination guidance, not an implemented Firestore schema or an expansion of Version 1 scope.

## Authority and decisions

Use this order: (1) client-confirmed requirements, (2) `INSY7315_Task1_Source_of_Truth.pdf`, (3) agreed Task 2 development contract, (4) existing implementation evidence. Discuss unresolved contradictions as a team rather than deciding them silently in one workstream. Existing Task 1 Firestore design remains authoritative where explicit.

## Locked technology and boundaries

- **Staff mobile:** React Native, Expo, TypeScript. Owns staff access, personal schedules, assigned work and progress, relevant notifications, and staff profile views.
- **Supervisor web:** Next.js, React, TypeScript. Owns workforce and operational areas, recurring task templates, rosters, assignment and reassignment, publication, conflict/coverage monitoring, dashboard, exceptions, and history.
- **Shared backend:** Firebase Authentication, Cloud Firestore, the existing Next.js trusted API on Vercel for privileged writes, and Firebase Cloud Messaging (background push remains deferred). Both clients use the same canonical backend contracts. The pre-production Spark migration supersedes Stage 7C/7D Functions; production requires no Firebase billing or Functions deployment. Vercel is the planned web host; GitHub and GitHub Actions are the planned version-control and automation platform.

Neither app currently has backend integration. Prototype data and client state are not canonical records.

## Canonical vocabulary

| Term | Meaning for coordination |
| --- | --- |
| Task Template | Reusable definition of recurring operational work; may describe name, description, area, duration, frequency, priority, required skills, and critical flag. |
| Roster / Shift | Scheduled work for a particular period, date, time, and location; may derive from a template or be ad hoc. |
| Assignment | Relationship assigning one or more employees to scheduled work, with reassignment supported. |
| Task Progress / Status | Execution state of assigned work. Version 1 states: **Scheduled**, **In Progress**, **Completed**, **Unable to Complete**. |
| Notification | Targeted operational communication related to roster, assignment, or status events. |
| Operational History | Durable record of meaningful roster, assignment, reassignment, and status changes. |
| Employee | Staff member with a stable employee identifier. |
| Role | Authorization or operational role distinguishing permissions such as staff and supervisor. |
| Location / Operational Area | Configurable place or area associated with operational work. |

These terms do not authorize inventing Firestore collections or fields. The Task 1 PDF explicitly describes employees, roles, shifts, locations, embedded team members, and leave requests; reconcile implementation with that design before coding. Leave requests are not a new preparation workstream.

## Changes requiring coordination

Do not independently change identifiers, collection/entity names, role values, task/status values, timestamp representation, authentication or authorization model, service interfaces, Firebase environment/configuration conventions, or shared business rules. Agree on the contract before implementing either client's data access.

## Version 1 exclusions and open decisions

Version 1 excludes direct ezyVet integration and unrelated clinical, payroll, finance, adoption, lost-and-found, and SOS functionality. Preserve the Task 1 UI baseline pending client feedback.

Decisions still needed: Firebase project and environment details; exact Firestore implementation beyond explicit Task 1 structures; authorization claims and rule design; production mobile delivery method; and pending client feedback. Record outcomes here through team review before dependent work begins.

### Client validation with Sally

- **Theatre spaces (`theatre-1` vs `operating-theatre-1`):** Mobile mock data and the connectivity-proof Firestore seed keep these as two location documents (`Theatre 1` and `Operating Theatre 1`) and two shift `locationId` values. Confirm whether SAID actually has two distinct theatre spaces, or whether this is a naming inconsistency that should be reconciled once real facility data is available. Do not merge the IDs until that is confirmed.
