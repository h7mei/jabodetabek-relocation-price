# RFC-001 — Client-side commute planner

| Field            | Value                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------- |
| **Status**       | Accepted (MVP)                                                                            |
| **Product**      | Jabodetabek Relocation Price                                                              |
| **Last updated** | 2026-08-03                                                                                |
| **Related**      | [PRD.md](./PRD.md), [TDD.md](./TDD.md), [public/data/README.md](../public/data/README.md) |

**Truth rule:** when code and this RFC disagree, update this RFC in the same change as the planner. Product acceptance stays in the PRD; math and routing contracts live here.

Figures are **decision-support estimates**, not live Grab/Google navigation.

---

## 1. Decision

Build a **client-only** heuristic multimodal planner over static transit GeoJSON + public OSRM, instead of a backend routing graph or live ride-hailing APIs.

**Why**

- MVP must ship with zero env vars, auth, or secrets
- Offer-stage users need monthly time/cost bands, not door-to-door navigation
- Jabodetabek corridor coverage can start from curated stops/networks

**Consequences**

- Peak factors and fares are heuristics; UI must say so
- OSRM may fail → straight-line ~22 km/h fallback
- Transfers only at real co-located stops (≤ 600 m), never invented hubs

---

## 2. Normative constants

| Constant                           | Value                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Default hybrid (WFO) days          | 3                                                                          |
| Peak road factor                   | **1.45** default (editable via `/admin` → `master.traffic.peakFactor`)     |
| P80 factor (road / mix summaries)  | **1.4** × P50 default (editable via `/admin` → `master.traffic.p80Factor`) |
| Weeks / month                      | 4.33                                                                       |
| Interchange max walk               | 600 m                                                                      |
| Home board candidates (per system) | **nearest 1** only (prefer closest stop)                                   |
| Office alight candidates           | **nearest 1** only (prefer closest stop)                                   |
| Near-cheapest price band           | cheapest + Rp 5,000 (shortlist diversity hint only)                        |
| Value of time (Best price)         | **Rp 1,000 / min** — Best price minimizes `fare + VOT × minutes`           |
| VOT near-tie band                  | If                                                                         | Δeffective | ≤ **Rp 1,000**, prefer **lower fare** |
| Enumeration shortlist before OSRM  | 28 plans                                                                   |
| Walk speed                         | 80 m/min                                                                   |
| Transit ride speed (along network) | 350 m/min                                                                  |
| Ojek speed proxy                   | 22 km/h                                                                    |
| Walk / transit unlock radius       | ≤ 500 m to stop (farther → Gojek feeder)                                   |
| Ojek feeder to stop                | ≤ 8 km                                                                     |
| Move-home click threshold          | 400 m                                                                      |
| Max homes                          | unlimited                                                                  |
| Network vertex merge               | 120 m                                                                      |
| Snap endpoints to graph            | max 2.5 km                                                                 |

Peak road factor (**×1.45** default) applies to Gojek / motorcycle / car / TransJakarta. It does **not** apply to KRL / MRT / LRT / walk. Values are stored in master data (`traffic.peakFactor` / `traffic.p80Factor`) and editable on `/admin` (localStorage only).

Monthly cost formula:

```text
oneWayCost × 2 × WFO_days × 4.33
```

---

## 3. Modes

| Mode                        | Pipeline                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| Motorcycle / ojek / car     | Single OSRM driving route × peak 1.45; P80 ≈ P50 × 1.4                                    |
| Transit only                | Walk-access planner (no ojek feeders); unlock when both pins within ~500 m of known stops |
| Best price mix (`cheapest`) | Multimodal enumeration → shortlist → OSRM enrich Gojek legs → up to 3 recs                |

---

## 4. Best price mix — pipeline

```text
1. Enumerate candidate plans (heuristic meters / network times)
2. Deduplicate by leg signature
3. Shortlist diverse top ~28 as a **union with per-axis quota**: take up to `ceil(28/3)` unique plans from each of cheapest / fastest / best-balance, then fill any remainder (preferring time). One axis must not consume the full cap (e.g. dozens of cheap TransJakarta stop-pair variants starving faster MRT/KRL).
4. Enrich Gojek legs with OSRM road geometry + duration (parallel, cached)
5. Re-score and pick Best price / Best time / Best balance
```

### 4.1 Inputs and outputs

**Inputs (per home × office):** home pin, office pin, WFO days (1–5), enabled PT systems, static stops + network, pricing constants.

**Outputs:** up to 3 recommendations (best **price**, **time**, **balance**), each with ordered legs, one-way minutes & IDR, daily RT cost, monthly cost.

**Home ranking (UI):** homes are ordered by primary plan **monthly transport cost** ascending. No salary % or rent in the ranking.

### 4.2 Access and egress

| Mode             | When allowed                                                                  | Time                                                           | Cost                          |
| ---------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------- |
| **Walk**         | Pin ≤ **500 m** from stop                                                     | `max(3, meters / 80 m·min⁻¹)`                                  | Rp 0                          |
| **Gojek (ojek)** | Pin ≤ **8 km** from stop (or door-to-door); preferred when walk exceeds 500 m | haversine→22 km/h, then ×1.45; after OSRM: road duration ×1.45 | `base + km × perKm`           |
| **Transit ride** | Along curated network polyline                                                | `max(5, path_m / 350 m·min⁻¹)`; TJ also ×1.45                  | `base + min(km, cap) × perKm` |

### 4.3 Stop selection

For each PT system independently:

1. **Board:** the **single nearest** stop to **home** within ojek radius (≤ 8 km).
2. **Alight:** the **single nearest** stop to **office** within ojek radius (same nearest-stop rule).
3. Distance is **haversine**, not road distance

Do not board/alight at a farther station even if the rail segment would be slightly shorter (e.g. prefer Bundaran HI over Bendungan Hilir when HI is closer to the office).

### 4.4 Same-system plans (preferred)

```text
[Walk|Gojek] home → board
  → ride same system board → alight
  → [Walk|Gojek] alight → office
```

Enumerate access × egress × board × alight candidates, then dedupe.

### 4.5 Cross-system transfers (when walk last-mile is not available)

Use a second system when the boarding system has **no stop within walk unlock (500 m)** of the office — even if a stop is within ojek range. That unlocks cheaper last miles such as **MRT → walk transfer → TransJakarta → nearer halte** (up to **5 legs**) instead of a long Gojek from Bundaran HI.

Still require:

1. Real interchange: two stops of different systems within **≤ 600 m**
2. Prefer pair closer to the **office**
3. Destination system has a stop within **ojek (8 km)** of the office
4. Legs: `[access] → ride A → transfer walk/Gojek → ride B → egress`

**Skip transfer** when system A is already walkable to the office.

**Forbidden:** inventing hubs (e.g. fake “MRT at St. Cawang”). Drop the candidate if no co-located pair exists.

### 4.6 Pure Gojek baseline

Always include one door-to-door Gojek plan so **Best time** can select it when rail+feeders are slower.

Door-to-door Gojek is **excluded** from **Best price** and **Best balance** pools (unless it is the only plan). Otherwise the mix collapses to Gojek whenever a short road trip beats rail on VOT.

### 4.7 Network pathfinding

For a ride on one system between two stops:

1. Build (cache) undirected graph from that system’s LineStrings
2. Merge vertices within **120 m** as junctions
3. Snap endpoints (max **2.5 km**)
4. Dijkstra; cache node chain per `(system, startNode, endNode)`
5. Anchor path to stop coordinates; fare/time use polyline length
6. No path → straight segment between stops

### 4.8 Ranking

| Kind             | Rule                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Best price**   | Prefer **MRT** mixes if any (else KRL, else LRT); then **lowest fare**. Allows **MRT→TJ** (≤5 legs) over MRT+long Gojek. Door-Gojek excluded. |
| **Best time**    | Lowest one-way minutes (**Gojek baseline allowed**); ties by cost                                                                             |
| **Best balance** | All non–door-Gojek mixes; minimize `cost/maxCost + minutes/maxMins`                                                                           |

Rationale: when Bundaran HI is not walkable, transfer to TJ for a nearer halte (more steps OK) is usually cheaper than Gojek from HI.

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

| Concern                    | Module                                    |
| -------------------------- | ----------------------------------------- |
| Enumerate / rank / enrich  | `src/lib/multimodalPlanner.ts`            |
| Nearest stops, interchange | `src/lib/transitPlanner.ts`               |
| Network Dijkstra + caches  | `src/lib/transitNetwork.ts`               |
| OSRM + haversine           | `src/lib/routing.ts`                      |
| Peak / P80 factors         | `src/lib/traffic.ts` (+ `master.traffic`) |
| Monthly math               | `src/lib/commute.ts`                      |
| Decision brief export      | `src/lib/report.ts`                       |
| Orchestration (UI)         | `src/pages/MapPage.tsx`                   |
| Pricing constants          | `src/master/defaults.ts`                  |
| Master data store          | `src/master/store.ts`                     |

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
