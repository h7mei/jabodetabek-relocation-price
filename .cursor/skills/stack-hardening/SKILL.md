---
name: stack-hardening
description: >-
  Hardens the client SPA engineering stack (Vite, React 19, TypeScript strict,
  Vitest, oxlint, pnpm, GitHub Actions). Use when the user asks to harden,
  harden the stack, improve robustness, tighten CI, fix flaky builds, audit
  deps, strengthen TypeScript/lint/test gates, or make engineering more
  production-ready without inventing a backend.
---

# Stack hardening

Make the existing toolchain fail loudly and consistently. Do **not** expand product scope (no backend, auth, DB, required env vars).

Stack truth: Vite + React 19 + TS strict + pnpm + oxlint (`pnpm lint`) + Vitest + `tsc -b` in `pnpm build` + `.github/workflows/ci.yml`.

## When to apply

- “Harden / make robust / production-ready engineering”
- CI red, flaky tests, loose types, missing verify steps
- Dependency or supply-chain hygiene on this SPA
- Aligning local scripts with GitHub Actions

For **planner math** regressions (peak, radii, ranking), also use `planner-invariants`.

## Workflow

```text
Hardening Progress:
- [ ] 1. Baseline: run verify script / full gate
- [ ] 2. Pick one failure class (types | lint | tests | build | CI drift | deps)
- [ ] 3. Fix with smallest change; keep SPA constraints
- [ ] 4. Re-run full gate until green
- [ ] 5. Confirm CI config still matches local scripts
```

### 1. Baseline

Prefer the skill script (same order as CI + typecheck):

```bash
bash .cursor/skills/stack-hardening/scripts/verify.sh
```

Or manually:

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

Record the first failing command; fix that class before chasing others.

### 2. Failure classes

| Class        | Symptoms                       | Hardening moves                                                                                             |
| ------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Types**    | `tsc` / `pnpm build` fails     | Keep `strict` + unused checks in `tsconfig.app.json`; no `any` escapes; fix call sites                      |
| **Lint**     | `pnpm lint` (oxlint) fails     | Fix real issues; don’t disable rules repo-wide                                                              |
| **Tests**    | Vitest red / flakes            | Pure `src/lib` tests; mock OSRM; no live network in unit tests; see `docs/TDD.md`                           |
| **Build**    | Vite emit fails                | Fix imports (`verbatimModuleSyntax`), asset paths, GeoJSON under `public/`                                  |
| **CI drift** | Local green, Actions red       | Match `.github/workflows/ci.yml`: `pnpm install --frozen-lockfile` → lint → test → build; Node 22 / pnpm 10 |
| **Deps**     | Audit / lockfile / unused pkgs | `pnpm install --frozen-lockfile`; avoid new frameworks; no secrets in client bundle                         |

Details: [checklist.md](checklist.md).

### 3. Hardening principles (this repo)

1. **CI is the contract** — local verify must include everything CI runs; add `typecheck` locally even if CI relies on `pnpm build` (`tsc -b`).
2. **Pure core first** — harden `src/lib/*` with Vitest goldens; don’t replace with E2E map clicks.
3. **Client-only threat model** — no API keys in source; OSRM is public/best-effort; `/admin` is localStorage, not auth.
4. **Fail closed on math** — changing planner constants requires RFC-001 + goldens (`planner-invariants`).
5. **Lean stack** — prefer fixing existing Vite/React/shadcn/mapcn paths over adding state libs, GraphQL, or servers.

### 4. Done when

- `scripts/verify.sh` exits 0
- CI workflow steps still match (or intentionally updated in the same change)
- No new required env vars, backends, or “live ETA” claims in UI copy

## Anti-patterns

- Adding Express/Next API “for hardening”
- Skipping `--frozen-lockfile` locally when debugging CI
- Broad `eslint-disable` / `@ts-ignore` to green the gate
- Live OSRM or full MapLibre E2E as the primary regression suite
- Inventing `.env` secrets for a static SPA MVP
