# Parco Studio

GeoJSON editor scaffold built with Vite, React, TypeScript, Tailwind CSS, Google Maps, React Map GL and IndexedDB.

## Getting started

```bash
npm install
npm run dev
```

Create a local `.env` file if you want to enable the map providers:

```bash
cp .env.example .env
```

- `VITE_GOOGLE_MAPS_API_KEY`: enables the Google Maps renderer in the dataset editor.
- `VITE_MAPLIBRE_STYLE_URL`: optional style URL for the React Map GL renderer. Defaults to the MapLibre demo style.

## Current scope

- `/` renders a Dataset list stored in IndexedDB.
- Dataset records keep `name`, `center`, `zoomLevel`, `createdAt`, `updatedAt`.
- `center` and `zoomLevel` are intended to be saved automatically from the editor workflow.
- `/datasets/:datasetId` is the initial editor shell for future GeoJSON editing features.
