# Jabodetabek Relocation Price

Client-only SPA: pin an office and any number of homes, compare commute modes (best-price mix, motorcycle, ojek, car, transit), and export a plain-text decision brief.

**Stack:** React 19 + Vite 8 · shadcn/ui (Radix) + Tailwind · mapcn (MapLibre) · public OSRM · static transit GeoJSON under `public/data/transit/`.

## Develop

```bash
pnpm install
pnpm dev
```

Requires **Node 22+** and **pnpm 10**.

## Verify & build

```bash
pnpm verify          # lint → test → typecheck → build
pnpm build           # emit static assets to dist/
pnpm preview         # serve dist/ locally
```

CI (`.github/workflows/ci.yml`) runs lint → test → typecheck → build on Node 22 / pnpm 10.

## Deploy (static)

Ship `dist/` to any static host. SPA routes (`/`, `/admin`) need history fallback to `index.html`:

- **Vercel** — `vercel.json` rewrite included
- **Netlify** — `public/_redirects` copied into `dist/`

```bash
pnpm build
# then upload dist/ or connect the repo to Vercel/Netlify
```

No env vars required for MVP.

## Routes

- `/` — MapPage (scenario + map + results)
- `/admin` — localStorage master-data editor (no auth)

Figures are **P50/P80 bands and heuristic fares** — not live Grab/Google ETAs.

Product docs: [docs/INDEX.md](./docs/INDEX.md) · rebuild checklist: [docs/SDLC.md](./docs/SDLC.md)

**Basemap:** CARTO Positron via mapcn (commercial use may need a CARTO license; swap styles on the Map component if needed).
