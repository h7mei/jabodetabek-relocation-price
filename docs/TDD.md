# TDD — Test design for the commute planner

| Field            | Value                                                                                |
| ---------------- | ------------------------------------------------------------------------------------ |
| **Harness**      | Vitest (`pnpm test`) — goldens G1–G9                                                 |
| **Target**       | Vitest                                                                               |
| **Priority**     | Pure functions in `src/lib/` first                                                   |
| **Last updated** | 2026-08-01                                                                           |
| **Related**      | [RFC-001-planner.md](./RFC-001-planner.md), [SDLC.md](./SDLC.md), [PRD.md](./PRD.md) |

> Harness is live: `src/lib/__tests__/planner-goldens.test.ts` covers **G1–G9**. Remaining backlog: **G10–G12**. CI runs lint → test → build.

---

## 1. Goal

Lock **planner invariants** so rebuilds and refactors cannot silently change peak factors, unlock radii, transfer policy, monthly math, or ranking rules.

```text
Red → write a failing test for an RFC invariant
Green → minimal code to pass
Refactor → clean up; keep tests green
```

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

| ID  | Invariant                | Expected                                                                             | Status  |
| --- | ------------------------ | ------------------------------------------------------------------------------------ | ------- |
| G1  | Monthly cost             | `oneWayCost × 2 × WFO_days × 4.33`                                                   | Covered |
| G2  | Peak factor              | ×1.45 on motorcycle/ojek/car/TJ/Gojek legs; **not** on KRL/MRT/LRT/walk              | Covered |
| G3  | P80 (road / mix summary) | ≈ P50 × 1.4                                                                          | Covered |
| G4  | Walk unlock              | Pin > 1.2 km from stop → walk access disallowed                                      | Covered |
| G5  | Ojek feeder              | Pin ≤ 8 km may use Gojek to stop                                                     | Covered |
| G6  | Interchange              | Cross-system only with stops ≤ 600 m apart; inventing hubs forbidden                 | Covered |
| G7  | Same-line preferred      | If boarding system reaches office within radii, no forced transfer                   | Covered |
| G8  | Best price band          | Among plans within Rp 5,000 of cheapest, pick fastest                                | Covered |
| G9  | Mix output               | Up to 3 recommendations with distinct signatures when possible                       | Covered |
| G10 | Bogor → SCBD pattern     | KRL board Bogor → CBD alight candidates → last-mile Gojek/walk; cross-system skipped | Backlog |
| G11 | OSRM failure             | Enrichment falls back to ~22 km/h straight-line estimate                             | Backlog |
| G12 | Shortlist cap            | Pre-OSRM shortlist ≤ 28 plans                                                        | Backlog |

Use fixed lat/lng fixtures (e.g. office `(-6.2275, 106.8085)` for SCBD) and tiny synthetic stop/network GeoJSON in tests — not the full production catalog — unless a case specifically needs real corridor topology.

---

## 5. Harness

```bash
pnpm test          # vitest run
pnpm run test:watch  # optional: vitest --watch (add script if needed)
```

Stack: **Vitest** + TypeScript path alias `@` aligned with Vite. No browser runner for unit goldens.

CI:

```text
lint → test → build
```

---

## 6. Definition of “tests exist”

1. `pnpm test` runs without network and covers G1–G9 at minimum (G10–G12 still backlog)
2. Planner math PRs update RFC + failing/passing tests together
3. This file’s harness banner stays accurate when coverage changes

---

## Document control

Update golden cases when RFC-001 constants or ranking rules change. Keep the Status column in §4 in sync with `planner-goldens.test.ts`.
