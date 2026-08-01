# Product Requirements Document (PRD)

| Field            | Value                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product**      | Jabodetabek Offer Stress-Test                                                                                                                                                                        |
| **Repo**         | `relocation-maps-jakarta`                                                                                                                                                                            |
| **Status**       | MVP shipped (client SPA); validation interviews 0/15                                                                                                                                                 |
| **Owner**        | Founder                                                                                                                                                                                              |
| **Last updated** | 2026-08-01                                                                                                                                                                                           |
| **Related docs** | [INDEX.md](./INDEX.md), [PRODUCT.md](./PRODUCT.md), [RFC-001-planner.md](./RFC-001-planner.md), [SDLC.md](./SDLC.md), [TDD.md](./TDD.md), [VALIDATION.md](./VALIDATION.md), [CURSOR.md](./CURSOR.md) |

---

## 1. Summary

A free, map-first web tool for Jabodetabek job candidates with an offer in hand. Users pin an office and up to four candidate homes, compare commute modes (best-price mix, motorcycle, ojek, car, transit), and see monthly time and cost against salary — then export a one-page decision brief to share with a partner, parents, or HR.

**One-liner:** Pin office + homes → stress-test commute × hybrid days × salary → export a negotiation-ready brief.

---

## 2. Problem

At offer stage (~30–90 days before start), candidates must decide whether to accept, negotiate hybrid, relocate, or change their home shortlist. Today they stitch together Google Maps, Grab/Gojek, mental math, and spreadsheets. That workflow does not reliably produce:

- Structured **P50 / P80** peak commute bands
- **Monthly** transport cost and hours vs salary
- Side-by-side comparison of **homes × modes × hybrid days**
- A shareable artifact for family or HR negotiation

Mistakes are costly: wrong accept/reject, under-negotiated WFH, or a home that looks fine on a midday map and fails at peak.

---

## 3. Goals and non-goals

### Goals (MVP)

1. Let a candidate model a concrete offer scenario on a Jabodetabek map in under ~10 minutes.
2. Surface commute as **time bands + monthly IDR + % of salary**, not a single optimistic ETA.
3. Support motorcycle / ojek as first-class modes alongside car and transit.
4. Export a decision brief suitable for sharing (partner / parents / HR).
5. Keep the product free and client-only until validation proves demand.

### Success metric

A user changes at least one of:

- Home shortlist
- Hybrid negotiation ask
- Offer accept/reject rationale

**Not** PDF/HTML download count alone.

### Non-goals (MVP)

- Free-form AI chat
- Citywide multimodal routing graph competitive with Google/Grab
- Housing marketplace or scraped listings
- Accounts, teams, or employer dashboards
- Guaranteed live door-to-door ETAs or live Grab fares
- B2B office-impact analytics (deferred monetization)

---

## 4. Target users

### Primary persona

**Offer-stage candidate in Jabodetabek** who:

- Has (or is about to have) an office location and salary
- Faces a decision window of ~30–90 days
- Must weigh accept / negotiate hybrid / move / change home shortlist
- Typically considers clusters such as SCBD/Sudirman, Kuningan, BSD

### Secondary audiences of the brief (not product operators)

- Partner or parents reviewing the decision
- HR / recruiting during hybrid or relocation negotiation

### Out of scope for MVP

- Pure remote roles with no office expectation
- Casual browsers with no offer / move decision
- HR / facilities teams (later B2B path)

---

## 5. User journey

```text
Open app
  → Place office (map click / lat-lng / preset)
  → Place 1–4 homes (map click / move within 400 m / presets)
  → Set hybrid days, salary, optional rent, name/company labels
  → Per home, choose mode: best price mix | motorcycle | ojek | car | transit*
  → Review ranked results (P50/P80, monthly hours, cost, % salary)
  → Inspect path detail (leg-by-leg itinerary)
  → Export decision brief (`.txt` download)
```

\* Transit unlocks when both office and home are within ~1.2 km of known PT stops.

---

## 6. Functional requirements

### 6.1 Map and pins

| ID  | Requirement                                                                                                     | Priority |
| --- | --------------------------------------------------------------------------------------------------------------- | -------- |
| F1  | Map centered on Jakarta with Carto light basemap                                                                | Must     |
| F2  | Click-to-place office, then homes (max 4)                                                                       | Must     |
| F3  | Click within 400 m of an existing home moves that home                                                          | Must     |
| F4  | Manual lat/lng entry for office and homes                                                                       | Must     |
| F5  | Preset chips for common offices (SCBD/Sudirman, Kuningan, BSD) and homes (Bekasi Barat, Depok, Tangerang, etc.) | Should   |
| F6  | Optional display-only PT layers (KRL / MRT / LRT / TransJakarta)                                                | Should   |
| F7  | Draw route polylines colored by leg kind                                                                        | Must     |

### 6.2 Scenario inputs

| ID  | Requirement                                    | Priority |
| --- | ---------------------------------------------- | -------- |
| F8  | Hybrid days in office: 1–5 (default 3)         | Must     |
| F9  | Monthly salary in IDR (default 12,000,000)     | Must     |
| F10 | Optional monthly rent per home                 | Should   |
| F11 | Candidate name and company label for the brief | Should   |

### 6.3 Commute modes and computation

| ID  | Requirement                                                                                                                                    | Priority |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| F12 | Road modes (motorcycle, ojek, car) via OSRM driving routes                                                                                     | Must     |
| F13 | Apply peak road factor (×1.45) to road and TransJakarta segments; not to KRL/MRT/LRT/walk                                                      | Must     |
| F14 | P80 ≈ P50 × 1.4 for road-mode summaries                                                                                                        | Must     |
| F15 | Monthly = round-trip × WFO days × 4.33 weeks                                                                                                   | Must     |
| F16 | **Best price mix**: see [RFC-001](./RFC-001-planner.md) — same-line board/alight + walk/ojek last mile; up to 3 plans (price / time / balance) | Must     |
| F17 | **Transit only**: unlocked when both pins are ≤1.2 km from known stops; walk-access itinerary (no ojek feeders)                                | Must     |
| F18 | Heuristic fares (Gojek-like + JakLingko-style) — clearly framed as estimates                                                                   | Must     |
| F19 | OSRM failure fallback (straight-line ~22 km/h proxy)                                                                                           | Should   |

### 6.4 Results and export

| ID  | Requirement                                                                                           | Priority |
| --- | ----------------------------------------------------------------------------------------------------- | -------- |
| F20 | Ranked home comparison: P50/P80 one-way, monthly hours, transport day/month, rent, total, % of salary | Must     |
| F21 | Path detail / itinerary log for selected plan                                                         | Must     |
| F22 | Export decision brief as downloadable plain-text (`.txt`) brief                                       | Must     |
| F23 | In-UI caveats that numbers are bands/heuristics, not live Grab/Google ETAs                            | Must     |

### 6.5 Explicitly out of scope for this release

| ID  | Item                                           |
| --- | ---------------------------------------------- |
| N1  | User accounts, save/load scenarios, cloud sync |
| N2  | Live GTFS schedules or Grab/Gojek API pricing  |
| N3  | Housing listings scrape or marketplace         |
| N4  | Employer / HR dashboards                       |
| N5  | Multi-city beyond Jabodetabek                  |

---

## 7. Accuracy and trust framing

Product truth is framed as **decision support bands**, not navigation:

| Topic           | Rule                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Time            | Report P50 and P80 peak one-way minutes                                                                             |
| Cost            | Heuristic IDR day/month — not live ride-hailing quotes                                                              |
| Traffic         | Road / TJ ×1.45 peak factor; rail/walk unfactored                                                                   |
| Transit planner | Static GeoJSON + proximity board/alight + same-line last mile; real walk transfers only — not a full schedule graph |
| Marketing       | Do not claim live schedules or Google/Grab-competitive ETAs                                                         |

Validation gate: complete **15–20 interviews** per [VALIDATION.md](./VALIDATION.md) before treating numbers as product truth. Kill/pivot criteria live in that doc.

---

## 8. Geographic and data scope

### Coverage

**Jabodetabek** (not DKI-only): office clusters around SCBD/Sudirman, Kuningan, BSD; feeder homes along KRL/MRT and satellite cities (Bekasi, Depok, Tangerang, Bogor, etc.).

### Transit data (static GeoJSON under `public/data/transit/`)

| System       | Stops (approx.) | Network      |
| ------------ | --------------- | ------------ |
| KRL          | 68              | 5 lines      |
| MRT          | 13              | 1 line (N–S) |
| LRT          | 18              | 2 lines      |
| TransJakarta | 231             | 14 corridors |

### Access radii

| Constraint                | Value            |
| ------------------------- | ---------------- |
| Walk / transit unlock     | ≤ 1.2 km to stop |
| Ojek feeder to stop       | ≤ 8 km           |
| Move-home click threshold | 400 m            |
| Max homes                 | 4                |

---

## 9. UX requirements

### Layout (single page)

| Region       | Role                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| Left sidebar | Scenario panel: pin step, office editor, presets, salary, hybrid days, brief metadata         |
| Main map     | Pins, routes, optional PT overlays, click-to-place                                            |
| Map chrome   | Legend, placement step, PT layer toggles                                                      |
| Below map    | Results board with per-home editors (label, lat/lng, mode, rent, remove), path detail, export |

### UX principles

1. Map-first — placement is the primary input, not forms.
2. One composition — office → homes → compare → export; no multi-page wizard.
3. Honesty over precision — caveats visible near results and in the brief.
4. Brief is the shareable artifact; the app itself stays free and anonymous.

---

## 10. Technical requirements

| Layer        | Choice                                    |
| ------------ | ----------------------------------------- |
| App          | React 19 + TypeScript, Vite 8             |
| UI           | shadcn/ui (Radix) + Tailwind CSS          |
| Maps         | mapcn (MapLibre GL), CARTO Positron tiles |
| Road routing | Public OSRM (`router.project-osrm.org`)   |
| Transit      | Static GeoJSON; client-side planners      |
| Backend      | None (pure SPA)                           |
| Auth / DB    | None                                      |
| Env vars     | None required                             |
| Deploy       | Static host of `vite build` → `dist/`     |
| Lint         | oxlint                                    |

### Constraints

- Client-only state: refresh clears the scenario
- Public OSRM may rate-limit or be unavailable; fallback required
- No secrets in repo; no third-party ride-hailing API keys in MVP

---

## 11. Monetization (near vs later)

| Horizon   | Model                                                          |
| --------- | -------------------------------------------------------------- |
| Near-term | Free tool; growth via shareable decision briefs                |
| Later     | Employer office-impact analytics; job/property platform embeds |

Do not start B2B sales before consumer usage and corridor accuracy are validated.

---

## 12. Milestones and open work

| Milestone                          | Status      | Notes                                    |
| ---------------------------------- | ----------- | ---------------------------------------- |
| MVP SPA (pin → compare → brief)    | Done        | Current codebase                         |
| Static PT catalog (KRL/MRT/LRT/TJ) | Done        | `public/data/transit/`                   |
| Validation interviews (15–20)      | Not started | See VALIDATION.md                        |
| Synthesis + kill/pivot decision    | Blocked     | Awaits interviews                        |
| Accuracy calibration vs ride logs  | Planned     | Replace legacy corridor matrix marketing |
| Persistence / shareable deep links | Future      | After validation                         |
| B2B / embeds                       | Future      | After consumer wedge proof               |

---

## 13. Risks

| Risk                                               | Mitigation                                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Users distrust heuristic fares/times               | Clear caveats; P50/P80 framing; interview for distrust triggers                                                   |
| Public OSRM downtime                               | Straight-line fallback; consider self-hosted OSRM later                                                           |
| Transit itineraries feel “wrong” vs real transfers | Same-line last mile preferred; transfers only at co-located stops (≤600 m walk); expand catalog; do not overclaim |
| Building before product truth                      | Gate on 15–20 interviews; kill criteria in VALIDATION.md                                                          |
| Scope creep into marketplace / AI chat             | Explicit non-goals in this PRD and PRODUCT.md                                                                     |

---

## 14. Acceptance criteria (MVP)

The MVP is acceptable when all of the following hold:

1. User can place one office and up to four homes on the map (or via presets / lat-lng).
2. For road modes, routes and time/cost summaries appear without a backend.
3. Best-price mix returns up to three recommendations when multimodal options exist.
4. Transit-only mode unlocks only when both pins are near known stops, with a step log.
5. Results show P50/P80, monthly hours, transport cost, rent (if entered), and % of salary.
6. User can open/download a decision brief that includes scenario inputs and ranked homes.
7. UI states that figures are estimates/bands, not live Grab/Google ETAs.
8. App builds and runs via `npm install && npm run dev` with no required env vars.

---

## 15. Appendix — key constants

Normative constants (peak factors, radii, speeds, ranking bands, monthly formula) live in **[RFC-001-planner.md](./RFC-001-planner.md) §2**.

Quick reference for product readers:

| Constant              | Value                 |
| --------------------- | --------------------- |
| Default salary        | Rp 12,000,000 / month |
| Default hybrid days   | 3                     |
| Peak road factor      | 1.45                  |
| P80 factor (road)     | 1.4 × P50             |
| Weeks / month         | 4.33                  |
| Walk / transit unlock | ≤ 1.2 km to stop      |
| Ojek feeder           | ≤ 8 km                |
| Interchange max walk  | 600 m                 |
| Max homes             | 4                     |

---

## 16. Algorithm specification — Best price mix

The full Best price mix pipeline, stop selection, transfer rules, ranking, OSRM enrichment, worked example, and code map are normative in **[RFC-001-planner.md](./RFC-001-planner.md)**.

Implementation: `src/lib/multimodalPlanner.ts`, `transitPlanner.ts`, `transitNetwork.ts`, `routing.ts`, `commute.ts`. Figures remain decision-support estimates, not live Grab/Google navigation.

Product-level rules that must not regress (detail in RFC):

1. Same-system + last mile preferred; cross-system only when boarding system cannot reach the office.
2. Transfers only at real co-located stops (≤ 600 m) — never invented hubs.
3. Up to three mix recommendations: best price / time / balance.
4. Peak ×1.45 on road/Gojek/TJ only — not KRL/MRT/LRT/walk.

---

## Document control

This PRD is the requirements source of truth for the consumer offer stress-test wedge. Positioning lives in [PRODUCT.md](./PRODUCT.md); planner math in [RFC-001-planner.md](./RFC-001-planner.md); lifecycle/rebuild in [SDLC.md](./SDLC.md); test plan in [TDD.md](./TDD.md); interviews in [VALIDATION.md](./VALIDATION.md). Update this PRD when scope, persona, or MVP acceptance criteria change — not for routine planner constant tweaks (those go to the RFC).
