# Dependency baseline and residual security decision

Stage 7H preserves the user-certified baseline and forbids broad dependency remediation. Web/mobile/security manifests and lockfiles are byte-content unchanged from starting commit `a1eef8a99bf736a609627b7e09159abd952a4944`. Functions is the scoped Stage 7C addition, pinned to Admin 14.5.0 and Functions 7.4.0; its lockfile is retained. Stage 7G changed only its syntax-check script.

Locked versions: web Next 15.5.27, sharp 0.35.4, React/React DOM 19.1.1, Firebase 12.19.0, Admin 14.5.0, TypeScript 5.8.3. Mobile Expo 54.0.37, RN 0.81.5, React/React DOM 19.1.0, Firebase 12.19.0 and locked TypeScript 5.9.3. Security tests retain their separate certified test-only Firebase baseline. Node 22.23.3/npm 10.9.9 clean installs pass. Linux install/native behavior is left to hosted CI/build smoke; no Windows result is presented as a Linux certification.

Prior evidence reviewed: dependency triage and subsequent sharp-hardening certification in **“Triage release dependency advisories”**, chat `01a10b72-af4a-7fd3-a173-9e60fd13cec7`. Sharp's two previously identified advisories were removed by the earlier approved 0.35.4 update, before this request.

Fresh read-only `npm audit --json` on 5 October 2026 after final clean installs:

| Workspace | Package entries | High | Moderate | Critical | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| Web | 8 | 5 | 3 | 0 | Retain existing documented constrained reachability |
| Mobile | 41 | 31 | 10 | 0 | Retain certified Expo/RN baseline; tooling/bundle review required for actual artifact |
| Security tests | 5 | 5 | 0 | 0 | Test-only package tree; no deployment artifact |
| Functions | 2 | 0 | 2 | 0 | gaxios/uuid optional Admin Storage chain; Storage APIs unused |

Audit exits 1 because findings exist; they are recorded separately from passing functional gates. These package totals include propagated/overlapping advisories and are not counts of established application exploits. Raw current JSON is retained in `docs/evidence/audit-*.json`.

Reachability conditions from the reviewed triage remain applicable after Stage 7:

- Web Firebase/Firestore/compat inherit the legacy client package's Node gRPC findings. Browser Firestore uses WebChannel; no gRPC server APIs are implemented. Active Admin Firestore uses its separate patched gRPC dependency. The new Functions code uses Admin Firestore, not gRPC server creation.
- Web PostCSS processes committed repository CSS at build time. There is no application path accepting user-supplied CSS. Trust/review build inputs and isolate CI; npm's propagated Next entry is not a separate direct Next advisory in this evidence.
- Web/Functions gaxios/uuid entries flow through optional Admin Storage. Application code does not use Storage; inspected gaxios uses unaffected UUID v4; publication/event identities use crypto/randomUUID/deterministic hashes. No affected UUID v3/v5/v6 buffer API is introduced.
- Mobile production dependency declarations include Expo/Metro/build/test tooling. An `--omit=dev` count cannot prove Android bundle membership. Building/installing/inspecting the exact release APK and hosted transport behavior remains pending. Preserve trusted source/assets/config and build isolation.
- Security-test dependencies are never deployed; the prior dev-omitted audit was zero. No broad audit fix or incompatible upgrade is authorized here.

This is a documented pre-deployment risk disposition, not a vulnerability-free claim or unconditional operational security approval. Recheck advisories and these assumptions before exposing a real hosted release, especially if importing new CSS/assets, adding Storage/gRPC server paths or changing toolchain. Any further dependency correction requires explicit approval under the repository guidance. Residual risk does not erase the tested authorization, isolation and transaction protections, and passing those tests does not erase package findings.
