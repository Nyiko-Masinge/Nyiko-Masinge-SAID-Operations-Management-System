#!/usr/bin/env bash
set -euo pipefail

# Inspect Git's index, never installed or untracked working-directory dependencies.
# Generated paths below follow the existing root and app .gitignore conventions.
git ls-files -z | {
  failed=0
  while IFS= read -r -d '' path; do
    case "$path" in
      node_modules/*|*/node_modules/*|\
      .next/*|*/.next/*|.next-dev/*|*/.next-dev/*|.next-prod/*|*/.next-prod/*|\
      .vercel/*|*/.vercel/*|.expo/*|*/.expo/*|\
      "SAID Ops/mobile-app/dist/"*|"SAID Ops/mobile-app/web-build/"*|\
      .cache/*|coverage/*|*.tsbuildinfo)
        printf 'Tracked dependency/build artifact: %s\n' "$path" >&2
        failed=1
        ;;
    esac
  done
  exit "$failed"
}
