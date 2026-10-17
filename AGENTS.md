# Repository guidance

- `SAID Ops/mobile-app` is the staff Expo/React Native/TypeScript app; `SAID Ops/web-app` is the supervisor Next.js/React/TypeScript app. Both will share Firebase, Firestore, Authentication, Functions where trusted logic is needed, and Cloud Messaging. Web hosting is planned for Vercel.
- The Task 1 source-of-truth PDF and agreed Task 2 contracts override speculative assumptions. Inspect existing patterns before editing; keep mobile and web data contracts aligned.
- Do not replace Firebase, Next.js, React Native, or Expo. Do not upgrade dependencies without explicit approval. Preserve TypeScript typing and keep secret values out of source.
- Respect the staff-mobile and supervisor-web responsibility split. Do not expand product scope or change the Task 1 UI unnecessarily. Version 1 excludes direct ezyVet integration.
- Use targeted verification. Create branches, commits, or pushes only when explicitly requested.
