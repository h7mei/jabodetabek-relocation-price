---
name: planner-invariants
description: >-
  Locks commute planner invariants (fares, peak, P80, radii, transfers, ranking,
  OSRM fallback) with RFC + golden tests + verify loop. Use when changing
  src/lib planners, traffic/commute math, multimodal ranking, transit radii,
  goldens G1–G12, RFC-001, or when the user asks to make planner changes robust,
  regression-safe, or TDD-backed.
---

# Planner invariants (robustness)

Keep heuristic Jabodetabek commute math honest and non-regressing. Normative source: `docs/RFC-001-planner.md`. Test design: `docs/TDD.md`.

## When to apply

- Any edit under `src/lib/commute.ts`, `traffic.ts`, `routing.ts`, `transitNetwork.ts`, `transitPlanner.ts`, `multimodalPlanner.ts`
- Changing peak/P80 factors, unlock radii, interchange policy, monthly formula, or ranking
- Adding or fixing goldens; “make this robust / don’t break math”

## Workflow

Copy and track:

```text
Robustness Progress:
- [ ] 1. Name the invariant (G# or new)
- [ ] 2. Red: failing golden or assert
- [ ] 3. Green: minimal planner fix
- [ ] 4. Sync RFC-001 if constants/behavior changed
- [ ] 5. Preserve trust framing in UI/brief if copy touched
- [ ] 6. Verify: pnpm lint && pnpm test && pnpm typecheck && pnpm build
```

### 1. Name the invariant

Map the change to a golden (see [reference.md](reference.md)):

| ID      | Lock                                                        |
| ------- | ----------------------------------------------------------- |
| G1      | Monthly cost `oneWayCost × 2 × WFO_days × 4.33`             |
| G2      | Peak ×1.45 on road/TJ/ojek — not rail/walk                  |
| G3      | P80 ≈ P50 × 1.4 (road/mix summaries)                        |
| G4      | Walk unlock ≤ 1.2 km                                        |
| G5      | Ojek feeder ≤ 8 km                                          |
| G6      | Interchange ≤ 600 m; no invented hubs                       |
| G7      | Same-line preferred (no forced transfer)                    |
| G8      | Cheapest + Rp 5,000 → fastest                               |
| G9      | Up to 3 mix recs, distinct signatures                       |
| G10–G12 | Corridor pattern / OSRM fallback / shortlist ≤ 28 (backlog) |

If none fit, add a new `G#` row in `docs/TDD.md` and a test in `src/lib/__tests__/planner-goldens.test.ts`.

### 2–3. Red → green

- Prefer pure inputs → outputs.
- Mock OSRM at the enrichment boundary; do not hit the public network in unit tests.
- Use fixed lat/lng fixtures (e.g. SCBD office `-6.2275, 106.8085`) and **tiny synthetic** GeoJSON unless topology is the point.
- Do not skip failing goldens with looser tolerances without RFC justification.

### 4. Sync docs

Same change must update:

- `docs/RFC-001-planner.md` when constants, pipeline, or ranking rules change
- `docs/TDD.md` status column when covering a backlog golden
- UI/brief caveats if user-visible meaning of P50/P80/fares changes

### 5. Trust framing check

Never ship copy that implies live Grab/Google ETAs or live GTFS. Figures are decision-support bands.

### 6. Verify before claiming done

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

If only docs changed, still run `pnpm test` when goldens/status were touched.

## Anti-patterns

- Changing ×1.45 / ×1.4 / 1.2 km / 8 km / 600 m / 28 / 4.33 without RFC + golden
- Inventing transfer hubs not present as co-located stops
- Live OSRM or full map E2E as the only regression gate
- Expanding scope into backend, auth, AI chat, or housing scrape “for robustness”

## Additional resources

- Golden table and harness notes: [reference.md](reference.md)
- Agent constraints overview: `docs/CURSOR.md`
