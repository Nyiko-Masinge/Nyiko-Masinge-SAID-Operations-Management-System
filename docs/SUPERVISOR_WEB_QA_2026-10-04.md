# Supervisor web browser QA — 4 October 2026

**Verdict: NEEDS TARGETED FIX before production release.** The executed functional browser scenarios pass after nine small repairs. One low-severity recurring-generation UX issue remains. The required clean dependency installation also reports six high and three moderate package vulnerability entries; their production reachability and remediation need targeted dependency triage. No dependency upgrades were authorized or applied.

## 1. Capability, scope and evidence

Used the Codex in-app Chromium browser through its supported browser runtime against **http://localhost:3000**. Real clicks, typing, keyboard navigation, DOM inspection, screenshots, console inspection and viewport changes worked. This was browser-driven QA, with source inspection and automated tests used to diagnose and verify findings.

The available browser capability did **not** expose a request-level network inspector. Consequently this report does not certify complete HTTP status, duplicate-request or request-loop coverage. Trusted publication was exercised through the real UI and its persisted versions independently checked through the loopback Firestore emulator.

Scope: supervisor web only, on `integration/final`, using the disposable ADMIN001 account and existing Auth/Firestore emulators. STAFF001 was checked only for supervisor-web access rejection. No mobile UI was tested. No deployment, merge, branch creation, commit or push was performed. Existing automated stage gates include adapter tests; this does not constitute mobile browser/device QA.

Inspected the Task 1 source-of-truth PDF and agreed Stage 6A/B/C contracts. Kept the staff/supervisor split, existing template occurrence contracts, server authorization and Firestore rules intact.

Screens covered: login, dashboard/progress, Locations, Staff/profile/availability, Duties/templates, Roster Builder/assignment/publication, Alerts/notes, History and Settings, including their relevant dialogs and responsive navigation.

Screenshots and test logs are saved at:

`C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa`

Key evidence: [dashboard-final-1440.png](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/dashboard-final-1440.png>), [published-desktop.png](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/published-desktop.png>), [staff-light-390.png](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/staff-light-390.png>), [staff-modal-light-390.png](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/staff-modal-light-390.png>), [history-light-768.png](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/history-light-768.png>), [roster-light-768.png](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/roster-light-768.png>), [roster-modal-dark-390.png](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/roster-modal-dark-390.png>) (before) and [roster-modal-dark-fixed-390.png](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/roster-modal-dark-fixed-390.png>) (after).

## 2. Browser scenario counts

The ledger below contains **134 executed scenario criteria**. Multiple assertions within one workflow are separate criteria; retries and repair retests are not counted again. These counts are browser criteria, not automated-test totals. Initial results describe the first observation; final results include repair retests.

| Classification | Initial | Final |
| --- | ---: | ---: |
| PASS | 115 | **124** |
| FAIL | 3 | **0** |
| UX ISSUE | 7 | **1** |
| EXPECTED DEFERRED BEHAVIOR | 9 | **9** |
| Total | 134 | **134** |

The nine expected/deferred criteria include deliberate prototype behavior and explicitly marked tool limitations. They are not claims that native printing, download bytes or a full network audit passed. Additional unavailable-data/manual checks are listed separately below.

## 3. Confirmed defects and repairs

Severity: P2 = meaningful functional/accessibility defect; P3 = minor content/affordance issue. All repaired items were reproduced in the browser and retested there. Four focused automated tests cover search, role filtering, keyboard selection and the date-input event path; the full required regression gates also passed. Static copy, accessible names, native control colors and focus behavior were verified with browser DOM/keyboard/screenshot checks instead of brittle implementation-mirroring tests.

### WEB-QA-01 — False Firestore banner (P3, repaired)

**Reproduction:** Sign in to the integrated dashboard. The monitoring banner said “Nothing is written to Firestore” even though location writes and trusted roster publication use Firestore.

**Root cause:** The banner described the local monitoring adapter as if it described every feature.

**Exact fix:** In `components/AppShell.tsx`, retained the local alerts/history/notes wording and replaced the final sentence with “Integrated locations, roster publication and task progress may use Firestore.”

**Retest:** Correct banner visible after login on the final dashboard; real publication and location CRUD still passed.

### WEB-QA-02 — Employee ID staff search fails (P2, repaired)

**Reproduction:** Open Staff with the three provisioned profiles visible; search `STAFF001`. Initially no employee matched. A padded lowercase search should also work.

**Root cause:** The search predicate included only name and role.

**Exact fix:** In `components/ManagementScreens.tsx`, include `employeeId ?? id` and normalize the query with trim/lowercase.

**Retest:** Searching ` staff001 ` isolates Test Staff One; clear restores the list. Focused regression passes.

### WEB-QA-03 — Staff role filter does nothing (P2, repaired)

**Reproduction:** Select Nurse in Staff's role filter. It immediately reverted to All Roles and left the full list visible.

**Root cause:** Controlled select had a constant value and a no-op change handler.

**Exact fix:** Add role state, include it in the combined filter, derive choices from loaded workforce roles, and reset it with Clear Filters in `components/ManagementScreens.tsx`.

**Retest:** Nurse isolates STAFF001, combined search can produce an empty result, and Clear Filters restores all three. Focused regression passes.

### WEB-QA-04 — Staff/location actions lack accessible names (P2, repaired)

**Reproduction:** Inspect Staff and Locations row icon buttons in the browser accessibility/DOM snapshot. Edit, More, Retire/Reactivate controls had no useful accessible names.

**Root cause:** Icon-only actions had no text alternative; some management search/filter controls also lacked explicit names.

**Exact fix:** Add employee/location-specific labels to action buttons in `components/ManagementScreens.tsx` and `components/LocationsScreen.tsx`; label management search/filter/availability controls. Make Staff rows keyboard selectable with Enter/Space and expose selected state, matching the existing Duties/Roster pattern.

**Retest:** Browser locators resolve named actions; Staff row Enter updates the profile. Keyboard-selection focused regression passes.

### WEB-QA-05 — Location dialog focus/Escape behavior is missing (P2, repaired)

**Reproduction:** Open Add Location. It had no dialog semantics, Tab could leave the modal, and Escape did not close it.

**Root cause:** Locations used a separate minimal modal without the existing shared focus hook. The management modal also defaulted to no focus containment for Staff.

**Exact fix:** In `components/LocationsScreen.tsx`, apply the existing `useModalFocus` hook, dialog semantics, focus target and named close button. In `components/ManagementScreens.tsx`, default the existing modal's containment option to true.

**Retest:** Location modal Tab wraps from Cancel to Close, Escape closes and restores the opener. Staff modal Tab containment/Escape works; create/rename/retire/reactivate still works.

### WEB-QA-06 — Progress week input visually changes without changing the read (P2, repaired)

**Reproduction:** In Published task progress, fill the Monday input with `2026-10-05`, then Refresh progress. The displayed selection reverted and the prior week's data remained.

**Root cause:** The controlled date field handled only the change path; the observed native input event path did not update the selected-week state.

**Exact fix:** In `components/Dashboard.tsx`, extract the existing Monday validation into `selectProgressWeek` and handle both input and change events, following the existing roster date-control pattern.

**Retest:** 5 October stays selected and shows empty data; 19 October shows the two real QA publication assignments; 28 September returns the baseline Scheduled row. Focused regression verifies both event paths and rejects non-Mondays.

### WEB-QA-07 — Hidden narrow sidebar receives focus; open drawer ignores Escape (P2, repaired)

**Reproduction:** At 390px, Shift+Tab with the drawer closed reached offscreen Logout (observed x approximately -304px). Open the drawer and press Escape; it stayed open.

**Root cause:** CSS moved the sidebar offscreen without making it inert; the open drawer had no modal focus lifecycle.

**Exact fix:** In `components/AppShell.tsx`, track the existing 1024px compact breakpoint, make the closed compact sidebar inert, reuse `useModalFocus` for the open drawer, expose dialog/expanded semantics and close it when returning to desktop width.

**Retest:** Hidden navigation is excluded from keyboard focus. Open drawer traps Tab from Logout to Close navigation; Escape closes it and restores Open navigation. Drawer links still navigate/close and desktop navigation works.

### WEB-QA-08 — Dark native date/time icons have poor contrast (P3, repaired)

**Reproduction:** At 390px in dark mode, open Create Roster Item. Native calendar/clock glyphs stayed black against dark inputs.

**Root cause:** The dark root did not declare a native color scheme, although the light theme already did.

**Exact fix:** Add `:root{color-scheme:dark}` in `app/theme.css`, retaining the existing light override.

**Retest:** Dark calendar/time glyphs are visibly readable; light controls remain appropriate. Before/after screenshots linked above.

### WEB-QA-09 — Decorative staff pagination implies unavailable pages (P3, repaired)

**Reproduction:** In Staff, click page 2 or the arrow controls. They did nothing; all rows were already rendered.

**Root cause:** Static pagination buttons had no behavior.

**Exact fix:** Remove the four decorative buttons from `components/ManagementScreens.tsx`; retain the accurate “Showing N staff” count.

**Retest:** No dead page controls remain, and all staff/search/filter rows remain accessible. Focused Staff tests and the final build pass.

## 4. Defects and behavior intentionally deferred

### WEB-QA-10 — Recurring generation message is excessively repetitive (P3, UX ISSUE)

**Reproduction:** In a disposable week, click Generate Recurring Duties with the existing demo templates and emulator locations. The action created 21 valid occurrences but repeated 68 invalid-area messages, one per skipped generated date.

**Root cause:** Demo templates whose area does not resolve to an active integrated location are individually rejected, with per-occurrence messages accumulated into one notice.

**Disposition:** Leave validation intact. Summarize skipped occurrences by template/reason and/or separately align demo fixtures with real locations in a later targeted change. No invalid location work was silently accepted or published. No new durable template workflow was implemented.

### DEP-QA-01 — Dependency audit requires release triage (high/moderate package flags)

The successful `npm ci` reported **9 package vulnerability entries: 6 high, 3 moderate, 0 critical**. [said-web-qa-audit-final.json](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/said-web-qa-audit-final.json>) contains the complete `npm audit --json` result, affected ranges, advisory URLs and dependency paths.

| Package entries | Audit severity |
| --- | --- |
| firebase, @firebase/firestore, @firebase/firestore-compat, @grpc/grpc-js, postcss, sharp | High (6 entries) |
| gaxios, next, uuid | Moderate (3 entries) |

Some entries inherit the same underlying advisory; this is not nine independently demonstrated exploitable application defects. No exploitability or production reachability determination was completed. The audit includes grpc authentication/error disclosure, PostCSS output/source-map handling, sharp image-library and uuid buffer-bound issues.

**Disposition:** Before production release, establish whether these paths are reachable, then make an explicitly approved dependency correction or document a justified risk decision. Dependency upgrades were forbidden in this pass, so the lockfile and dependency versions are unchanged. This unresolved release triage drives the verdict; the 193 security-rule tests passing does not resolve package advisories.

### Prototype contracts and advisory affordances

- Forgot Password and SSO look clickable before explaining that the workflow is unavailable/not connected. Their clicks return honest explanatory messages; no real reset or SSO was attempted. P3 advisory: consider communicating unavailability before the click in a future copy/affordance change.
- Add/Edit Staff and availability changes clearly describe a local session roster pool. Add Staff does not create Auth accounts. An unprovisioned local employee is correctly rejected by trusted publication.
- Existing template-backed occurrence title/description remain read-only during edit, as explicitly required by the frozen occurrence regression. **New** template-backed occurrence creation permits the requested title/description/date/time/area/required-staff overrides. This established contract was not changed.
- Alerts, History, notes and prototype notification preferences remain local/demo. No live monitoring, history, leave, notes or notification persistence was enabled.

## 5. Browser coverage limits and manual checks

- Only one supervisor account exists. Repeated ADMIN001 logout/login and removal of a local session sentinel passed; actual switching between two supervisors was not exercised. Stage 6A race/isolation tests passed.
- No persisted task progress existed. Browser checks verified truthful Scheduled/Not started rows and empty-week behavior; no progress was fabricated. In Progress, Completed, Unable to Complete, and transient progress loading/error states were not verified with live browser data. Stage 6C deterministic/emulator tests cover those states.
- Valid Print Roster invoked the native print flow, which blocked further browser automation in that tab. Empty-roster print correctly rejected. The blocked tab was closed, a fresh tab continued QA, and the final dashboard is available. Print preview/pagination/output still needs a human check.
- History Export reported two JSON rows exported. The browser download event was not exposed within the wait; saved file bytes were not verified. A human download/open check remains.
- Full request-level 4xx/5xx, duplicate-request and request-loop auditing was unavailable. This is a tooling limitation, not a passed network criterion.
- No formal WCAG certification, screen-reader audit, or exhaustive touch-target/contrast measurement was performed.

## 6. Console and network findings

Normal functional browser runs showed no uncaught application JS errors, React warnings, hydration warnings or Firestore permission-denied errors in the inspected console.

A tooling interruption occurred during required `npm ci`: running it while the Windows Next dev process held native dependency files caused EPERM and a partial install. That produced **54 console log entries** from missing modules/dev-server disconnections, saved in [console-log.json](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/console-log.json>). Their latest timestamp was `14:33:36.591Z`. These are explicitly tooling-induced, not hidden product failures.

Recovery verified and stopped only the web dev process listening on port 3000, completed a clean locked install with the existing certified Node 22.23.3/npm 10.9.9 runtime, and restarted the integrated web server with the known disposable emulator configuration. The restored browser app passed retests with no new warning/error entries. User Auth/Firestore emulators were preserved.

Wrong credentials and non-supervisor access were expected authorization failures. Automated Stage 6 gates also verified expected unauthorized/forbidden and invalid-publication responses. Failed stale-location/unprovisioned publication displayed errors without success. Because there was no request inspector, no comprehensive claim is made about all API statuses, network loops or duplicate requests.

## 7. Responsive, accessibility and theme findings

Tested browser viewports **1440 × 1000**, **768 × 1024**, and **390 × 844**.

Desktop dashboard/builder, tablet history/builder and narrow Staff/builder/login were usable. Wide tables scroll within their containers; narrow modals scroll with reachable controls. The narrow login reflows into a scrollable single-column layout. Sidebar/drawer navigation and modal close/save controls were exercised. The viewport was reset after QA.

Keyboard checks covered Tab/Shift+Tab, visible native focus, Escape, Enter and row-selection behavior. The roster staff-search input visibly retained its native focus outline. Named icon actions, dialog semantics and focus containment were repaired as recorded above. Staff row keyboard selection was added and checked. No formal compliance claim is made.

Light/dark mode was switched on multiple screens and dialogs. Status chips, text, borders and modal content were visually inspected. The confirmed dark native date/time glyph issue was fixed; the light theme remains correct. No UI redesign was performed.

## 8. Publication evidence and cleanup

The real UI created a fully staffed QA publication for week `2026-10-19`, showed Published, changed the draft to Published – Unpublished changes, and explicitly republished.

The first version `51a67269-f004-4c98-8aa0-358ae50948c3` retained its 11:00 end time after version `f5690827-4453-415e-afae-65cfbfcbb231` published the 11:30 draft. See [said-qa-publication-before.json](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/said-qa-publication-before.json>) and [said-qa-publication-after.json](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/said-qa-publication-after.json>). A third version exercised the intended nonblocking critical-coverage confirmation.

Cleanup removed only the disposable QA area, three QA item documents, three QA version parents and the QA week metadata after checking their identities/title. Local draft/template/staff changes were cleared through the session lifecycle.

The original `2026-09-28` baseline publication remained unchanged, current version `e9c633c8-9ae4-4389-a1d1-25a4d429d74a`; all four baseline locations remain. The final dashboard again shows the original “E2E Test - Parvo Ward Round” assigned to Test Staff One as Scheduled. See [said-web-qa-cleanup.json](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/said-web-qa-cleanup.json>). No task progress was created for cosmetic metrics.

## 9. Final automated regression

| Required gate | Result |
| --- | --- |
| Repository hygiene (`scripts/check-repository-hygiene.sh`) | PASS |
| Web `npm ci` | PASS, lockfile unchanged; audit findings above |
| Web `npm run lint` | PASS |
| Web `npm run build` | PASS, including integrated Firestore configuration |
| Security rules suite | **193/193 PASS** |
| WS1 location probe | PASS |
| WS2 `tests/roster-final.cjs` | PASS |
| WS4 monitoring Jest | **34/34 PASS**, 5 suites |
| Stage 6A deterministic | **37/37 PASS** |
| Stage 6B deterministic | **37/37 PASS** |
| Stage 6C deterministic | **43/43 PASS** |
| Existing template/occurrence regression | **11/11 PASS** |
| New focused web QA tests | **4/4 PASS** |
| Combined deterministic run above | **132/132 PASS** |
| Stage 6A provisioning on isolated real emulators | **5/5 PASS** |
| Stage 6B on isolated real emulators | **10/10 PASS** |
| Stage 6C on isolated real emulators | **8/8 PASS** |
| `git diff --check` | PASS |

Isolated security/stage emulator runs used temporary configurations/free ports, shut down their own emulators and did not replace the user's running fixtures. Logs: [said-web-qa-security.log](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/said-web-qa-security.log>), [said-web-qa-stage-emulators.log](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/said-web-qa-stage-emulators.log>), [said-web-qa-deterministic-final.log](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/said-web-qa-deterministic-final.log>), [said-web-qa-focused-final.log](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/said-web-qa-focused-final.log>), [said-web-qa-jest.log](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/said-web-qa-jest.log>), [said-web-qa-npm-ci-final.log](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/said-web-qa-npm-ci-final.log>), [said-web-qa-build-final.log](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/said-web-qa-build-final.log>) and [said-web-qa-build-integrated.log](<C:/Users/User/.codex/visualizations/2026/10/04/01a10740-8bbd-7fb1-b2d3-00b3a73da2e4/supervisor-web-qa/said-web-qa-build-integrated.log>).

Representative commands (run from repository root unless noted):

```text
bash scripts/check-repository-hygiene.sh
node scripts/probe-ws1-locations.cjs
node "SAID Ops/web-app/tests/roster-final.cjs"
node --test scripts/stage6a.test.cjs scripts/stage6b.test.cjs scripts/stage6c.test.cjs "SAID Ops/web-app/tests/roster-template-occurrence.test.cjs" "SAID Ops/web-app/tests/supervisor-web-qa.test.cjs"
# In SAID Ops/web-app:
npm ci
npm run lint
npm run build
npm run test -- --runInBand
```

Only known generated `next-env.d.ts` output was restored. No rules, indexes, mobile source, shared contracts or dependency manifests were changed.

## 10. Exact files, SHA, push and final Git state

| Status | File | Purpose |
| --- | --- | --- |
| M | [SAID Ops/web-app/app/theme.css](<C:/Users/User/Desktop/insy7315/insy7315-2026-task-2-group-11/SAID Ops/web-app/app/theme.css>) | Native dark controls |
| M | [SAID Ops/web-app/components/AppShell.tsx](<C:/Users/User/Desktop/insy7315/insy7315-2026-task-2-group-11/SAID Ops/web-app/components/AppShell.tsx>) | Honest banner and drawer focus |
| M | [SAID Ops/web-app/components/Dashboard.tsx](<C:/Users/User/Desktop/insy7315/insy7315-2026-task-2-group-11/SAID Ops/web-app/components/Dashboard.tsx>) | Week date input |
| M | [SAID Ops/web-app/components/LocationsScreen.tsx](<C:/Users/User/Desktop/insy7315/insy7315-2026-task-2-group-11/SAID Ops/web-app/components/LocationsScreen.tsx>) | Named actions and dialog focus |
| M | [SAID Ops/web-app/components/ManagementScreens.tsx](<C:/Users/User/Desktop/insy7315/insy7315-2026-task-2-group-11/SAID Ops/web-app/components/ManagementScreens.tsx>) | Staff search/filter, labels/keyboard, focus and pagination |
| ?? | [SAID Ops/web-app/tests/supervisor-web-qa.test.cjs](<C:/Users/User/Desktop/insy7315/insy7315-2026-task-2-group-11/SAID Ops/web-app/tests/supervisor-web-qa.test.cjs>) | Four focused regressions |
| ?? | [docs/SUPERVISOR_WEB_QA_2026-10-04.md](<C:/Users/User/Desktop/insy7315/insy7315-2026-task-2-group-11/docs/SUPERVISOR_WEB_QA_2026-10-04.md>) | This report and complete scenario ledger |

**Resulting SHA:** HEAD remains `519940fda78ac88e3f30a6f9ad446a16900030c0`. Changes are uncommitted; therefore there is no new resulting commit SHA.

**Push result:** Not attempted; no commit/push was requested.

**Final Git status:** Five modified production files and two untracked additions listed above, on `integration/final`. The working tree was clean before QA. No merge or deployment occurred.

## 11. Remaining web release decisions

1. Triage the high/moderate dependency findings and approve any required dependency correction or documented risk decision before production release.
2. Manually verify native Print Roster output and downloaded History JSON.
3. Complete request-level network inspection in a browser with that capability, plus a two-supervisor session switch when a second supervisor fixture is available.
4. Treat remaining recurring-generation notice verbosity as a P3 follow-up. Deferred workflows remain outside this web QA scope.

The core executed web workflows have no remaining FAIL classification. The verdict is **NEEDS TARGETED FIX** because dependency release triage remains unresolved; manual checks are explicitly incomplete. Web QA stops here.

## 12. Complete browser scenario ledger

| # | Area | Executed scenario criterion | Initial | Final |
| ---: | --- | --- | --- | --- |
| 1 | Capability | Localhost opens | PASS | PASS |
| 2 | Capability | Live UI interaction | PASS | PASS |
| 3 | Capability | Console warnings/errors can be read | PASS | PASS |
| 4 | Capability | Request inspector availability checked; unavailable | EXPECTED DEFERRED BEHAVIOR | EXPECTED DEFERRED BEHAVIOR |
| 5 | Authentication | ADMIN001 successful sign-in | PASS | PASS |
| 6 | Authentication | Wrong password rejected | PASS | PASS |
| 7 | Authentication | Unknown Employee ID rejected | PASS | PASS |
| 8 | Authentication | Trimmed lowercase admin001 accepted | PASS | PASS |
| 9 | Authentication | Logout clears protected UI | PASS | PASS |
| 10 | Authentication | Login again after logout | PASS | PASS |
| 11 | Authentication | Refresh while signed in | PASS | PASS |
| 12 | Authentication | Refresh while signed out | PASS | PASS |
| 13 | Authentication | Direct /dashboard while signed out redirects to / | PASS | PASS |
| 14 | Authentication | Direct /roster while signed out redirects to / | PASS | PASS |
| 15 | Authentication | Immediate navigation after logout stays signed out | PASS | PASS |
| 16 | Authentication | Repeated login/logout cycles | PASS | PASS |
| 17 | Authentication | Local session sentinel removed after logout/login | PASS | PASS |
| 18 | Authentication | STAFF001 denied supervisor web access | PASS | PASS |
| 19 | Authentication | Forgot Password displays unavailable/reset-contact message | EXPECTED DEFERRED BEHAVIOR | EXPECTED DEFERRED BEHAVIOR |
| 20 | Authentication | SSO displays not-connected message | EXPECTED DEFERRED BEHAVIOR | EXPECTED DEFERRED BEHAVIOR |
| 21 | Authentication | Enter activates sign-in | PASS | PASS |
| 22 | Dashboard | Dashboard loads with 4 Oct 2026 / Sunday | PASS | PASS |
| 23 | Dashboard | Completed/In Progress count only published assignments | PASS | PASS |
| 24 | Dashboard | Activity/area/local metrics have demo labels | PASS | PASS |
| 25 | Dashboard | Incorrect Firestore banner reproduced and corrected | UX ISSUE | PASS |
| 26 | Dashboard | View Staff card opens staff screen | PASS | PASS |
| 27 | Dashboard | View Roster card opens builder | PASS | PASS |
| 28 | Dashboard | Add Duty quick action opens templates | PASS | PASS |
| 29 | Dashboard | Generate Report quick action opens local history | PASS | PASS |
| 30 | Locations | Four fixture names and active/legacy/retired states | PASS | PASS |
| 31 | Locations | Active tab excludes retired fixture | PASS | PASS |
| 32 | Locations | Retired tab includes retired fixture | PASS | PASS |
| 33 | Locations | All Locations shows all four | PASS | PASS |
| 34 | Locations | Parvo search filters rows | PASS | PASS |
| 35 | Locations | Create active disposable area | PASS | PASS |
| 36 | Locations | Rename disposable area | PASS | PASS |
| 37 | Locations | Retire disposable area | PASS | PASS |
| 38 | Locations | Reactivate disposable area | PASS | PASS |
| 39 | Locations | Retired areas excluded from new roster picker | PASS | PASS |
| 40 | Locations | Retired name still resolves in existing roster | PASS | PASS |
| 41 | Staff | ADMIN001/STAFF001/STAFF002 names, IDs and job categories | PASS | PASS |
| 42 | Staff | Provisioned profiles show Active / Available defaults | PASS | PASS |
| 43 | Staff | Employee ID search fails, then trimmed case-insensitive search passes | FAIL | PASS |
| 44 | Staff | Role filter fails, then Nurse filter and Clear Filters pass | FAIL | PASS |
| 45 | Staff | On Leave tab filters affected employee | PASS | PASS |
| 46 | Staff | Session availability changes affect roster pool | PASS | PASS |
| 47 | Staff | Edit staff name locally and restore it | PASS | PASS |
| 48 | Staff | Add Staff creates only local pool entry, not Auth user | EXPECTED DEFERRED BEHAVIOR | EXPECTED DEFERRED BEHAVIOR |
| 49 | Staff | Save wording explicitly says local session / no Firestore | PASS | PASS |
| 50 | Staff | Dummy pagination page 2 has no effect; controls removed | UX ISSUE | PASS |
| 51 | Staff | More actions explicitly explains prototype behavior | EXPECTED DEFERRED BEHAVIOR | EXPECTED DEFERRED BEHAVIOR |
| 52 | Templates | Create low-priority critical template | PASS | PASS |
| 53 | Templates | Edit description locally | PASS | PASS |
| 54 | Templates | Duplicate valid template | PASS | PASS |
| 55 | Templates | Deactivate / Inactive tab | PASS | PASS |
| 56 | Templates | Activate template again | PASS | PASS |
| 57 | Templates | Whitespace name validation | PASS | PASS |
| 58 | Templates | Invalid default time validation | PASS | PASS |
| 59 | Templates | Zero duration validation | PASS | PASS |
| 60 | Templates | High priority can be noncritical; Low can be critical | PASS | PASS |
| 61 | Templates | Occurrence overrides preserve source template; later source edit preserves occurrence critical snapshot | PASS | PASS |
| 62 | Templates | Existing template-backed occurrence title/description stay read-only under certified behavior | EXPECTED DEFERRED BEHAVIOR | EXPECTED DEFERRED BEHAVIOR |
| 63 | Roster | Template selection prefills defaults | PASS | PASS |
| 64 | Roster | Override new occurrence title, description, date, times, area and required staff | PASS | PASS |
| 65 | Roster | Create independent ad hoc work | PASS | PASS |
| 66 | Roster | Reject missing work title | PASS | PASS |
| 67 | Roster | Reject end before start | PASS | PASS |
| 68 | Roster | Reject zero required staff | PASS | PASS |
| 69 | Roster | Reject fractional required staff | PASS | PASS |
| 70 | Roster | Assign STAFF001 | PASS | PASS |
| 71 | Roster | Assign STAFF002 | PASS | PASS |
| 72 | Roster | Unassign staff | PASS | PASS |
| 73 | Roster | Reassign atomically | PASS | PASS |
| 74 | Roster | Staff-pool role search | PASS | PASS |
| 75 | Roster | Unassigned / understaffed / fully staffed counters | PASS | PASS |
| 76 | Roster | Same-person overlap rejected | PASS | PASS |
| 77 | Roster | Back-to-back assignment allowed | PASS | PASS |
| 78 | Roster | On Leave assignment rejected | PASS | PASS |
| 79 | Roster | Unavailable assignment rejected | PASS | PASS |
| 80 | Roster | Uncovered Critical warning visible | PASS | PASS |
| 81 | Roster | Critical warning clears with full coverage | PASS | PASS |
| 82 | Roster | Copy empty previous week reports empty source | PASS | PASS |
| 83 | Roster | Copy existing previous week creates unassigned draft copy | PASS | PASS |
| 84 | Roster | Generate recurring work creates valid items but repeats 68 invalid-area messages | UX ISSUE | UX ISSUE |
| 85 | Roster | Whole-week counts match coverage | PASS | PASS |
| 86 | Roster | Cancel deletion preserves item | PASS | PASS |
| 87 | Roster | Confirm deletion removes ad hoc item | PASS | PASS |
| 88 | Roster | All seven day buttons navigate | PASS | PASS |
| 89 | Roster | Empty Print Roster gives truthful error | PASS | PASS |
| 90 | Roster | Valid Print Roster invokes native print; preview automation blocked | EXPECTED DEFERRED BEHAVIOR | EXPECTED DEFERRED BEHAVIOR |
| 91 | Publication | Fully staffed trusted Firestore publication succeeds | PASS | PASS |
| 92 | Publication | Published lifecycle and success wording | PASS | PASS |
| 93 | Publication | Draft edit produces Published - Unpublished changes | PASS | PASS |
| 94 | Publication | Explicit republish creates new version | PASS | PASS |
| 95 | Publication | Previous immutable version remains at 11:00 while new version ends 11:30 (browser action + emulator read evidence) | PASS | PASS |
| 96 | Publication | Coverage confirmation / Publish Anyway remains nonblocking for critical shortage | PASS | PASS |
| 97 | Publication | Retired location rejects stale draft publication without success | PASS | PASS |
| 98 | Publication | Unprovisioned employee blocks publication with its ID | PASS | PASS |
| 99 | Progress | Valid Monday input previously reverted; corrected selector holds chosen week | FAIL | PASS |
| 100 | Progress | Empty week shows no assigned published work and unavailable metrics | PASS | PASS |
| 101 | Progress | Baseline duty shows Scheduled / Not started | PASS | PASS |
| 102 | Progress | QA publication shows two genuine assigned rows, both Scheduled | PASS | PASS |
| 103 | Progress | Refresh reloads persisted progress view | PASS | PASS |
| 104 | Alerts / notes | Alerts navigate and show local/demo banner | PASS | PASS |
| 105 | Alerts / notes | Search produces truthful empty filtered table | PASS | PASS |
| 106 | Alerts / notes | Empty Conflicts filter | PASS | PASS |
| 107 | Alerts / notes | Selected alert initially has no notes | PASS | PASS |
| 108 | Alerts / notes | Enter saves local operational note | PASS | PASS |
| 109 | Alerts / notes | Review & Resolve records local resolution | PASS | PASS |
| 110 | History / settings | History shows the local QA resolution | PASS | PASS |
| 111 | History / settings | History search | PASS | PASS |
| 112 | History / settings | History empty search result | PASS | PASS |
| 113 | History / settings | Alert Resolutions filter | PASS | PASS |
| 114 | History / settings | Export action reports two JSON rows; download event not exposed | EXPECTED DEFERRED BEHAVIOR | EXPECTED DEFERRED BEHAVIOR |
| 115 | History / settings | Settings profile displays real supervisor ID and role | PASS | PASS |
| 116 | History / settings | Prototype notification preference toggles local wording | EXPECTED DEFERRED BEHAVIOR | EXPECTED DEFERRED BEHAVIOR |
| 117 | Responsive / theme / accessibility | 1440px desktop dashboard/builder layout | PASS | PASS |
| 118 | Responsive / theme / accessibility | 768px tablet history/roster layout; contained table scrolling | PASS | PASS |
| 119 | Responsive / theme / accessibility | 390px staff table/filter layout; contained table scrolling | PASS | PASS |
| 120 | Responsive / theme / accessibility | 390px staff/template/roster modals remain scrollable | PASS | PASS |
| 121 | Responsive / theme / accessibility | 390px login reflows and has reachable controls | PASS | PASS |
| 122 | Responsive / theme / accessibility | Drawer links navigate and close drawer | PASS | PASS |
| 123 | Responsive / theme / accessibility | Light/dark switches on dashboard and management screens | PASS | PASS |
| 124 | Responsive / theme / accessibility | Light modal contrast | PASS | PASS |
| 125 | Responsive / theme / accessibility | Dark modal contrast / independent critical checkbox | PASS | PASS |
| 126 | Responsive / theme / accessibility | Dark native date/time glyphs had low contrast; dark color scheme corrected | UX ISSUE | PASS |
| 127 | Responsive / theme / accessibility | Staff/location icon actions lacked names; names corrected | UX ISSUE | PASS |
| 128 | Responsive / theme / accessibility | Location modal lacked dialog/Escape/focus protection; repaired | UX ISSUE | PASS |
| 129 | Responsive / theme / accessibility | Hidden drawer captured focus and Escape failed; repaired | UX ISSUE | PASS |
| 130 | Responsive / theme / accessibility | Staff row Enter selects profile | PASS | PASS |
| 131 | Responsive / theme / accessibility | Roster row Enter selects occurrence on narrow layout | PASS | PASS |
| 132 | Responsive / theme / accessibility | Roster staff-search input has visible native keyboard focus | PASS | PASS |
| 133 | Responsive / theme / accessibility | Staff modal Tab wraps to close; Escape closes | PASS | PASS |
| 134 | Responsive / theme / accessibility | Location modal Tab wraps and Escape restores opener | PASS | PASS |
