const MAP_SOURCE_CONFIG = {
  mapbox: {
    label: "Mapbox",
    renderer: "mapbox",
    envKey: "VITE_MAPBOX_ACCESS_TOKEN",
    styles: {
      default: { label: "Default", url: "mapbox://styles/mapbox/light-v11" },
      satellite: { label: "Satellite", url: "mapbox://styles/mapbox/satellite-v9" },
      terrain: { label: "Terrain", url: "mapbox://styles/mapbox/outdoors-v12" },
    },
  },
  google: {
    label: "Google Maps",
    renderer: "google",
    envKey: "VITE_GOOGLE_MAPS_API_KEY",
    styles: {
      default: { label: "Default", url: "roadmap" },
      satellite: { label: "Satellite", url: "satellite" },
      terrain: { label: "Terrain", url: "terrain" },
    },
  },
  carto: {
    label: "Carto",
    renderer: "maplibre",
    envKey: undefined,
    styles: {
      default: {
        label: "Default",
        url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      },
      dark: {
        label: "Dark",
        url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      },
      nature: {
        label: "Nature",
        url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      },
    },
  },
  maptiler: {
    label: "MapTiler",
    renderer: "maplibre",
    envKey: "VITE_MAPTILER_API_KEY",
    styles: {
      default: { label: "Default", url: "https://api.maptiler.com/maps/bright-v2/style.json" },
      satellite: { label: "Satellite", url: "https://api.maptiler.com/maps/hybrid/style.json" },
      terrain: { label: "Terrain", url: "https://api.maptiler.com/maps/outdoor/style.json" },
    },
  },
  icgc: {
    label: "ICGC",
    renderer: "maplibre",
    envKey: undefined,
    styles: {
      default: { label: "Default", url: "https://geoserveis.icgc.cat/contextmaps/icgc.json" },
      satellite: {
        label: "Satellite",
        url: "https://geoserveis.icgc.cat/contextmaps/icgc_orto_estandard.json",
      },
      dark: {
        label: "Dark",
        url: "https://geoserveis.icgc.cat/contextmaps/icgc_mapa_base_fosc.json",
      },
    },
  },
  others: {
    label: "Others",
    renderer: "maplibre",
    envKey: undefined,
    styles: {
      default: {
        label: "Default",
        url: "https://raw.githubusercontent.com/go2garret/maps/main/src/assets/json/openStreetMap.json",
      },
      satellite: {
        label: "Satellite",
        url: "https://raw.githubusercontent.com/go2garret/maps/main/src/assets/json/arcgis_hybrid.json",
      },
    },
  },
  protomaps: {
    label: "Protomaps",
    renderer: "maplibre",
    envKey: "VITE_PROTOMAPS_API_KEY",
    styles: {
      default: { label: "Default", url: "https://api.protomaps.com/styles/v5/light/en.json" },
      dark: { label: "Dark", url: "https://api.protomaps.com/styles/v5/dark/en.json" },
      light: { label: "Light", url: "https://api.protomaps.com/styles/v5/white/en.json" },
    },
  },
} as const;

export type EditorMapSource = keyof typeof MAP_SOURCE_CONFIG;
export type EditorMapRenderer = (typeof MAP_SOURCE_CONFIG)[EditorMapSource]["renderer"];

type SourceConfig<S extends EditorMapSource> = (typeof MAP_SOURCE_CONFIG)[S];

export type EditorMapStyle<S extends EditorMapSource = EditorMapSource> = keyof SourceConfig<S>["styles"];

export const DEFAULT_MAP_SOURCE: EditorMapSource = "carto";
export const DEFAULT_MAP_STYLE: EditorMapStyle<"carto"> = "default";

export function getMapSourceOptions() {
  return (Object.entries(MAP_SOURCE_CONFIG) as Array<
    [EditorMapSource, (typeof MAP_SOURCE_CONFIG)[EditorMapSource]]
  >).map(([value, config]) => ({
    value,
    label: config.label,
    isAvailable: isMapSourceAvailable(value),
  }));
}

export function getMapStyleOptions(source: EditorMapSource) {
  const styles = MAP_SOURCE_CONFIG[source].styles;

  return (Object.entries(styles) as Array<
    [EditorMapStyle<typeof source>, SourceConfig<typeof source>["styles"][EditorMapStyle<typeof source>]]
  >).map(([value, config]) => ({
    value,
    label: config.label,
  }));
}

export function getMapRenderer(source: EditorMapSource): EditorMapRenderer {
  return MAP_SOURCE_CONFIG[source].renderer;
}

export function getInitialMapStyle(source: EditorMapSource): EditorMapStyle {
  const [firstStyle] = Object.keys(MAP_SOURCE_CONFIG[source].styles) as EditorMapStyle[];
  return firstStyle;
}

export function isMapSourceAvailable(source: EditorMapSource) {
  const envKey = MAP_SOURCE_CONFIG[source].envKey;

  if (!envKey) {
    return true;
  }

  return Boolean(import.meta.env[envKey]);
}

export function getMapSourceRequirement(source: EditorMapSource) {
  const envKey = MAP_SOURCE_CONFIG[source].envKey;

  if (!envKey) {
    return null;
  }

  return envKey;
}

export function resolveMapStyleUrl(source: EditorMapSource, style: EditorMapStyle) {
  const sourceConfig = MAP_SOURCE_CONFIG[source];
  const styles = sourceConfig.styles as Record<string, { label: string; url: string }>;
  const styleConfig = styles[style] ?? styles[getInitialMapStyle(source)];

  if (!styleConfig) {
    return "";
  }

  let { url } = styleConfig;

  if (source === "maptiler") {
    url += `?key=${import.meta.env.VITE_MAPTILER_API_KEY ?? ""}`;
  }

  if (source === "protomaps") {
    url += `?key=${import.meta.env.VITE_PROTOMAPS_API_KEY ?? ""}`;
  }

  return url;
}

export function getMapboxAccessToken() {
  return import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? "";
}
