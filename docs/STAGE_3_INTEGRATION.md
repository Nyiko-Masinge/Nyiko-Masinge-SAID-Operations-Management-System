# Stage 3: WS2 roster/scheduling integration

Starting integration commit: `aaa9eb8c4a2177080e1be2e60c39934677722063`.
Certified WS2 source: `5cbc33cc286bceadbb0aa85e362e0779e8bef6e7`.
Only WS2 is merged in this stage. WS1 and WS5 remain integrated; WS3 and WS4 are deferred.

## Conflict resolutions

| File under SAID Ops/web-app | Resolution |
| --- | --- |
| components/OpsProvider.tsx | Combine WS1 authenticated location loading, active/all location views, refresh errors, stale-response protection, workforce location IDs and historical name resolution with WS2 template validation, scheduled-work state, synchronous refs, assignment operations, generation and publication snapshots. Keep the legacy assignments/assign interfaces alongside the roster interfaces. |
| components/ManagementScreens.tsx | Keep WS1 workforce forms, location-ID selectors, historical retired options and Retry banners. Combine WS2 template validation/results, recurrence choices, independent Critical checkbox, duplicate/edit/create actions, focus containment and keyboard selection. Export the dedicated WS2 RosterScreen in place of the former roster prototype. |
| components/AppShell.tsx | Keep WS1 Firebase auth readiness, employee-derived identity, Locations navigation and asynchronous logout. Combine WS2 light/dark theme toggle and responsive shell. Remove WS2's old localStorage session gate. |
| app/layout.tsx | AuthProvider remains outside OpsProvider. Add WS2 theme/print styles, the theme initialization script and hydration guard. |
| app/globals.css | Retain WS1 Employee ID field styling and WS2 roster, critical-duty, feedback, focus and responsive styles. Use WS2's viewport-bounded scrolling modal at phone widths. |
| components/Icons.tsx | Include both WS1 mapPin and WS2 print icons in the typed icon union and SVG map. |

## Shared operational areas

WS1's authenticated shared location source is authoritative. New staff, template and
roster selections use active location IDs; legacy records without active remain active.
Retired names remain resolvable through all locations, including historical filters,
roster display, print and disabled existing-area options. Retry behavior is preserved.

WS2 retains its internal session snapshot area name. Optional locationId fields connect
templates and scheduled work to shared locations and survive editing, generation, copying
and publication. These are internal types, not a new Firestore persistence schema.
Unknown or newly selected retired locations are rejected at template/roster boundaries.
Generation/copy reports AREA_REQUIRED for new items without an active shared location.
Existing historical records are retained. Published snapshots remain isolated from edits.

The static operationalAreas module remains a labelled legacy demo fixture and is no
longer imported by integrated selectors. Demo workforce/template names are resolved
against shared locations after the first authenticated successful load. Parvo Ward
continues through the shared fixture; no backend seed or live fixture fallback is added.

## Preserved platform and dependencies

WS5 rules, the complete security suite, Firebase configuration, CI, repository hygiene,
platform documentation and locked integration contract are unchanged. Both apps'
manifests and lockfiles are unchanged from Stage 2: Next.js 15.5.27, Firebase 12.19.0,
approved React/TypeScript versions, Expo SDK 54, React Native 0.81.5 and mobile
AsyncStorage 2.2.0. No dependency drift is accepted.

No roster persistence, trusted writer, server function, WS3 task-progress integration,
or WS4 notification/history integration is implemented.

## Verification

The WS2 roster-final suite retains its certified assertions. Its provider fixture now
supplies WS1 authentication/location loading and hook effects before provider assertions.
The WS1 A-L probe retains its assertions and supports real roster-module imports and
typed template results. Added integration assertions cover Parvo template/roster IDs,
retired-area rejection, real roster-editor options, active-location generation and
published snapshot isolation followed by explicit republish.

Accumulated certification passed: repository hygiene and whitespace; web npm ci,
lint and production build on Next.js 15.5.27; mobile npm ci, typecheck and public
Expo config (SDK 54.0.0); security npm ci and the exact Auth/Firestore emulator
command (193 passed, 0 failed, 0 skipped); WS1 A-L probe and WS2 roster-final.
Every command exited 0. All 89 certified roster-final assertion lines remain.
The build regenerated only next-env.d.ts's .next-dev to .next-prod route reference;
that generated change is excluded from the merge.

UI behaviors confirmed in source still require a future browser smoke check: native
date/time pickers, print-dialog output, light/dark contrast, 390px layout, keyboard
focus containment/return, and publication/removal confirmation interactions. The unit
suites cover the underlying print selection, publication lifecycle, critical-duty
semantics, scheduling validation and atomic reassignment.
