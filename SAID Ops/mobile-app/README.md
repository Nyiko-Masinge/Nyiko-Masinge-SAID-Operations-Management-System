# SAID Ops Staff Mobile

Integrated Expo SDK 54 / React Native 0.81.5 / TypeScript staff app. Firebase Auth restores UID-backed Employee ID sessions; live mode reads personal published duties and progress, saves canonical task transitions via the authenticated Next `POST /api/mobile/task-progress` API, receives persistent recipient notifications and retains own archived history. Profile edits remain partly local. Background FCM is deferred.

Use Node 22.23.3/npm 10.9.9: `npm ci`, then `npm run dev`. Configure ignored `.env` from `.env.example`; explicitly set roster and notification Firestore modes for integration. Set `EXPO_PUBLIC_API_BASE_URL` to the trusted web origin; HTTPS is required outside explicit emulator mode. Production origin remains unset until deployment. Sign in with a provisioned staff account. Firebase configuration alone does not activate live adapters; requested live errors do not fall back to fixtures.

Checks: `npm run typecheck`, `npx --no-install expo config --type public`, and root release gates. EAS `preview` and `assessment` profiles prepare internal Android APKs; real project/package/signing setup and an actual build are pending. See the [root README](../../README.md), [lecturer access plan](../../docs/LECTURER_ACCESS.md), [physical QA ledger](../../docs/MOBILE_QA_LEDGER.md) and [release pipeline](../../docs/RELEASE_PIPELINE.md).

Historical WS3 source/rules notes do not override the canonical root security policy or current integration contracts. Staff mobile and supervisor web retain separate responsibilities.
