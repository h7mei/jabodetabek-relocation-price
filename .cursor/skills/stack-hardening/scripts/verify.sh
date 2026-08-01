#!/usr/bin/env bash
# Full local gate aligned with CI (+ explicit typecheck).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$root"

echo "==> pnpm lint"
pnpm lint

echo "==> pnpm test"
pnpm test

echo "==> pnpm typecheck"
pnpm typecheck

echo "==> pnpm build"
pnpm build

echo "OK: lint, test, typecheck, build"
