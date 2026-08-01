# TDD — Test design for the commute planner

| Field            | Value                                                                                |
| ---------------- | ------------------------------------------------------------------------------------ |
| **Harness**      | Vitest (`pnpm test`) — starter goldens G1–G5                                         |
| **Target**       | Vitest                                                                               |
| **Priority**     | Pure functions in `src/lib/` first                                                   |
| **Last updated** | 2026-08-01                                                                           |
| **Related**      | [RFC-001-planner.md](./RFC-001-planner.md), [SDLC.md](./SDLC.md), [PRD.md](./PRD.md) |

> This document is a **plan** until the first failing→passing tests land in the repo. Do not treat the golden cases below as already enforced by CI.

---

## 1. Goal

Lock **planner invariants** so rebuilds and refactors cannot silently change peak factors, unlock radii, transfer policy, monthly math, or ranking rules.

TDD workflow (once Vitest exists):

```text
Red → write a failing test for an RFC invariant
Green → minimal code to pass
Refactor → clean up; keep tests green
```

Until then: use this file as the backlog of characterization tests to write first.

---

## 2. What to test first

| Module                         | Why                                                           |
| ------------------------------ | ------------------------------------------------------------- |
| `src/lib/commute.ts`           | Monthly hours/cost / % salary formula                         |
| `src/lib/traffic.ts`           | Peak ×1.45 applicability                                      |
| `src/lib/transitNetwork.ts`    | Dijkstra path length / snap / merge                           |
| `src/lib/transitPlanner.ts`    | Nearest stops, 1.2 km / 8 km filters, ≤600 m interchange      |
| `src/lib/multimodalPlanner.ts` | Shortlist, ranking (price/time/balance), same-line preference |

Prefer pure inputs → outputs. Mock OSRM at the enrichment boundary rather than hitting the public network in unit tests.

---

## 3. What not to test in v1

| Skip                                | Why                        |
| ----------------------------------- | -------------------------- |
| Full map click E2E (mapcn/MapLibre) | Brittle; low rebuild value |
| Live OSRM integration in CI         | Flaky / rate-limited       |
| Visual regression of map chrome     | Out of scope for MVP proof |
| Admin localStorage UI flows         | Secondary to planner math  |

---

## 4. Golden / characterization cases

Normative detail: [RFC-001-planner.md](./RFC-001-planner.md).

| ID  | Invariant                | Expected                                                                             |
| --- | ------------------------ | ------------------------------------------------------------------------------------ |
| G1  | Monthly cost             | `oneWayCost × 2 × WFO_days × 4.33`                                                   |
| G2  | Peak factor              | ×1.45 on motorcycle/ojek/car/TJ/Gojek legs; **not** on KRL/MRT/LRT/walk              |
| G3  | P80 (road / mix summary) | ≈ P50 × 1.4                                                                          |
| G4  | Walk unlock              | Pin > 1.2 km from stop → walk access disallowed                                      |
| G5  | Ojek feeder              | Pin ≤ 8 km may use Gojek to stop                                                     |
| G6  | Interchange              | Cross-system only with stops ≤ 600 m apart; inventing hubs forbidden                 |
| G7  | Same-line preferred      | If boarding system reaches office within radii, no forced transfer                   |
| G8  | Best price band          | Among plans within Rp 5,000 of cheapest, pick fastest                                |
| G9  | Mix output               | Up to 3 recommendations with distinct signatures when possible                       |
| G10 | Bogor → SCBD pattern     | KRL board Bogor → CBD alight candidates → last-mile Gojek/walk; cross-system skipped |
| G11 | OSRM failure             | Enrichment falls back to ~22 km/h straight-line estimate                             |
| G12 | Shortlist cap            | Pre-OSRM shortlist ≤ 28 plans                                                        |

Use fixed lat/lng fixtures (e.g. office `(-6.2275, 106.8085)` for SCBD) and tiny synthetic stop/network GeoJSON in tests — not the full production catalog — unless a case specifically needs real corridor topology.

---

## 5. Suggested harness (when adding tests)

```bash
# proposed scripts (not present yet)
npm test          # vitest run
npm run test:watch
```

Proposed stack: **Vitest** + TypeScript path aligned with Vite. No browser runner required for v1 unit tests.

Later CI (when harness exists):

```text
lint → test → build
```

---

## 6. Definition of “tests exist”

1. `npm test` runs without network and covers G1–G10 at minimum
2. Planner math PRs update RFC + failing/passing tests together
3. Document status banner in this file flipped to **Harness: Vitest**

---

## Document control

Update golden cases when RFC-001 constants or ranking rules change. Do not claim CI coverage here until scripts exist in `package.json`.
