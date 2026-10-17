# Contributing to SAID Operations

## Branches and pull requests

- Pull before starting work. Create `feature/<descriptive-workstream-name>` from the current `development` branch once it exists.
- Do normal feature work on feature branches, not directly on `main` or `development`.
- Open a focused pull request from `feature/*` into `development`. Promote reviewed integration from `development` into `main` through a pull request.
- Never force-push shared branches. Commit coherent changes and keep unrelated work out of a pull request. Resolve conflicts before requesting merge.

## Shared changes

Coordinate before editing shared contracts, IDs, statuses, roles, Firebase configuration conventions, `mobile-app/App.tsx`, `web-app/components/OpsProvider.tsx`, `web-app/components/ManagementScreens.tsx`, or central configuration. Keep both applications aligned with [the development contract](docs/DEVELOPMENT_CONTRACT.md) and the Task 1 source-of-truth PDF. Preserve the React Native/Expo, Next.js/React, and Firebase direction; do not introduce an alternative stack or provider independently.

Explain every dependency or lockfile change in the pull request and include only necessary packages. Do not upgrade framework versions without explicit team agreement.

## Secrets and checks

Use ignored local environment files for real client configuration. Commit only placeholder `.env.example` files; never commit passwords, service-account credentials, private keys, or production secrets. Firebase client configuration does not replace Authentication, authorization, or Firestore Security Rules.

Run checks relevant to the changed application: `npm run typecheck` in mobile and `npm run lint` (TypeScript check) or `npm run build` in web. Add manual screen/device evidence and screenshots when UI changes warrant them. Record checks that could not run and known limitations in the pull request. Review the final diff for generated files, secrets, unrelated changes, and unresolved conflicts.
