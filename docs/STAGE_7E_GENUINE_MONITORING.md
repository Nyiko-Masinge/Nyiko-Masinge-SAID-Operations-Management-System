# Stage 7E: genuine supervisor monitoring

Starting SHA: `c4e4156178dbb48d53bfe6956d452ab66c51213b`.

Live monitoring reads current immutable publication, authoritative workforce and
locations, assigned FR-9 progress, trusted events and own persistent notifications.
Reads require server responses. Separate publication/progress reads must agree
on version, and the current pointer/session are rechecked. Any required-source
failure produces ERROR, masked metrics and no "all clear". Explicit Refresh
replaces prior data, records last-refreshed time and suppresses late account/week
responses. No monitoring database or client-created audit/notification data exists.

The live roster defaults to genuine monitoring unless memory is explicitly
selected. `NEXT_PUBLIC_MONITORING_BACKEND=firestore` enables it explicitly.
The preserved demo panels and legacy provisional repositories remain separate;
their fixture data never reconciles against operational storage. Notes and manual
alert resolution remain deferred; actual roster/progress changes resolve derived
conditions on refresh.

Date/area/employee/status filters select published duties. Staff Scheduled counts
unique assigned UIDs in that selection; Total Duties counts occurrences, not staff
rows. Completed requires every assigned employee to complete the duty; In Progress
counts a duty once. Staff Unavailable counts active authoritative workforce whose
Unavailable/On Leave/Training interval overlaps the selected facility date. It is
labelled as a workforce/date metric. Missing authoritative availability fails
safely rather than inventing Available.

Attention Required counts distinct duties with unassigned/understaffed/critical
coverage, skill gaps, inability, overdue incomplete work or current operational
profile/availability exceptions. Multiple conditions remain visually distinct
without inflating that metric. Overdue starts strictly after the facility end
instant; completed work is excluded. Activity and area status use the same filtered
published duties. Opening a duty displays instructions, staffing, actual staff
progress, saved timestamps and reasons. History shows up to 300 genuine events
for the chosen week; Alerts includes genuine supervisor notifications.

One index was added: operationalEvents, weekStart ascending + occurredAt descending.
Deploy it with the rules/functions before activating production reads. No rules
or dependencies changed. Existing immutable publication/progress contracts remain.

Validation:

- 34 new focused deterministic tests passed, including model, filters, availability
  boundaries, partial-source failures, refresh, account isolation and UI date/error.
- All existing 34 monitoring Jest tests passed (5 suites).
- Certified progress/supervisor QA deterministic regression: 47 passed.
- Five actual Auth/Firestore monitoring tests and eight progress regressions passed.
- WS4 probe passed; existing fixture checks explicitly select demo boundaries.
- Web lint and production build passed; final targeted typecheck passed after UI fixes.
- Browser QA on separate loopback emulators passed: 2 duties/2 scheduled staff,
  1 unavailable/1 completed/1 attention duty, shared-staff counting, critical gap,
  all four filters, empty date, duty detail and explicit refresh. Revoking the
  QA supervisor role made source reads fail visibly with dashes/error and no
  success claims. Restoring the role and refreshing recovered genuine data.
  Native date input needed onInput as well as onChange; fixed and covered by test.
  Local viewport screenshot: `.cache/stage7e-browser.png`. No physical-device or
  production testing is claimed. The full-page capture distorted fixed sidebar
  layout; the ordinary viewport was inspected and captured correctly.

Initial test initialization ordering was fixed before the passing emulator run.
No merge, deployment, enterprise audit search or analytics expansion occurred.
