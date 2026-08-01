# Jabodetabek Offer Stress-Test

Client-only SPA: pin an office and up to four homes, compare commute modes (best-price mix, motorcycle, ojek, car, transit), and export a plain-text decision brief.

**Stack:** React 19 + Vite 8 · shadcn/ui (Radix) + Tailwind · mapcn (MapLibre) · public OSRM · static transit GeoJSON under `public/data/transit/`.

```bash
pnpm install
pnpm dev
```

- `/` — MapPage (scenario + map + results)
- `/admin` — localStorage master-data editor (no auth)

Figures are **P50/P80 bands and heuristic fares** — not live Grab/Google ETAs.

Product docs: [docs/INDEX.md](./docs/INDEX.md) · rebuild checklist: [docs/SDLC.md](./docs/SDLC.md)

**Basemap:** CARTO Positron via mapcn (commercial use may need a CARTO license; swap styles on the Map component if needed).
