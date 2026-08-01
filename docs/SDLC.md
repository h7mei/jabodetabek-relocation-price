# SDLC — Jabodetabek Relocation Price

| Field            | Value                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scope**        | Client-only React SPA; no backend                                                                                                            |
| **Last updated** | 2026-08-01                                                                                                                                   |
| **Related**      | [INDEX.md](./INDEX.md), [PRD.md](./PRD.md), [RFC-001-planner.md](./RFC-001-planner.md), [TDD.md](./TDD.md), [VALIDATION.md](./VALIDATION.md) |

Lean lifecycle for a solo/founder + Cursor workflow. Not enterprise RACI or sprint theater.

---

## 1. Phases

```text
Discover → Specify → Build → Verify → Validate → Operate
```

| Phase        | Goal                                  | Primary docs / artifacts                                             |
| ------------ | ------------------------------------- | -------------------------------------------------------------------- |
| **Discover** | Confirm wedge and decision moment     | [PRODUCT.md](./PRODUCT.md), early user conversations                 |
| **Specify**  | Lock what and how math works          | [PRD.md](./PRD.md), [RFC-001-planner.md](./RFC-001-planner.md)       |
| **Build**    | Ship map → compare → brief            | Rebuild checklist below; `src/`                                      |
| **Verify**   | Prove planner invariants + acceptance | [TDD.md](./TDD.md), PRD §14, `npm run lint` / `build`                |
| **Validate** | Product truth via interviews          | [VALIDATION.md](./VALIDATION.md), kill/pivot                         |
| **Operate**  | Static deploy + calibration           | `vite build` → `dist/`; [CALIBRATION.md](../src/data/CALIBRATION.md) |

Gate: do not treat corridor numbers as product truth until validation interviews complete (see VALIDATION).

---

## 2. Rebuild from scratch (ordered checklist)

Use this when recreating the app. Prefer behavior-faithful planner + honest caveats over pixel-perfect UI.

### Step 1 — Scaffold

- [x] Vite + React 19 + TypeScript + shadcn/ui (Tailwind, Radix)
- [x] `react-router-dom` routes: `/` (MapPage), `/admin` (AdminPage)
- [x] mapcn (`@mapcn/map`) on MapLibre GL
- [x] oxlint; scripts: `dev`, `build` (`tsc -b && vite build`), `lint`, `preview`
- [x] No required env vars

### Step 2 — Types and master defaults

- [x] Shared types (`src/types.ts`): pins, modes, transit systems, scenario results
- [x] Pricing + preset offices/homes (`src/master/defaults.ts`)
- [x] Master store with localStorage key `relocation-maps:master-v1`

### Step 3 — Transit catalog

- [x] `public/data/transit/catalog.json` + per-system `stops.geojson` / `network.geojson`
- [x] Follow [public/data/README.md](../public/data/README.md) (`[lng, lat]` hard rule)
- [x] Loader into master store

### Step 4 — Road routing and monthly math

- [x] OSRM client + cache/coalesce + straight-line fallback (`src/lib/routing.ts`)
- [x] Peak factor 1.45 / P80 ×1.4 (`src/lib/traffic.ts`)
- [x] Monthly hours/cost vs salary (`src/lib/commute.ts`) per [RFC-001](./RFC-001-planner.md)

### Step 5 — Multimodal planner

- [x] Network Dijkstra (`transitNetwork.ts`)
- [x] Nearest stops / interchange (`transitPlanner.ts`)
- [x] Best price mix enumerate → shortlist 28 → OSRM enrich → rank (`multimodalPlanner.ts`)
- [x] Same-line preferred; transfers only ≤ 600 m co-located stops

### Step 6 — Map UX

- [x] mapcn MapLibre + CARTO Positron (`theme="light"`); click-to-place office then homes (unlimited)
- [x] Move home if click within 400 m
- [x] Presets, mode picker, salary/hybrid/rent, PT layer toggles (`MapGeoJSON` / `useMap`)
- [x] `MapRoute` polylines + results table + itinerary log

### Step 7 — Decision brief

- [x] Export downloadable `.txt` brief (`src/lib/report.ts`) with scenario + ranked homes
- [x] Caveats: bands/heuristics, not live Grab/Google ETAs

### Step 8 — Admin

- [x] `/admin` editor for offices, homes, pricing, transit GeoJSON
- [x] Import/export JSON; persist in localStorage; no auth

### Step 9 — Trust framing

- [x] In-UI honesty copy near results and in brief (PRD §7)

### Step 10 — Acceptance exit

- [x] All items in [PRD §14](./PRD.md#14-acceptance-criteria-mvp)
- [x] `npm run lint` and `npm run build` green
- [x] Planner goldens G1–G9 green ([TDD.md](./TDD.md)); CI: lint → test → build

---

## 3. Definition of Done (by phase)

| Phase    | Done when                                                               |
| -------- | ----------------------------------------------------------------------- |
| Specify  | PRD acceptance clear; RFC constants match intended math                 |
| Build    | Checklist steps 1–9; no invented backend/auth/env                       |
| Verify   | Lint + build green; PRD §14 manual pass; tests per TDD when present     |
| Validate | 15–20 interviews logged; synthesis + keep/kill/pivot decision           |
| Operate  | Static host of `dist/`; calibration notes updated when corridors change |

**Never DoD:** claiming live Grab/Google ETAs; shipping accounts/marketplace/AI chat in MVP.

---

## 4. Milestones (aligned with PRD)

| Milestone                          | Status                |
| ---------------------------------- | --------------------- |
| MVP SPA (pin → compare → brief)    | Done                  |
| Static PT catalog                  | Done                  |
| Validation interviews (15–20)      | Not started           |
| Synthesis + kill/pivot             | Blocked on interviews |
| Accuracy calibration vs ride logs  | Planned               |
| Persistence / shareable deep links | Future                |
| B2B / embeds                       | Future                |

---

## 5. Engineering practices

- Prefer editing `src/lib/*` planners over adding frameworks
- Math change → update RFC-001 (+ TDD goldens) in the same change
- Client-only state: scenario pins are in-memory; refresh clears them
- Agent workflow: [CURSOR.md](./CURSOR.md)

---

## Document control

Update this file when rebuild steps, DoD, or phase gates change. Product scope changes belong in the PRD; planner math in the RFC; interview process in VALIDATION.
