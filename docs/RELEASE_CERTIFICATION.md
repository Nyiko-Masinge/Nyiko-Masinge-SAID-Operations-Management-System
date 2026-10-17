# Current architecture amendment — Firebase Spark

The Stage 7C/7D Cloud Functions implementation described below was superseded before production by the existing Next.js trusted API on Vercel. Current runtime: Firebase Spark Auth/Firestore/rules/indexes; trusted Next staff progress, operational events and direct persistent inbox writes; EAS mobile distribution. No Blaze plan, Firebase payment method or Functions deployment is required. The certification below records historical tests and implementation; it is not evidence of the migrated runtime. See [Spark migration evidence](SPARK_MIGRATION.md) and [current release pipeline](RELEASE_PIPELINE.md) for current contracts, gates and deployment prerequisites.

# SAID Ops consolidated Stage 7C–7H release certification

5 October 2026. **READY FOR PRODUCTION SETUP/DEPLOYMENT**: repository-side gates pass. This verdict does not claim a hosted release, APK, full SoT coverage or an academic mark. Cloud activation and physical release evidence remain pending.

## 1. Starting state

Clean `integration/final`, verified starting SHA `a1eef8a99bf736a609627b7e09159abd952a4944`. Stages 7A/7B, certified Stage 6 contracts and original negative security tests remain intact. Each stage was implemented, tested, reviewed, committed and pushed before the next began. No development/main merge or production deployment occurred.

## 2–7. Completed stages and commits

| Stage | Result and validation | Commit |
| --- | --- | --- |
| 7C | Trusted publication/assignment events, safe publisher metadata, actual before/after progress events with idempotent CloudEvent IDs and honest system provenance. 25 focused + 221 affected deterministic; 4 history integration + 1 actual trigger; 193+42 rules; publication/progress/scheduling 10/8/17; lint/build/hygiene passed. | `976ef3f10aa4257f8e8ae76fb94e5517c82257d5` |
| 7D | Trusted event→job→recipient inbox, removed/new assignment recipients, Unable/critical supervisor messages, live mobile read state and isolated error/account handling. 19 new +17 history deterministic; 6 actual notification integration +8 progress; original193 rules, mobile type/config and stronger WS4 passed. | `c4e4156178dbb48d53bfe6956d452ab66c51213b` |
| 7E | Genuine monitoring from publication, workforce, progress, events/inbox; counts, coverage/Unable/overdue, areas, filters/details/Refresh and required-source error states. 34 new +34 existing Jest +47 affected deterministic; 5 monitoring +8 progress integration; genuine emulator browser QA, lint/build/WS4 passed. | `1dade37f24ae173ca4b232331fff3968f0292333` |
| 7F | Trusted atomic archive metadata/event, retained immutable data, active exclusion, blocked republish/progress and authorized own historical reads/search. 13 new within220 affected tests; 9 archive integration plus5/8/17/5 monitoring/progress/scheduling/restoration;193+42 rules, lint/build/mobile/probe/browser QA passed. | `5d1cac1015e368edd9adaa9b01693c5cd9ea09e5` |
| 7F follow-up | One trailing-blank-line issue was discovered by whitespace review after the application commit because that shell invocation did not fail fast. Immediately corrected separately and checked before 7G; subsequent commit gates fail fast. No application contract change. | `bee82e58b92422ef0c5f0bf043e7d99328e37d07` |
| 7G | Locked release CI, conditional expensive integration, test-gated environment-scoped Firebase→Vercel→conditional EAS delivery, disabled independent Git deployment, credential/env validation. 16 new tests; complete734 tests, then3 WS probes and static/build checks; actionlint passed. No actual delivery claimed. | `d7eafbdbea8471e843ced0a131b3197d2a0d265e` |
| 7H | Current root/app/platform documentation, capability/rubric audit, provisioning/demo plan, physical ledger, dependency disposition, real browser screenshots, recovery plan and clean-install final certification. Added omitted existing WS2 assertions to shared runner and disabled local archived checklist interaction. Complete734 tests plus all4 WS probes and static/build checks passed. | `Prepare SAID Ops release for deployment`; exact SHA is recorded in the final delivery report / `git log -1` |

Focused stage evidence: [7C](STAGE_7C_OPERATIONAL_HISTORY.md), [7D](STAGE_7D_NOTIFICATIONS.md), [7E](STAGE_7E_GENUINE_MONITORING.md), [7F](STAGE_7F_ARCHIVE_HISTORY.md), [7G](STAGE_7G_CI_DELIVERY.md). Initial fixture/startup/test-command issues were corrected within their stage before continuation; no failed application gate was carried forward.

## 8. Files by stage

The complete commit-derived inventory is appended below. Generated Next type references were restored; emulator/build caches, credentials and device claims are not committed.

## 9. Firestore rules and indexes

7C adds supervisor-only operationalEvents reads with all client event writes denied. Notification contents/jobs stay trusted-only; existing recipient rules permit only own `isRead` changes. 7E adds the `operationalEvents` composite query index (`weekStart` ASC, `occurredAt` DESC). 7F rejects progress create/update when the referenced weekly root is archived, while preserving original authorized historical reads. No staff access to superseded publication versions or other staff progress was opened. Original193 and additional42 rules tests passed; original test source is unchanged from the starting SHA.

## 10. Trusted backend additions

Scoped Node22 `functions/` uses pinned Admin14.5.0/Functions7.4.0: `recordTaskProgress`, `queueOperationalNotifications`, `deliverOperationalNotifications`. At the original Stage 7C–7H certification the source selected `europe-west1`; those tests ran locally/emulator-side, not in a deployed regional environment. Before the first production deployment, the final gen2 source configuration was aligned to the production Firestore location, `africa-south1` (Johannesburg). This does not relabel the earlier test runs as Johannesburg cloud evidence. Publication events commit through the existing verified Next publisher transaction; archive uses authenticated `POST /api/rosters/archive`. Clients cannot create events/jobs/inbox content. Missing trigger auth context is explicitly system/service with affected owner UID; actual production staff auth propagation requires smoke evidence. No callable public trigger endpoint or custom monitoring database was added.

## 11. Final automated evidence

| Gate after clean installs | Passing count |
| --- | ---: |
| Deterministic Stage6/7, roster/QA and Functions unit tests | 383 |
| Existing monitoring Jest tests (5 suites) | 34 |
| Original Firestore security rules | 193 |
| Additional operational rules | 42 |
| Auth/Firestore/Next integration: provisioning5, publication10, progress8, restoration5, workforce/templates12, scheduling17, history4, monitoring5, archive9 | 75 |
| Actual Functions history1 + notification6 | 7 |
| **Countable total** | **734** |

Zero failures, skipped or cancelled tests in these final suites. All four WS1/2/3/4 assertion probes pass; they are not inflated into the count. Clean `npm ci` passed for web/mobile/security/functions with Node22.23.3/npm10.9.9. Web lint and production build, mobile typecheck/public Expo config, Functions syntax, repository hygiene, actionlint1.7.12 and diff whitespace pass. The local Functions discovery timeout is60s to allow actual Windows emulator startup; all three workers registered. Logs and parsed totals are retained in [evidence](evidence/automated-test-summary.json). Local Windows evidence does not claim successful remote Ubuntu CI execution.

## 12. Dependency baseline

Web/mobile/security manifests+lockfiles and original193/42 rule-test files remain unchanged from starting SHA. Next15.5.27, sharp0.35.4, Expo54.0.37, RN0.81.5, React, TypeScript and certified Firebase baselines remain intact. Functions is the allowed scoped addition; deployment CLIs are separately pinned. No broad audit fix/upgrades performed. Fresh audit reports web8 (5high/3moderate), mobile41 (31high/10moderate), security-test5high, Functions2moderate, zero critical. [Risk decision and reachability constraints](DEPENDENCY_SECURITY_DECISION.md) preserve earlier approved triage; passing tests are not a vulnerability-free statement.

## 13. Partial, deferred and human evidence

[Capability/rubric audit](FINAL_CAPABILITY_AUDIT.md) maps FR1–15, US1–16, manual requirements and rubric criteria. Partial: durable contextual notes, timed approaching/overdue and authored urgent notifications, structured outreach preparation, full staff historical search/completion-time display, profile edits and leave workflow, unpublished recovery. Deferred authorized scope: FCM, persistent Save Draft, full leave approval, fleet/equipment booking, route optimization, advanced analytics, enterprise audit search, app-store/ezyVet. Device/accessibility breadth, released-APK inspection, hosted security/performance and recovery rehearsal pending. These are not claimed academic exemptions. Human team attribution, presentation/attendance/ARC evidence remains DOCUMENTATION PENDING. [Physical/browser ledger](MOBILE_QA_LEDGER.md) distinguishes previous user observations from emulator work; no fresh physical tests or screenshots were invented.

## 14–18. Exact external production prerequisites/actions

Follow [Release pipeline setup](RELEASE_PIPELINE.md), which specifies every service/environment field and activation order. Required actions:

1. **Firebase:** create or verify separate real staging/production projects; production Firestore uses africa-south1 and the final operational gen2 Functions explicitly select africa-south1; verify staging location compatibility before activation; enable required billing/APIs and Email/Password Auth; register clients; authorize web domains; prepare least-privilege deploy/runtime accounts; provision UID roles/profiles; deploy rules/indexes/three functions via gated CI; wait for indexes, then verify real attribution, progress, notifications, isolation and archive. Configure/rehearse [recovery](RECOVERY_PLAN.md) before operational claims.
2. **Vercel:** separate staging/production Next projects rooted at `SAID Ops/web-app`, Node22/locked install. Set six `NEXT_PUBLIC_FIREBASE_*` values; both public backend selectors and server `SAID_ROSTER_BACKEND=firestore`; matching `SAID_FIREBASE_PROJECT_ID`; both emulator flags false and no endpoint variables; dedicated **server-only** `SAID_FIREBASE_SERVICE_ACCOUNT_JSON` or configured ADC. Disable/verify independent Git deployments, authorize CLI, then deploy tested commits through Actions.
3. **EAS:** authorized Expo linkage (`eas init`), real `extra.eas.projectId`, agreed Android package ID and signing credentials remain pending. Preserve current identity until reviewed. Set six matching `EXPO_PUBLIC_FIREBASE_*` values, roster/monitoring selectors firestore, emulator flag false/no endpoints in preview/production EAS environments. Internal APK profiles are configured/validated. Command after setup: `npx eas-cli@24.10.0 build --platform android --profile assessment --non-interactive`. Record install URL, source SHA and real device ledger; no APK exists from this run.
4. **GitHub:** create protected environments `staging` and `production` with branch restrictions/review policy and different exact secrets **FIREBASE_PROJECT_ID**, **FIREBASE_SERVICE_ACCOUNT_JSON**, **VERCEL_TOKEN**, **VERCEL_ORG_ID**, **VERCEL_PROJECT_ID**, **EXPO_TOKEN**. Require CI checks; PR validators get no delivery secrets. Keep repository variable `DEPLOYMENTS_ENABLED` false/unset until setup; set true intentionally afterward. `EAS_FORCE_BUILD=true` requests first APK, then unset. Delivery only on development/main pushes with all required `needs` successful; dispatch validates only. Integration/final pushes here cannot activate delivery.

## 19. Lecturer/test account plan

[Trusted provisioning](LECTURER_ACCESS.md): authorized project administrator uses Firebase Console Auth Add User and exact Auth-UID keyed employee/role documents for ADMINDEMO, STAFFDEMO1, STAFFDEMO2 with synthetic aliases. Separate private passwords; no production accounts are created here. Publish actual current-week shared/critical/individual test work, demonstrate real execution/reassignment/notifications and archive only a disposable completed week. Web/install URLs and private access delivery remain pending.

## 20–24. Delivery state and verdict

Final branch `integration/final`; Stage7H commit and push are the final gate. The final delivery report supplies exact HEAD/remote verification and clean-worktree status, without embedding a self-referential commit hash in its own content. No development/main merge, cloud deployment, account creation or APK build. **READY FOR PRODUCTION SETUP/DEPLOYMENT** for this authorized repository scope. No unresolved repository gate blocker; execution completed through7H. Missing cloud projects/secrets, EAS identity/signing and real-release smoke/device evidence are explicit activation prerequisites, while SoT partial requirements remain accurately documented.

<!-- STAGE_FILE_INVENTORY -->

### 7C — 976ef3f10aa4257f8e8ae76fb94e5517c82257d5

```text
M	SAID Ops/web-app/lib/server/admin.ts
A	SAID Ops/web-app/lib/server/operationalEvents.ts
M	SAID Ops/web-app/lib/server/publication.ts
A	docs/STAGE_7C_OPERATIONAL_HISTORY.md
M	firebase.json
M	firestore.rules
A	functions/history.cjs
A	functions/index.cjs
A	functions/package-lock.json
A	functions/package.json
A	functions/test/history.test.cjs
M	scripts/create-stage6b-emulator-config.cjs
A	scripts/run-emulator-suites.cjs
A	scripts/stage7c-emulator.test.cjs
A	scripts/stage7c-trigger-emulator.test.cjs
A	scripts/stage7c.test.cjs
```

### 7D — c4e4156178dbb48d53bfe6956d452ab66c51213b

```text
M	SAID Ops/mobile-app/.env.example
M	SAID Ops/mobile-app/components/NotificationProvider.tsx
M	SAID Ops/mobile-app/data/notifications/backend.ts
M	SAID Ops/mobile-app/data/notifications/createRepository.ts
M	SAID Ops/mobile-app/data/notifications/firestoreRepository.ts
M	SAID Ops/mobile-app/data/notifications/model.ts
A	docs/STAGE_7D_NOTIFICATIONS.md
M	functions/index.cjs
A	functions/notifications.cjs
A	functions/test/notifications.test.cjs
M	scripts/probe-ws4-safety.cjs
A	scripts/stage7d-emulator.test.cjs
A	scripts/stage7d.test.cjs
```

### 7E — 1dade37f24ae173ca4b232331fff3968f0292333

```text
M	SAID Ops/web-app/.env.example
M	SAID Ops/web-app/app/globals.css
M	SAID Ops/web-app/components/AlertsHistory.tsx
M	SAID Ops/web-app/components/AppShell.tsx
M	SAID Ops/web-app/components/Dashboard.tsx
M	SAID Ops/web-app/components/MonitoringProvider.tsx
A	SAID Ops/web-app/components/OperationalDashboard.tsx
A	SAID Ops/web-app/components/OperationalMonitoringProvider.tsx
A	SAID Ops/web-app/lib/monitoring/backend.ts
A	SAID Ops/web-app/lib/monitoring/model.ts
A	SAID Ops/web-app/lib/monitoring/read.ts
A	docs/STAGE_7E_GENUINE_MONITORING.md
M	firestore.indexes.json
M	scripts/probe-ws4-safety.cjs
A	scripts/stage7e-emulator.test.cjs
A	scripts/stage7e.test.cjs
```

### 7F — 5d1cac1015e368edd9adaa9b01693c5cd9ea09e5

```text
M	SAID Ops/mobile-app/App.tsx
M	SAID Ops/mobile-app/components/StaffTaskDetailScreen.tsx
M	SAID Ops/mobile-app/components/StaffWeeklyRosterScreen.tsx
M	SAID Ops/mobile-app/lib/publishedRoster.ts
M	SAID Ops/mobile-app/lib/taskProgress.ts
M	SAID Ops/mobile-app/lib/usePublishedRoster.ts
M	SAID Ops/mobile-app/types/tasks.ts
A	SAID Ops/web-app/app/api/rosters/archive/route.ts
M	SAID Ops/web-app/app/globals.css
M	SAID Ops/web-app/components/OperationalDashboard.tsx
M	SAID Ops/web-app/components/OperationalMonitoringProvider.tsx
M	SAID Ops/web-app/components/OpsProvider.tsx
M	SAID Ops/web-app/components/RosterScreen.tsx
M	SAID Ops/web-app/lib/monitoring/model.ts
M	SAID Ops/web-app/lib/monitoring/read.ts
A	SAID Ops/web-app/lib/roster/archiveClient.ts
M	SAID Ops/web-app/lib/roster/currentPublication.ts
M	SAID Ops/web-app/lib/roster/progress.ts
M	SAID Ops/web-app/lib/roster/types.ts
M	SAID Ops/web-app/lib/server/admin.ts
A	SAID Ops/web-app/lib/server/archive.ts
M	SAID Ops/web-app/lib/server/publication.ts
A	docs/STAGE_7F_ARCHIVE_HISTORY.md
M	firestore.rules
A	scripts/stage7f-emulator.test.cjs
A	scripts/stage7f.test.cjs
```

### 7F whitespace follow-up — bee82e58b92422ef0c5f0bf043e7d99328e37d07

```text
M	scripts/stage7f-emulator.test.cjs
```

### 7G — d7eafbdbea8471e843ced0a131b3197d2a0d265e

```text
M	.github/workflows/ci.yml
M	README.md
M	SAID Ops/mobile-app/eas.json
M	SAID Ops/web-app/.env.example
M	SAID Ops/web-app/lib/server/admin.ts
A	SAID Ops/web-app/vercel.json
A	docs/RELEASE_PIPELINE.md
A	docs/STAGE_7G_CI_DELIVERY.md
M	functions/package.json
A	scripts/check-deployment-env.cjs
A	scripts/ci-changes.cjs
A	scripts/run-release-gates.cjs
A	scripts/stage7g.test.cjs
A	scripts/write-deploy-credentials.cjs
```

### 7H — final reviewed scope

```text
M	README.md
M	SAID Ops/mobile-app/.env.example
M	SAID Ops/mobile-app/README.md
M	SAID Ops/mobile-app/components/StaffTaskDetailScreen.tsx
M	SAID Ops/web-app/.env.example
M	SAID Ops/web-app/README.md
M	docs/PLATFORM_SETUP.md
M	docs/RELEASE_PIPELINE.md
M	scripts/run-release-gates.cjs
A	docs/DEPENDENCY_SECURITY_DECISION.md
A	docs/FINAL_CAPABILITY_AUDIT.md
A	docs/LECTURER_ACCESS.md
A	docs/MOBILE_QA_LEDGER.md
A	docs/RECOVERY_PLAN.md
A	docs/RELEASE_CERTIFICATION.md
A	docs/evidence/audit-functions.json
A	docs/evidence/audit-mobile.json
A	docs/evidence/audit-security-tests.json
A	docs/evidence/audit-web.json
A	docs/evidence/automated-test-summary.json
A	docs/evidence/stage7e-monitoring.png
A	docs/evidence/stage7f-history.png
```
