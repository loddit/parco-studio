/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_MAPLIBRE_STYLE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
