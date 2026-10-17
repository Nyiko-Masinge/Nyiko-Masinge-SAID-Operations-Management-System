# Workstream 5 — Platform, security, testing and delivery

This records the WS5 owner state on `feature/platform-devops` after Passes 1–3.
The [locked central integration contract](WORKSTREAM_5_INTEGRATION_CONTRACT.md)
remains authoritative. No frozen workstream is merged or changed by this pass.
The applications on this independent branch still contain Task 1 prototype/local
behavior; security certification does not claim that central live adapters exist.

## Completed platform work

- Pass 1 removed 8,071 tracked `node_modules` files and locked the central contract.
- Pass 2 aligned the canonical root `firestore.rules` and the existing
  `security-tests/firestore.rules.test.mjs` suite: **193 passed, 0 failed, 0 skipped**.
- The final employee authorization review found profile edits are local/prototype
  behavior in certified WS1/WS3. Parent employee document create/update/delete are
  client-denied until a live workflow is certified. The contract's contact/photo
  and supervisor profile-edit statements are future integration targets.
- Pass 3 pins the CI toolchain, adds tracked-file hygiene and whitespace checks,
  and patches web Next.js from `15.5.4` to exactly `15.5.27`.
- Auth/Firestore emulator configuration, Vercel preparation, and Expo/EAS build
  profiles are present. These are preparation and local validation, not deployment.

## Firebase: configured, tested, and not yet deployed

| State | Evidence / boundary |
| --- | --- |
| CONFIGURED locally | `firebase.json`: Auth 9099, Firestore 8080, Emulator UI, single-project mode; rules `firestore.rules`, indexes `firestore.indexes.json` |
| TESTED locally | Existing Node rules suite against isolated `demo-said-5ce3e`; 193/193, none skipped |
| Recorded production alias | `.firebaserc` names `said-5ce3e`; this is not evidence of live setup or access validation |
| NOT YET DEPLOYED / VALIDATED | Production rules/indexes, Auth/provider/account provisioning, live project/Console validation |

No production collections, credentials, deployment, or trusted server functions are
created here. Future Admin SDK operations bypass Rules and must independently
authenticate, authorize, validate ownership, and validate payloads.

## Current security boundary

Authorization resolves `employees/{auth.uid}.roleId` through `roles/{roleId}`.
System role names are exactly `Staff Member` and `Supervisor/Administrator`;
operational job category does not confer privilege. The business ID is
`employeeId`, distinct from the Firebase UID.

| Area | Implemented rule behavior |
| --- | --- |
| Employees | Staff own-profile get; supervisor workforce get/list; all parent document writes denied |
| Roles | Get only caller's referenced role for WS1 bootstrap; list and writes denied; invalid/missing roles grant no privilege |
| Locations | Authenticated historical/retired reads; supervisor create/rename/retire/reactivate; legacy id optional, correct and immutable; delete denied |
| Published roster | Authenticated metadata reads; staff current-version assigned items only; complete supervisor snapshot reads; publication writes denied |
| Coworker privacy | No staff coworker employee reads/listing; trusted publisher must supply only the approved safe teammate projection |
| FR-9 | Own assigned staff progress at `employees/{uid}/taskProgress/{scheduledWorkId}`; current publication, immutable work/week, request-time timestamp, approved transitions and nonblank inability reason; supervisor monitoring reads; no impersonation/delete |
| Notifications | Own nested get/list and boolean `isRead` updates only; content/create/delete denied |
| Leave | All client access denied until implemented |
| Alerts/audit/notes/top-level notifications/archive/history | Unapproved client operations denied; WS4 live adapters remain on hold |
| Raw shifts | Staff access denied; existing supervisor administrative reads only; all writes denied |
| Unknown paths | Explicit deny-by-default catch-all |

Parent employee write denial does not deny the separately authorized nested
`taskProgress` and `notifications` operations. Pass 3 changes neither Rules nor tests.

## Reproducible CI and repository hygiene

`.github/workflows/ci.yml` runs on feature/development/main pushes and relevant
pull requests. Jobs use Ubuntu 24.04 and the following explicit toolchain:

- Node.js **22.23.3** (all npm jobs).
- Eclipse Temurin Java **21.0.12+8** (Java 21 LTS, emulator job).
- Firebase CLI **15.25.0** (emulator job).

The repository job runs `bash scripts/check-repository-hygiene.sh`. The helper
reads NUL-delimited `git ls-files -z`, so installed/untracked dependencies are
not scanned. It rejects tracked `node_modules` at any depth and generated paths
already covered by root/app ignore conventions: Next build directories, Vercel
and Expo state, mobile dist/web-build, root cache/coverage, and TypeScript build info.
It reports forbidden paths and exits nonzero. Nothing is automatically deleted.

Whitespace checks inspect the PR base-to-head changes, the push before-to-head
changes, or the latest commit for a new branch. The application/security jobs
depend on this repository job:

| Job | Checks owned by the independent WS5 branch |
| --- | --- |
| Web | `npm ci`, `npm run lint` (existing TypeScript check), `npm run build` |
| Mobile | `npm ci`, `npm run typecheck`, `npx --no-install expo config --type public` |
| Security | `npm ci --prefix security-tests`, pinned CLI installation, Auth + Firestore suite |
| Security completeness | Require summary: tests 193, pass 193, fail 0, skipped 0; pipeline failures propagate |

The installed Expo binary is used without downloading a floating version.
CI requires no deployment secrets and does not deploy, merge, or push.
Workflow YAML and Bash can be validated locally; hosted GitHub Actions execution
has not been triggered as part of this pass.

## Local validation

Use Node 22.23.3, Java 21, and Firebase CLI 15.25.0:

```sh
bash scripts/check-repository-hygiene.sh
git diff --check

cd "SAID Ops/web-app"
npm ci
npm run lint
npm run build

cd ../mobile-app
npm ci
npm run typecheck
npx --no-install expo config --type public

cd ../..
npm ci --prefix security-tests
firebase emulators:exec --only auth,firestore --project demo-said-5ce3e "npm test --prefix security-tests"
```

For this owner pass, Node 22.23.3 was used from a checksum-verified temporary
portable runtime; the installed Java is 21.0.11 and Firebase CLI is 15.25.0.
No system Node upgrade was performed. A stale ignored web build cache referenced
a locations page absent on this branch. The existing `npm run clean` removes
`.next`, `.next-dev`, and `.next-prod` before retrying local lint/build; no
application source workaround is appropriate for this cache issue.
Pass 3 local outcomes on October 3, 2026:

| Validation | Result |
| --- | --- |
| Tracked-file guard | Passed; separate disposable Git fixture allowed untracked dependencies and rejected all five tracked artifact cases |
| Whitespace / workflow configuration | git diff --check passed; CI YAML, Bash syntax, toolchain settings and Java SemVer validated locally |
| Web npm ci / lint / build | Passed on installed/locked Next.js 15.5.27 after clearing stale ignored cache; generated next-env.d.ts reference restored and lint passed again |
| Mobile npm ci / typecheck / public Expo config | Passed; SDK 54 config/assets/plugins resolved |
| Security npm ci / certified emulator command | Exit 0; 193 passed, 0 failed, 0 skipped |

No hosted CI run or production runtime validation is claimed.

## Next.js maintenance patch and remaining dependency findings

The web manifest and lockfile now pin **15.5.27**, the maintenance-line patch in
the official [September 30, 2026 security release](https://nextjs.org/blog/september-2026-security-release).
Locked changes are confined to `next`, `@next/env`, and the eight matching
`@next/swc-*` packages, all `15.5.4 -> 15.5.27`, plus Next's own dependency metadata.
Unrelated optional lock entries regenerated by npm were excluded. React and React
DOM remain 19.1.1, web TypeScript remains 5.8.3. No migration or codemod was needed.

The targeted patch does not mean the entire dependency tree has a clean audit.
On October 3, 2026, `npm ci` reported:

| Package tree | Audit findings |
| --- | --- |
| Web | 3: 1 moderate, 2 high; retained PostCSS/sharp findings, with Next reported through PostCSS |
| Mobile | 37: 10 moderate, 27 high |
| Security tests | 5 high |

A read-only web audit identified unchanged `postcss` and `sharp` dependencies.
No `npm audit fix`, major Next upgrade, React upgrade, or mobile dependency
upgrade was applied. Dependency security review/remediation remains necessary
before production deployment and needs separate scoped approval.

## Queries and production indexes

Rules are not query filters. Staff must discover `currentVersion` in week metadata,
then query only that version's `items` using
`where('assignedUids', 'array-contains', auth.uid)`. The security suite also
exercises proposed `orderBy('date')` and `orderBy('startTime')` ordering.

**INDEX TO BE CONFIRMED DURING CENTRAL INTEGRATION.** The central production
published-roster adapter/query is not implemented on this branch. Do not treat
test ordering as finalized production query design. No speculative index is added.
The [Firestore emulator does not enforce compound indexes](https://firebase.google.com/docs/emulator-suite/connect_firestore#indexes);
final exact production queries and indexes must be verified against an approved
live environment before deployment.

The existing `leaveRequests` employeeId/startDate index is unchanged legacy
configuration, not permission to expose leave. Its lifecycle can be decided centrally.

## Environment templates and values

Both committed `.env.example` files contain blank placeholders only and remain
unchanged. Configure real values in ignored local files or the hosting account,
never by committing credentials:

| Web (Vercel / ignored .env.local) | Mobile (Expo / ignored .env) |
| --- | --- |
| NEXT_PUBLIC_FIREBASE_API_KEY | EXPO_PUBLIC_FIREBASE_API_KEY |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | EXPO_PUBLIC_FIREBASE_PROJECT_ID |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID |
| NEXT_PUBLIC_FIREBASE_APP_ID | EXPO_PUBLIC_FIREBASE_APP_ID |

These are future central Firebase client settings; the prototype app on this branch
does not yet compose the frozen WS1 Firebase Auth implementation. Client Firebase
configuration is public and does not replace authorization.

Frozen WS4 proposes `NEXT_PUBLIC_MONITORING_BACKEND` for web and
`EXPO_PUBLIC_MONITORING_BACKEND` for mobile, using memory/demo mode.
Those adapters/flags are absent here, so no inactive template flag is added.
After integration, preserve the live hold: configuring Firebase or choosing
`firestore` mode does not authorize blocked monitoring/notification access.

Admin credentials, signing assets, hosting tokens, and future server secrets
belong in approved account/server secret stores, never client-prefixed variables.

## Vercel preparation — no deployment

- Root directory: **SAID Ops/web-app**; framework preset: **Next.js**.
- Install command: `npm ci`; build command: `npm run build`; Node line: **22.x**.
- Existing `next.config.mjs` writes production output to **.next-prod** and
  development output to **.next-dev**. Use the framework's configured build output,
  not a static `out` export or an assumed `.next` path.
- The verified build contains prerendered prototype pages and the dynamic
  `/[section]` route, which uses the managed Next.js runtime. Local production
  serving uses `npm run start`.
- Configure the six web Firebase public values above in Vercel per approved
  preview/production environment after central Auth composition.
- No `vercel.json` is required for current preparation. No project binding,
  real environment values, token, hosted build, or deployment is claimed.
- Production release remains held for integrated Auth/adapters, live Firebase
  validation, production indexes, and dependency security review.

## Expo / EAS preparation — no build or submission

Existing `eas.json` profiles remain unchanged: development client/internal,
preview/internal, and production. Expo SDK 54.0.37, React Native 0.81.5,
React 19.1.0, and the existing TypeScript baseline are preserved.
Public Expo config validation resolves SDK 54 and the configured app/assets/plugins.

EAS account/project linkage, approved iOS/Android identifiers, and signing setup
remain account-level work. No fake project ID, credentials, signing upload,
EAS production build, Expo publish, or store submission is performed.
Signing credentials must remain in approved managed stores.

## Deferred to central integration and deployment

After all frozen workstreams are integrated into `development`, final CI must
add the existing certified checks from their owning branches:

- WS1: `scripts/probe-ws1-locations.cjs`.
- WS2: `SAID Ops/web-app/tests/roster-final.cjs`.
- WS4: `scripts/probe-ws4-safety.cjs` plus its existing monitoring tests.
- Integrated mobile: final Auth + published-roster + FR-9 progress verification.

These files are not copied onto WS5. WS3's historical competing web security
suite must not become a second security authority; the root Rules and
`security-tests/` remain canonical.

Also deferred: central client composition and live persistence adapters; trusted
roster publication with validated UID/location/team mapping; trusted notification
senders and monitoring/server writers; archive/retention policy; any certified
live employee-profile edit workflow; final production index verification; production
Firebase rules/index deployment and Auth provisioning; live secrets/account setup;
actual Vercel deployment; EAS production build and store submission.
