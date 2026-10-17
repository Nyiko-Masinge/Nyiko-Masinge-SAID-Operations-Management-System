# Stage 7G — integrated CI and deployment preparation

Implemented the validation/deployment workflow and shared fail-fast local runners described in [RELEASE_PIPELINE.md](RELEASE_PIPELINE.md), including protected environment secrets, release dependencies, concurrency, selective heavier integration, Vercel Git deployment opt-out, matching live configuration validation and internal APK profiles. Added a project-checked server-only Admin JSON credential alternative for Vercel while preserving local ADC and explicit emulator isolation. No application dependency version or lockfile changed; Functions syntax checking now includes notifications.

Local validation passed:

- 16 focused workflow/configuration/security tests, including secret isolation and mandatory release gate dependencies.
- Shared deterministic gate: 383/383 tests; original monitoring Jest tests 34/34; WS1/WS3/WS4 probes passed; Functions syntax checks passed.
- Original rules 193/193 and additional rules 42/42.
- Shared non-trigger emulator integrations: 75/75 (provisioning 5, publication 10, progress 8, restoration 5, durable planning 12, trusted scheduling 17, history 4, monitoring 5, archive 9).
- Actual Functions integrations: 7/7 (progress history 1, persistent notifications 6).
- Total countable automated tests: **734 passed, zero failed/skipped**, plus three probes and static/type/build/config checks. This is a local gate result, not a claim that the pushed GitHub workflow has already executed.
- Web lint/production build, mobile typecheck/Expo public config, actionlint 1.7.12, repository hygiene and whitespace checks passed.

The first Functions run exceeded Firebase CLI's ten-second function discovery default during concurrent local work and registered no triggers, correctly failing its positive test. The shared emulator runner now explicitly allows the documented 60-second discovery timeout; the final actual-trigger run registered all three functions and passed. Assertions were retained.

Actual Firebase/Vercel/EAS deployment is **DEPLOYMENT PENDING**. No real project, environment credential, production account, merge or cloud deployment was created. See the linked pipeline document for exact secret names and setup actions.
