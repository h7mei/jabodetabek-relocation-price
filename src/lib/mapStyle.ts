import type { StyleSpecification } from "maplibre-gl"

/** Fast raster basemap — avoids heavy CARTO vector style + glyph fetches */
function cartoRasterStyle(path: "light_all" | "dark_all"): StyleSpecification {
  return {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: ["a", "b", "c", "d"].map(
          (s) => `https://${s}.basemaps.cartocdn.com/${path}/{z}/{x}/{y}@2x.png`
        ),
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxzoom: 20,
      },
    },
    layers: [{ id: "carto", type: "raster", source: "carto" }],
  }
}

export const FAST_MAP_STYLES = {
  light: cartoRasterStyle("light_all"),
  dark: cartoRasterStyle("dark_all"),
} as const

/** MapLibre options that shorten time-to-first-tiles */
export const FAST_MAP_OPTIONS = {
  fadeDuration: 0,
  maxPitch: 0,
  pitchWithRotate: false,
  dragRotate: false,
  collectResourceTiming: false,
  renderWorldCopies: false,
} as const
