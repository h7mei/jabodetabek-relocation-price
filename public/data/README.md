# Transit GeoJSON data

Data is split **by public-transport system**. Add a new mode later by adding a folder + catalog entry.

## Layout

```text
public/data/transit/
  catalog.json              ← registry of systems (source of truth for loaders)
  krl/
    stops.geojson           ← Point features
    network.geojson         ← LineString features
  mrt/
    stops.geojson
    network.geojson
  lrt/
    stops.geojson
    network.geojson
  transjakarta/
    stops.geojson
    network.geojson
  <new-system>/             ← future: copy this pattern
    stops.geojson
    network.geojson
```

Format: **GeoJSON FeatureCollection** ([RFC 7946](https://datatracker.ietf.org/doc/html/rfc7946)).

---

## `catalog.json`

```json
{
  "systems": [
    { "id": "krl", "label": "KRL", "folder": "krl" },
    { "id": "mrt", "label": "MRT", "folder": "mrt" },
    { "id": "lrt", "label": "LRT", "folder": "lrt" },
    { "id": "transjakarta", "label": "TransJakarta", "folder": "transjakarta" }
  ]
}
```

| Field    | Rule                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------- |
| `id`     | Must match a known `TransitSystem` in `src/types.ts` today: `krl` \| `mrt` \| `lrt` \| `transjakarta` |
| `label`  | UI legend text                                                                                        |
| `folder` | Directory under `transit/` (defaults to `id` if omitted)                                              |

### Adding a new public transport later

1. Create `transit/<id>/stops.geojson` and `transit/<id>/network.geojson`
2. Append `{ "id", "label", "folder" }` to `catalog.json`
3. Add `id` to `TransitSystem` / `TRANSIT_SYSTEMS` / colors in `src/types.ts` and `src/lib/routing.ts`

---

## Hard rules (do not break)

1. Coordinates are always **`[longitude, latitude]`** — never `[lat, lng]`.
   - Jakarta example: `[106.8228, -6.2025]` ✅
   - Wrong: `[-6.2025, 106.8228]` ❌
2. Root object must be:
   ```json
   { "type": "FeatureCollection", "name": "...", "features": [ ... ] }
   ```
3. Every feature must have `"type": "Feature"`, `"properties"`, `"geometry"`.
4. Prefer setting `"system"` in properties to the folder id (loader also stamps it from the catalog).
5. Keep JSON valid (no trailing commas, no comments).
6. Align stop coordinates with nearby vertices on that system’s network line so routes snap cleanly.
7. Put **only that system’s** features in its folder (do not mix MRT stops into `krl/`).

---

## `stops.geojson` (per system folder)

**Geometry:** `Point`  
**Properties required:** `name` (and ideally `system`)

```json
{
  "type": "FeatureCollection",
  "name": "jabodetabek-mrt-stops",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "system": "mrt",
        "name": "MRT Bundaran HI"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [106.823, -6.1934]
      }
    }
  ]
}
```

Naming tips: KRL `St. …` · MRT `MRT …` · LRT `LRT …` · TransJakarta `Halte …`

Hubs (transfers) are inferred from name keywords:  
`manggarai`, `sudirman`, `dukuh atas`, `tanah abang`, `cawang`, `bundaran hi`.

---

## `network.geojson` (per system folder)

**Geometry:** `LineString`  
**Properties required:** `name`, `id` (and ideally `system`)  
**`id`:** unique kebab-case, e.g. `mrt-ns`, `krl-bogor`

```json
{
  "type": "FeatureCollection",
  "name": "jabodetabek-mrt-network",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "system": "mrt",
        "name": "MRT Jakarta North–South",
        "id": "mrt-ns"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [106.823, -6.1934],
          [106.8227, -6.2034],
          [106.798, -6.2445]
        ]
      }
    }
  ]
}
```

Rules for lines:

- At least **2** coordinates per `LineString`.
- Order matters (follow the real corridor).
- Junctions shared across systems should use the same (or ~120 m) `[lng, lat]`.

---

## Checklist before saving

- [ ] File is valid JSON
- [ ] Features live in the correct system folder
- [ ] System is listed in `catalog.json`
- [ ] Stops = `Point`; network = `LineString`
- [ ] Coordinates are `[lng, lat]`
- [ ] Matching corridor exists for stops you expect to route
- [ ] If this is a **new** system id, TypeScript `TransitSystem` + colors were updated

---

## What this data is used for

- **stops** → nearest station to pins; itinerary names
- **network** → map overlay + PT route polyline snap
- **catalog** → which folders to load

Do not put road/Gojek paths here — those come from OSRM at runtime.
