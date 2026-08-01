# RFC-001 — Client-side commute planner

| Field            | Value                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------- |
| **Status**       | Accepted (MVP)                                                                            |
| **Product**      | Jabodetabek Offer Stress-Test                                                             |
| **Last updated** | 2026-08-01                                                                                |
| **Related**      | [PRD.md](./PRD.md), [TDD.md](./TDD.md), [public/data/README.md](../public/data/README.md) |

**Truth rule:** when code and this RFC disagree, update this RFC in the same change as the planner. Product acceptance stays in the PRD; math and routing contracts live here.

Figures are **decision-support estimates**, not live Grab/Google navigation.

---

## 1. Decision

Build a **client-only** heuristic multimodal planner over static transit GeoJSON + public OSRM, instead of a backend routing graph or live ride-hailing APIs.

**Why**

- MVP must ship with zero env vars, auth, or secrets
- Offer-stage users need monthly bands vs salary, not door-to-door navigation
- Jabodetabek corridor coverage can start from curated stops/networks

**Consequences**

- Peak factors and fares are heuristics; UI must say so
- OSRM may fail → straight-line ~22 km/h fallback
- Transfers only at real co-located stops (≤ 600 m), never invented hubs

---

## 2. Normative constants

| Constant                           | Value                              |
| ---------------------------------- | ---------------------------------- |
| Default salary                     | Rp 12,000,000 / month              |
| Default hybrid (WFO) days          | 3                                  |
| Peak road factor                   | 1.45                               |
| P80 factor (road / mix summaries)  | 1.4 × P50                          |
| Weeks / month                      | 4.33                               |
| Interchange max walk               | 600 m                              |
| Home board candidates (per system) | top 3 nearest                      |
| Office alight candidates           | top 5 nearest                      |
| Near-cheapest price band           | cheapest + Rp 5,000 → pick fastest |
| Enumeration shortlist before OSRM  | 28 plans                           |
| Walk speed                         | 80 m/min                           |
| Transit ride speed (along network) | 350 m/min                          |
| Ojek speed proxy                   | 22 km/h                            |
| Walk / transit unlock radius       | ≤ 1.2 km to stop                   |
| Ojek feeder to stop                | ≤ 8 km                             |
| Move-home click threshold          | 400 m                              |
| Max homes                          | unlimited                          |
| Network vertex merge               | 120 m                              |
| Snap endpoints to graph            | max 2.5 km                         |

Peak road factor (**×1.45**) applies to Gojek / motorcycle / car / TransJakarta. It does **not** apply to KRL / MRT / LRT / walk.

Monthly cost formula:

```text
oneWayCost × 2 × WFO_days × 4.33
```

---

## 3. Modes

| Mode                        | Pipeline                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Motorcycle / ojek / car     | Single OSRM driving route × peak 1.45; P80 ≈ P50 × 1.4                                     |
| Transit only                | Walk-access planner (no ojek feeders); unlock when both pins within ~1.2 km of known stops |
| Best price mix (`cheapest`) | Multimodal enumeration → shortlist → OSRM enrich Gojek legs → up to 3 recs                 |

---

## 4. Best price mix — pipeline

```text
1. Enumerate candidate plans (heuristic meters / network times)
2. Deduplicate by leg signature
3. Shortlist diverse top ~28 (union of cheap / fast / balanced)
4. Enrich Gojek legs with OSRM road geometry + duration (parallel, cached)
5. Re-score and pick Best price / Best time / Best balance
```

### 4.1 Inputs and outputs

**Inputs (per home × office):** home pin, office pin, WFO days (1–5), enabled PT systems, static stops + network, pricing constants.

**Outputs:** up to 3 recommendations (best **price**, **time**, **balance**), each with ordered legs, one-way minutes & IDR, daily RT cost, monthly cost.

### 4.2 Access and egress

| Mode             | When allowed                               | Time                                                           | Cost                          |
| ---------------- | ------------------------------------------ | -------------------------------------------------------------- | ----------------------------- |
| **Walk**         | Pin ≤ **1.2 km** from stop                 | `max(3, meters / 80 m·min⁻¹)`                                  | Rp 0                          |
| **Gojek (ojek)** | Pin ≤ **8 km** from stop (or door-to-door) | haversine→22 km/h, then ×1.45; after OSRM: road duration ×1.45 | `base + km × perKm`           |
| **Transit ride** | Along curated network polyline             | `max(5, path_m / 350 m·min⁻¹)`; TJ also ×1.45                  | `base + min(km, cap) × perKm` |

### 4.3 Stop selection

For each PT system independently:

1. Top **3** nearest stops to **home** within walk and within ojek radius
2. Top **5** nearest stops to **office** within walk and within ojek radius
3. Distance is **haversine**, not road distance

Alight is **not** forced to a single nearest station or end-of-line terminus.

### 4.4 Same-system plans (preferred)

```text
[Walk|Gojek] home → board
  → ride same system board → alight
  → [Walk|Gojek] alight → office
```

Enumerate access × egress × board × alight candidates, then dedupe.

### 4.5 Cross-system transfers (only when needed)

Use a second system **only if** the boarding system has **no** stop within ojek (8 km) or walk (1.2 km) of the office.

When required:

1. Real interchange: two stops of different systems within **≤ 600 m**
2. Prefer pair closer to the **office**
3. Legs: ride A → walk/short Gojek A→B → ride B → Walk|Gojek → office

**Forbidden:** inventing hubs (e.g. fake “MRT at St. Cawang”). Drop the candidate if no co-located pair exists.

### 4.6 Pure Gojek baseline

Always include one door-to-door Gojek plan so Best time can select it when rail+feeders are slower.

### 4.7 Network pathfinding

For a ride on one system between two stops:

1. Build (cache) undirected graph from that system’s LineStrings
2. Merge vertices within **120 m** as junctions
3. Snap endpoints (max **2.5 km**)
4. Dijkstra; cache node chain per `(system, startNode, endNode)`
5. Anchor path to stop coordinates; fare/time use polyline length
6. No path → straight segment between stops

### 4.8 Ranking

| Kind             | Rule                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| **Best price**   | Among plans within **Rp 5,000** of cheapest one-way, pick **fastest**     |
| **Best time**    | Lowest one-way minutes; ties by cost; distinct signature if possible      |
| **Best balance** | Minimize `cost/maxCost + minutes/maxMins`; distinct signature if possible |

### 4.9 OSRM enrichment

- Only **Gojek** legs replaced with public OSRM driving geometry + duration
- Identical OD requests cached and coalesced in flight
- Parallel enrichment across plans/homes
- Failure → straight-line ~22 km/h, still marked as estimate

Endpoint: `https://router.project-osrm.org/route/v1/driving/...`

---

## 5. Worked example — Bogor Kota → SCBD / Sudirman

Office ≈ `(-6.2275, 106.8085)`, 3 WFO days, Best price mix.

| Step               | Behavior                                                        |
| ------------------ | --------------------------------------------------------------- |
| Board              | St. Bogor (walk or short Gojek)                                 |
| Alight candidates  | Several CBD KRL stops (Mampang, Sudirman, …) — not nearest-only |
| Cross-system       | **Skipped** — KRL already within 8 km of office                 |
| Typical Best price | KRL → nearby CBD stop → Gojek last mile                         |
| Rejected           | KRL → fake hub → MRT → walk                                     |

---

## 6. Transit data contract

Static GeoJSON under `public/data/transit/`. Full schema: [public/data/README.md](../public/data/README.md).

Hard rules:

- Coordinates are always `[longitude, latitude]`
- Per-system folders: `stops.geojson` + `network.geojson`
- Registry: `catalog.json`
- Do not mix systems across folders

Approx scale (MVP): KRL ~68 stops / 5 lines; MRT ~13 / 1; LRT ~18 / 2; TransJakarta ~231 / 14 corridors.

---

## 7. Code map

| Concern                    | Module                         |
| -------------------------- | ------------------------------ |
| Enumerate / rank / enrich  | `src/lib/multimodalPlanner.ts` |
| Nearest stops, interchange | `src/lib/transitPlanner.ts`    |
| Network Dijkstra + caches  | `src/lib/transitNetwork.ts`    |
| OSRM + haversine           | `src/lib/routing.ts`           |
| Peak factor                | `src/lib/traffic.ts`           |
| Monthly math               | `src/lib/commute.ts`           |
| Decision brief export      | `src/lib/report.ts`            |
| Orchestration (UI)         | `src/pages/MapPage.tsx`        |
| Pricing constants          | `src/master/defaults.ts`       |
| Master data store          | `src/master/store.ts`          |

---

## 8. Explicit non-goals

| Not in MVP planner                                                             |
| ------------------------------------------------------------------------------ |
| Live GTFS schedules / headways                                                 |
| Live Grab/Gojek quotes                                                         |
| Full citywide multimodal graph competitive with Google Maps                    |
| Optimizing for transfers when same-line + last mile already reaches the office |
| Backend routing service or API keys                                            |

---

## Document control

Change this RFC when peak factors, radii, ranking, transfer policy, OSRM behavior, or GeoJSON contracts change. Update [TDD.md](./TDD.md) golden cases in the same PR when those invariants move.
