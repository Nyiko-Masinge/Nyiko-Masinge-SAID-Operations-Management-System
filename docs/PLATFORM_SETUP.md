# Current platform setup and delivery

Use the [root README](../README.md) for current integrated local setup, client/server environment modes and manual emulators. Use [RELEASE_PIPELINE.md](RELEASE_PIPELINE.md) for exact Firebase/Vercel/EAS/GitHub actions and secret names, and [RELEASE_CERTIFICATION.md](RELEASE_CERTIFICATION.md) for final gates/evidence.

Supervisor web uses trusted Next Node APIs and Firestore; staff mobile uses own published work/progress/inbox paths. Progress, operational events and persistent inboxes commit through the trusted Next API; Firebase Spark supplies Auth and Firestore without billing. The workflow now includes integrated Stage 6/7, rules, probes and actual Next HTTP progress E2E gates, with protected delivery jobs. Actual cloud deployment and APK generation remain pending external setup.

[PLATFORM_DEVOPS.md](PLATFORM_DEVOPS.md) records the earlier WS5 baseline. Its historical statements about absent central adapters, prototype-only clients and validation-only CI are superseded by the Stage 7 implementation and final release documentation. The original negative security tests (superseded direct-progress-write positives now assert denial) and dependency baseline remain preserved.
