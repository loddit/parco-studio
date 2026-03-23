import {
  APIProvider,
  Map as GoogleMap,
  type MapCameraChangedEvent,
} from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Map, { NavigationControl, type ViewStateChangeEvent } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import { getDataset, saveViewport } from "@/lib/datasets-db";
import type { Dataset, LngLat } from "@/types/dataset";

const FALLBACK_CENTER = { lat: 31.2304, lng: 121.4737 };
const FALLBACK_ZOOM = 10;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

type MapRenderer = "google-maps" | "react-map-gl";

export function DatasetEditorPage() {
  const { datasetId = "" } = useParams();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [renderer, setRenderer] = useState<MapRenderer>(
    GOOGLE_MAPS_API_KEY ? "google-maps" : "react-map-gl",
  );
  const [viewport, setViewport] = useState<{ center: LngLat; zoomLevel: number }>({
    center: [FALLBACK_CENTER.lng, FALLBACK_CENTER.lat],
    zoomLevel: FALLBACK_ZOOM,
  });

  useEffect(() => {
    void loadDataset();
  }, [datasetId]);

  async function loadDataset() {
    const nextDataset = await getDataset(datasetId);
    setDataset(nextDataset ?? null);

    if (nextDataset) {
      setViewport({
        center: nextDataset.center ?? [FALLBACK_CENTER.lng, FALLBACK_CENTER.lat],
        zoomLevel: nextDataset.zoomLevel ?? FALLBACK_ZOOM,
      });
    }
  }

  async function handleSaveViewport() {
    if (!dataset) {
      return;
    }

    const nextDataset = await saveViewport(dataset.id, viewport.center, viewport.zoomLevel);
    setDataset(nextDataset);
  }

  function handleResetViewport() {
    if (!dataset) {
      return;
    }

    setViewport({
      center: dataset.center ?? [FALLBACK_CENTER.lng, FALLBACK_CENTER.lat],
      zoomLevel: dataset.zoomLevel ?? FALLBACK_ZOOM,
    });
  }

  if (!dataset) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-4">
        <div className="panel max-w-lg p-8 text-center">
          <p className="text-lg font-semibold text-slate-950">Dataset not found</p>
          <p className="mt-2 text-slate-600">
            The requested dataset is missing from IndexedDB or has been deleted.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell flex min-h-screen overflow-hidden">
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-sky-100 bg-white/92 p-5">
        <div className="flex items-center gap-3">
          <Link
            aria-label="Back to datasets"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            to="/"
          >
            &lt;
          </Link>
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-slate-950">
            {dataset.name}
          </h1>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="map-renderer">
            Map renderer
          </label>
          <Select
            id="map-renderer"
            value={renderer}
            onChange={(event) => setRenderer(event.target.value as MapRenderer)}
          >
            <option disabled={!GOOGLE_MAPS_API_KEY} value="google-maps">
              Google Maps{GOOGLE_MAPS_API_KEY ? "" : " (API key required)"}
            </option>
            <option value="react-map-gl">React Map GL</option>
          </Select>
        </div>

        <div className="mt-6 flex gap-2">
          <Button className="flex-1" onClick={() => void handleSaveViewport()} variant="primary">
            Save
          </Button>
          <Button className="flex-1" onClick={handleResetViewport} variant="secondary">
            Reset
          </Button>
        </div>

        <div className="mt-6 flex-1 rounded-3xl border border-dashed border-sky-200 bg-sky-50/70 p-4 text-sm text-slate-500">
          Selected feature details will live here.
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <MapCanvas renderer={renderer} viewport={viewport} onViewportChange={setViewport} />
      </section>
    </main>
  );
}

function MapCanvas({
  renderer,
  viewport,
  onViewportChange,
}: {
  renderer: MapRenderer;
  viewport: { center: LngLat; zoomLevel: number };
  onViewportChange: (viewport: { center: LngLat; zoomLevel: number }) => void;
}) {
  const mapLibreStyleUrl =
    import.meta.env.VITE_MAPLIBRE_STYLE_URL || "https://demotiles.maplibre.org/style.json";
  const center = viewport.center;
  const zoom = viewport.zoomLevel;

  if (renderer === "google-maps" && GOOGLE_MAPS_API_KEY) {
    return (
      <div className="h-full min-h-screen">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <GoogleMap
            center={{ lat: center[1], lng: center[0] }}
            zoom={zoom}
            disableDefaultUI={false}
            gestureHandling="greedy"
            onCameraChanged={(event: MapCameraChangedEvent) => {
              onViewportChange({
                center: [event.detail.center.lng, event.detail.center.lat],
                zoomLevel: event.detail.zoom,
              });
            }}
            style={{ width: "100%", height: "100%" }}
          />
        </APIProvider>
      </div>
    );
  }

  return (
    <div className="h-full min-h-screen">
      <Map
        latitude={center[1]}
        mapLib={maplibregl}
        mapStyle={mapLibreStyleUrl}
        longitude={center[0]}
        onMove={(event: ViewStateChangeEvent) => {
          onViewportChange({
            center: [event.viewState.longitude, event.viewState.latitude],
            zoomLevel: event.viewState.zoom,
          });
        }}
        style={{ width: "100%", height: "100%" }}
        zoom={zoom}
      >
        <NavigationControl position="top-right" />
      </Map>
    </div>
  );
}
