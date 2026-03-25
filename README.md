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
- `VITE_GOOGLE_MAPS_ID`: optional Google Maps Map ID used by the Google renderer.
- `VITE_MAPBOX_ACCESS_TOKEN`: enables the Mapbox renderer in the dataset editor.
- `VITE_MAPTILER_API_KEY`: enables MapTiler styles in the editor source switcher.
- `VITE_PROTOMAPS_API_KEY`: enables Protomaps styles in the editor source switcher.

## Current scope

- `/` renders a Dataset list stored in IndexedDB.
- Dataset records keep `name`, `center`, `zoomLevel`, `createdAt`, `updatedAt`.
- `center` and `zoomLevel` are intended to be saved automatically from the editor workflow.
- `/datasets/:datasetId` is the initial editor shell for future GeoJSON editing features.
