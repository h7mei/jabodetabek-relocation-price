# Stack hardening checklist

Use with `scripts/verify.sh`. Tick only what you touch.

## Gate parity

- [ ] `package.json` scripts: `lint`, `test`, `typecheck`, `build`
- [ ] CI (`.github/workflows/ci.yml`): install frozen → lint → test → build
- [ ] Node 22 + pnpm 10 (or bump CI + docs together)
- [ ] Lockfile committed; no `package-lock.json` / yarn drift

## TypeScript

- [ ] `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` stay on
- [ ] `verbatimModuleSyntax` respected (`import type` where needed)
- [ ] Path alias `@/*` → `./src/*` works in app + Vitest (`vitest.config.ts`)
- [ ] No new `any` / non-null assertions without a narrow justification

## Lint & format

- [ ] `pnpm lint` = oxlint on `src` (primary gate)
- [ ] ESLint config may exist; do not invent a second competing mandatory gate unless CI adds it
- [ ] Prefer fixing code over disabling rules

## Tests

- [ ] Vitest `environment: "node"`; `src/**/*.test.ts`
- [ ] Planner goldens in `src/lib/__tests__/planner-goldens.test.ts` (G1–G9; backlog G10–G12)
- [ ] Mock network at OSRM enrichment boundary
- [ ] No reliance on full production transit GeoJSON unless topology is under test

## Client SPA safety

- [ ] Zero required env vars for MVP build
- [ ] No secrets, tokens, or private API keys in `src/` or `public/`
- [ ] External calls (OSRM) tolerate failure with documented fallback
- [ ] `localStorage` master key treated as single-device prefs, not multi-tenant auth
- [ ] User-facing strings keep P50/P80 + heuristic framing

## Dependencies

- [ ] Prefer existing: React 19, Vite 8, maplibre, shadcn/radix, vitest, oxlint
- [ ] Justify any new runtime dependency in the PR/commit message
- [ ] Run install with frozen lockfile after dependency edits

## Out of scope for “hardening”

- Backend, auth, DB, employer dashboards
- AI chat agent
- Housing scrape / marketplace
- Guaranteed live Grab/Google ETAs
