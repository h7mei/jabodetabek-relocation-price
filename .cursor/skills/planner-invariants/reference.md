# Golden reference (TDD G1–G12)

Harness: `pnpm test` → Vitest → `src/lib/__tests__/planner-goldens.test.ts`.

## Covered

| ID  | Module focus           | Expected                                                         |
| --- | ---------------------- | ---------------------------------------------------------------- |
| G1  | `commute.ts`           | `oneWayCost × 2 × WFO_days × 4.33`                               |
| G2  | `traffic.ts`           | ×1.45 on motorcycle/ojek/car/TJ/Gojek; not KRL/MRT/LRT/walk      |
| G3  | summaries              | P80 ≈ P50 × 1.4 for road/mix                                     |
| G4  | `transitPlanner.ts`    | pin > 500 m → walk access disallowed; prefer Gojek               |
| G13 | `transitPlanner.ts`    | board = nearest 1 stop only                                      |
| G5  | `transitPlanner.ts`    | pin ≤ 8 km may use Gojek to stop                                 |
| G6  | `transitPlanner.ts`    | cross-system only if stops ≤ 600 m; no invented hubs             |
| G7  | `multimodalPlanner.ts` | boarding system reaches office within radii → no forced transfer |
| G8  | `multimodalPlanner.ts` | Best price = VOT among non–door-Gojek; Gojek = Best time only    |
| G9  | `multimodalPlanner.ts` | up to 3 recommendations with distinct signatures when possible   |
| G12 | `multimodalPlanner.ts` | shortlist ≤ 28; fastest kept when cheap variants flood           |

## Backlog

| ID  | Intent                                                                     |
| --- | -------------------------------------------------------------------------- |
| G10 | Bogor → SCBD: KRL board → CBD alight → last-mile; skip forced cross-system |
| G11 | OSRM failure → ~22 km/h straight-line enrichment fallback                  |

## What not to test (v1)

- Full map click E2E (mapcn/MapLibre)
- Live OSRM in CI
- Visual regression of map chrome
- Admin localStorage UI flows as primary math gate

## Fixture tips

- Office SCBD example: `(-6.2275, 106.8085)` — remember GeoJSON uses `[lng, lat]`.
- Keep synthetic networks tiny; load production catalog only when corridor topology is under test.
- Peak/P80 editable defaults also live in master (`traffic.peakFactor` / `traffic.p80Factor`); goldens should pin explicit factors when asserting G2/G3.
