# Stage 7D: persistent operational notifications

Starting SHA: `976ef3f10aa4257f8e8ae76fb94e5517c82257d5`.

Committed RosterPublished/RosterRepublished and TaskUnableToComplete events drive
trusted Functions workers. Immutable publication differences produce deterministic
`notificationJobs` for each changed duty. Jobs fan out create-only documents to
`employees/{uid}/notifications/{jobId}`. Retries preserve both content and existing
`isRead=true`. Staff recipients come from prior/new assigned UID sets, including
removed staff. Safe messages describe the changed/removed duty, effective facility
date/time and publishing actor without exposing other employee profiles.

First publication informs assigned staff; changed times/instructions inform
unchanged assignees; reassignment informs both old and new staff. Unable events
notify active authoritative supervisors. Critical published staffing gaps notify
supervisors, including deliberate coverage overrides. Other speculative equipment,
emergency and facility sources remain deferred rather than generating fake alerts.

Mobile `EXPO_PUBLIC_MONITORING_BACKEND=firestore` explicitly enables nested live
subscriptions and recipient-only read updates. Memory remains an explicit fixture
choice and performs zero notification I/O. Live failures show error/retry states
without fixture fallback. Account changes mask old data immediately and invalidate
late callbacks. Mark-all-read batches at most 400 updates and rechecks identity.
The existing tray/alerts screens retain their display model.

The certified notification rules already enforce own reads, isRead-only updates,
and denied client create/delete. Jobs remain covered by default-deny. No rule,
index, app dependency or lockfile change was needed. FCM/background device push is
deferred: notifications arrive in the app when its live subscription is active.
Cloud Functions deployment is required for the persistent delivery channel.

Validation on Node 22.23.3/npm 10.9.9:

- 19 new focused deterministic tests (13 delivery, 6 mobile), plus 17 history tests:
  36 passed with zero failures/skips.
- Six real Auth/Firestore/Functions emulator tests passed: full publication/job/
  delivery chain, actual mobile read/mark-read, retry preservation, republish,
  removed/new staff, inability, critical gap and forged content/job isolation.
- Eight certified progress emulator tests passed with functions active.
- Original 193 security tests passed; original test file unchanged.
- Updated WS4 probe passed; obsolete disabled-live assertions were replaced with
  positive live adapter tests and stronger privacy/error tests. Fixture zero-I/O,
  account isolation and all other privacy assertions remain.
- Mobile typecheck and public Expo SDK 54 configuration passed. Diff review and
  whitespace/hygiene checks passed. No physical-device or production evidence is
  claimed.

No cloud activation, FCM, leave workflow, persistent drafts or merges occurred.
