# Cursor / agent workflow

Lean notes for humans and agents working this repo. Scope truth: [PRODUCT.md](./PRODUCT.md) + [PRD.md](./PRD.md).

---

## Constraints (do not invent)

- Client-only SPA — no backend, auth, DB, or required env vars unless PRODUCT/PRD expand scope
- Trust framing: P50/P80 bands + heuristic fares — never claim live Grab/Google ETAs or live GTFS
- MVP non-goals: AI chat, housing scrape, accounts/teams, employer dashboards, multi-city beyond Jabodetabek
- Prefer editing `src/lib/*` planners, `src/pages/MapPage.tsx`, `src/master/*` over new frameworks
- Transit SoT: `public/data/transit/` GeoJSON (`[lng, lat]`) — see `public/data/README.md`
- Decision brief: plain `.txt` via `src/lib/report.ts` (copy to clipboard), not HTML

---

## Doc ownership

| Change type                           | Update                    |
| ------------------------------------- | ------------------------- |
| Wedge / persona / non-goals           | PRODUCT                   |
| Acceptance / UX requirements          | PRD                       |
| Peak, radii, ranking, OSRM, transfers | RFC-001 (+ TDD goldens)   |
| Rebuild / DoD                         | SDLC                      |
| Interviews / kill-pivot               | VALIDATION                |
| Lived corridor samples                | `src/data/CALIBRATION.md` |

Start at [INDEX.md](./INDEX.md).

---

## Verify before claiming done

```bash
pnpm lint
pnpm test
pnpm typecheck   # or included in pnpm build
pnpm build
```

Math/radius/ranking changes → RFC-001 + failing/passing goldens in the same change.

---

## Admin

`/admin` edits master presets/pricing/traffic factors in **localStorage** only — no auth. Do not treat it as a multi-tenant console.
