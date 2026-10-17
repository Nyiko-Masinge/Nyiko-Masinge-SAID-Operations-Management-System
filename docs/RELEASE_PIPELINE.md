# Release pipeline and external setup

The implemented workflow is `.github/workflows/ci.yml`. Validation runs on feature pushes, `integration/final`, `development`, `main`, PRs into the three integration/release branches, and manual dispatch. Existing feature PRs into development continue to use `feature/* → development → main`. The Spark migration promotes one exact tested commit across `integration/final`, `development` and `main`; deployment remains disabled.

All validation uses Node **22.23.3** and verifies npm **10.9.9**, locked `npm ci`, repository hygiene/whitespace, web lint/build, mobile typecheck/Expo config, deterministic Stage 6/7/trusted-progress tests and retained historical pure Functions tests, all four WS probes (WS2 is `web-app/tests/roster-final.cjs`), the original 34 monitoring tests and original **193** rules tests with superseded direct-progress-write positives changed to denials plus additional rules. Integration runs for development/main pushes, PRs into main, manual release validation and backend/security/CI changes. Pure cosmetic feature changes avoid the most expensive integration gates. `scripts/ci-changes.cjs` determines that scope and is covered by tests.

`scripts/run-release-gates.cjs` shares local and CI commands. Rules and non-trigger integration suites reuse one emulator startup per group, resetting disposable `demo-said-5ce3e` Firestore fixtures between sequential suites. The integration group includes persistent notification delivery and an actual Next HTTP server mobile-progress E2E using only Auth/Firestore emulators. Retired trigger source/evidence is retained; no Functions emulator is part of the active gate. Every command propagates failures. No test uses production credentials.

Deployment jobs run **only** on pushes to development/main after all their `needs` succeed and repository variable `DEPLOYMENTS_ENABLED=true`. Manual dispatch validates only. Environment is `staging` for development and `production` for main. Configure GitHub environment branch restrictions and, where supported, production reviewers. Deployment concurrency does not cancel an in-flight release. Top-level token permission is `contents: read`; PR/validation jobs have no secret references. Separate Firebase/Vercel/EAS credentials are obtained only inside protected delivery jobs.

Firebase Spark deployment includes only `firestore:rules,firestore:indexes` before web deployment. Production requires no Cloud Functions, Blaze plan or Firebase payment method. Vercel pulls the target project's production environment, checks real/matching Firebase projects, three Firestore backend modes, emulator opt-out/empty endpoints and server-only credentials, then builds/deploys from the tested commit. **Use separate Vercel projects for staging and production.** Each project's production deployment is its own stable environment. This avoids promoting staging into the production project. `SAID Ops/web-app/vercel.json` sets `git.deploymentEnabled=false`; verify this setting applies to the imported web root, and disable the dashboard Git auto-deploy integration before enabling delivery. CI is the release path.

Mobile requests an internal Android APK after cloud delivery when mobile/config changes, or when `EAS_FORCE_BUILD=true`. It waits for EAS completion. Staging uses `preview` / EAS preview environment; production uses `assessment` / EAS production environment. This is internal distribution, not app-store submission. Project linkage, agreed Android application ID and signing credentials must be initialized once before noninteractive builds. No identity has been invented or changed here.

## Exact GitHub configuration

Create GitHub environments **staging** and **production**. Store different values in each environment under these exact names:

| Service | Environment secret | Purpose |
| --- | --- | --- |
| Firebase | `FIREBASE_PROJECT_ID` | Real project ID for that environment |
| Firebase | `FIREBASE_SERVICE_ACCOUNT_JSON` | Deployment-only service-account JSON matching that project |
| Vercel | `VERCEL_TOKEN` | Token authorized for the selected team/projects |
| Vercel | `VERCEL_ORG_ID` | Team/account ID |
| Vercel | `VERCEL_PROJECT_ID` | Separate staging or production web project ID |
| EAS | `EXPO_TOKEN` | Expo token allowed to build the linked project |

Keep `DEPLOYMENTS_ENABLED` unset/false until projects, credentials, live environment values and environment protections are ready. Set it as a **repository Actions variable**, not a secret. `EAS_FORCE_BUILD` is an optional repository variable for the first build or a rebuild with only externally changed EAS config. Validation needs no account secrets. Branch protections should require the relevant CI checks before merging to development/main; integration is mandatory for main and both delivery branches. This repository does not modify remote protection settings.

The credential writer validates project/type fields, writes a mode-0600 temporary file in `RUNNER_TEMP` and uses `GOOGLE_APPLICATION_CREDENTIALS` for Firebase CLI ADC. Cleanup runs even after failure. No credential value is committed or printed. Grant the deployment account only the permissions required for Firestore rules/index deployment; use a separate server runtime account. Complete provider IAM/bootstrap steps and audit actual permissions in the target projects rather than assigning a broad project Owner role.

## Firebase setup actions

1. Create or verify real staging and production Firebase projects on Spark. Production project ID is `said-ops`, with Firestore in `africa-south1` (Johannesburg). Register web/mobile apps and obtain public Firebase configuration. Keep billing disabled; no payment method or Functions APIs are required.
2. Enable Email/Password Authentication. Add the Vercel staging/production hostnames to authorized domains. Configure database rules/indexes and deploy Firestore rules and indexes through the gated workflow. No Firebase Hosting deployment is included.
3. Create environment-scoped deployment credentials and a separate runtime Admin credential. Keep keys only in GitHub environment secrets and Vercel server environment configuration, or use externally configured ADC. Runtime requires trusted Firestore access and Firebase Auth user/revocation lookup. Ordinary clients rely on the deployed rules.
4. Provision exact role documents and approved Auth UID-backed employee profiles using the release provisioning plan. Do not run `scripts/provision-emulator-e2e.cjs` against production: it explicitly rejects production endpoints.
5. After deployment, verify indexes finish building and perform real smoke tests for supervisor publication, staff progress, history attribution, persistent notification delivery, recipient isolation and archive rejection. Verify the authenticated staff actor, safe profile identity and atomic event/inbox writes through the deployed Next API.

## Vercel setup actions

1. Create distinct staging and production projects with root `SAID Ops/web-app`, Next.js preset, Node 22, npm locked install and the app's existing build command. Link their IDs to the matching GitHub environment secrets.
2. Set all six `NEXT_PUBLIC_FIREBASE_*` values from the matching Firebase project. Set `NEXT_PUBLIC_ROSTER_BACKEND=firestore`, `NEXT_PUBLIC_MONITORING_BACKEND=firestore`, `SAID_ROSTER_BACKEND=firestore`, `SAID_FIREBASE_PROJECT_ID=said-ops` for production (matching the public project). Leave all emulator variables unset in production; explicit false opt-out flags are accepted, but emulator endpoints are forbidden.
3. Set **server-only** `SAID_FIREBASE_SERVICE_ACCOUNT_JSON` to the dedicated runtime credential; never put it in a `NEXT_PUBLIC_*` variable. Local trusted servers may instead use `GOOGLE_APPLICATION_CREDENTIALS` / ADC. Restart/redeploy after changing projects or credentials.
4. Verify Git deployments are disabled, authorize the CLI token, enable GitHub delivery only after setup, and use the workflow to build/deploy the tested commit. Record real deployed URLs and smoke-test results afterward.

## EAS setup actions

1. Sign into the authorized Expo account, initialize/link the existing `said-ops-staff` slug with `eas init`, and review/commit the real `extra.eas.projectId` and agreed Android package ID. The existing config has neither, so this external identity decision remains pending.
2. Initialize Android signing credentials interactively once; store/manage them through EAS. Configure preview and production EAS environments with the matching six `EXPO_PUBLIC_FIREBASE_*` values, `EXPO_PUBLIC_ROSTER_BACKEND=firestore`, `EXPO_PUBLIC_MONITORING_BACKEND=firestore`, `EXPO_PUBLIC_FIREBASE_EMULATORS_ENABLED=false`, `EXPO_PUBLIC_API_BASE_URL` to the deployed trusted web/API HTTPS origin, and no emulator endpoints. Do not invent the origin before deployment. Public Expo variables are included in the application bundle; never add Admin credentials.
3. Add `EXPO_TOKEN` to the protected GitHub environments. Request the first build with `EAS_FORCE_BUILD=true` during the authorized release push, then unset it.
4. Equivalent manual command after real setup: from `SAID Ops/mobile-app`, run `npx eas-cli@24.10.0 build --platform android --profile assessment --non-interactive`. Record the returned install URL/APK and real device QA. No APK has been built by this remediation.

CLI tooling added by the workflow is pinned independently of app dependencies: Firebase CLI 15.25.0, Vercel CLI 62.2.0, EAS CLI 24.10.0. Application frameworks and Firebase baseline remain unchanged. Cloud execution, project/IAM settings and actual artifact generation remain **DEPLOYMENT PENDING**, not application test failures.

Provider references checked during implementation: [Firebase CI/ADC](https://firebase.google.com/docs/cli#cli-ci-systems), [Vercel CLI deployment](https://vercel.com/docs/cli/deploy), [Vercel Git deployment setting](https://vercel.com/docs/project-configuration#git.deploymentenabled), [Expo builds from CI](https://docs.expo.dev/build/building-on-ci/), [GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
