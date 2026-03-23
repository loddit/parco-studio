import {
  IconPoint,
  IconPointer,
  IconVectorSpline,
  IconVectorTriangle,
} from "@tabler/icons-react";
import type {
  Feature,
  FeatureCollection,
  LineString,
  Point,
  Polygon,
  Position,
} from "geojson";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { Button } from "@/components/Button";
import { getDataset, saveDatasetState } from "@/lib/datasets-db";
import {
  createEmptyFeatureCollection,
  type Dataset,
  type DatasetFeatureCollection,
  type DatasetGeometry,
  type LngLat,
} from "@/types/dataset";

const FALLBACK_CENTER = { lat: 31.2304, lng: 121.4737 };
const FALLBACK_ZOOM = 10;
const FEATURE_SOURCE_ID = "dataset-features";
const DRAFT_SOURCE_ID = "draft-features";
const FEATURE_FILL_LAYER_ID = "dataset-fill";
const FEATURE_LINE_LAYER_ID = "dataset-line";
const FEATURE_POINT_LAYER_ID = "dataset-point";
const SELECTED_FILL_LAYER_ID = "selected-fill";
const SELECTED_LINE_LAYER_ID = "selected-line";
const SELECTED_POINT_LAYER_ID = "selected-point";
const DRAFT_FILL_LAYER_ID = "draft-fill";
const DRAFT_LINE_LAYER_ID = "draft-line";
const DRAFT_POINT_LAYER_ID = "draft-point";
const INTERACTIVE_LAYER_IDS = [
  FEATURE_FILL_LAYER_ID,
  FEATURE_LINE_LAYER_ID,
  FEATURE_POINT_LAYER_ID,
  SELECTED_FILL_LAYER_ID,
  SELECTED_LINE_LAYER_ID,
  SELECTED_POINT_LAYER_ID,
];

type EditorMode = "select" | "draw-point" | "draw-line" | "draw-polygon";

const FEATURE_FILL_LAYER: LayerProps = {
  id: FEATURE_FILL_LAYER_ID,
  type: "fill",
  filter: ["all", ["==", ["geometry-type"], "Polygon"], ["!=", ["get", "isSelected"], true]],
  paint: {
    "fill-color": "#0ea5e9",
    "fill-opacity": 0.18,
  },
};

const FEATURE_LINE_LAYER: LayerProps = {
  id: FEATURE_LINE_LAYER_ID,
  type: "line",
  filter: ["all", ["==", ["geometry-type"], "LineString"], ["!=", ["get", "isSelected"], true]],
  paint: {
    "line-color": "#0284c7",
    "line-width": 3,
  },
};

const FEATURE_POINT_LAYER: LayerProps = {
  id: FEATURE_POINT_LAYER_ID,
  type: "circle",
  filter: ["all", ["==", ["geometry-type"], "Point"], ["!=", ["get", "isSelected"], true]],
  paint: {
    "circle-radius": 6,
    "circle-color": "#0284c7",
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 2,
  },
};

const SELECTED_FILL_LAYER: LayerProps = {
  id: SELECTED_FILL_LAYER_ID,
  type: "fill",
  filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "isSelected"], true]],
  paint: {
    "fill-color": "#f97316",
    "fill-opacity": 0.18,
  },
};

const SELECTED_LINE_LAYER: LayerProps = {
  id: SELECTED_LINE_LAYER_ID,
  type: "line",
  filter: ["all", ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]], ["==", ["get", "isSelected"], true]],
  paint: {
    "line-color": "#f97316",
    "line-width": 4,
  },
};

const SELECTED_POINT_LAYER: LayerProps = {
  id: SELECTED_POINT_LAYER_ID,
  type: "circle",
  filter: ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "isSelected"], true]],
  paint: {
    "circle-radius": 7,
    "circle-color": "#f97316",
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 2,
  },
};

const DRAFT_FILL_LAYER: LayerProps = {
  id: DRAFT_FILL_LAYER_ID,
  type: "fill",
  filter: ["==", ["geometry-type"], "Polygon"],
  paint: {
    "fill-color": "#f59e0b",
    "fill-opacity": 0.14,
  },
};

const DRAFT_LINE_LAYER: LayerProps = {
  id: DRAFT_LINE_LAYER_ID,
  type: "line",
  filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
  paint: {
    "line-color": "#f59e0b",
    "line-width": 3,
    "line-dasharray": [1.5, 1.5],
  },
};

const DRAFT_POINT_LAYER: LayerProps = {
  id: DRAFT_POINT_LAYER_ID,
  type: "circle",
  filter: ["==", ["geometry-type"], "Point"],
  paint: {
    "circle-radius": 5,
    "circle-color": "#f59e0b",
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 2,
  },
};

export function DatasetEditorPage() {
  const { datasetId = "" } = useParams();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [mode, setMode] = useState<EditorMode>("select");
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [draftCoordinates, setDraftCoordinates] = useState<LngLat[]>([]);
  const [hoverCoordinate, setHoverCoordinate] = useState<LngLat | null>(null);
  const [features, setFeatures] = useState<DatasetFeatureCollection>(createEmptyFeatureCollection());
  const [isDraggingVertex, setIsDraggingVertex] = useState(false);
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
      setFeatures(nextDataset.features);
      setSelectedFeatureId(null);
      setDraftCoordinates([]);
      setHoverCoordinate(null);
      setViewport({
        center: nextDataset.center ?? [FALLBACK_CENTER.lng, FALLBACK_CENTER.lat],
        zoomLevel: nextDataset.zoomLevel ?? FALLBACK_ZOOM,
      });
    }
  }

  async function handleSaveDataset() {
    if (!dataset) {
      return;
    }

    const nextDataset = await saveDatasetState(
      dataset.id,
      viewport.center,
      viewport.zoomLevel,
      features,
    );
    setDataset(nextDataset);
  }

  function handleResetDataset() {
    if (!dataset) {
      return;
    }

    setFeatures(dataset.features);
    setSelectedFeatureId(null);
    setDraftCoordinates([]);
    setHoverCoordinate(null);
    setMode("select");
    setViewport({
      center: dataset.center ?? [FALLBACK_CENTER.lng, FALLBACK_CENTER.lat],
      zoomLevel: dataset.zoomLevel ?? FALLBACK_ZOOM,
    });
  }

  function handleModeChange(nextMode: EditorMode) {
    setMode(nextMode);
    setSelectedFeatureId(null);
    setDraftCoordinates([]);
    setHoverCoordinate(null);
  }

  function handleMapClick(event: MapLayerMouseEvent) {
    const coordinate: LngLat = [event.lngLat.lng, event.lngLat.lat];

    if (mode === "select") {
      const clickedFeatureId = getClickedFeatureId(event);
      setSelectedFeatureId(clickedFeatureId);
      return;
    }

    if (mode === "draw-point") {
      const nextFeature = createPointFeature(coordinate);
      setFeatures((current) => appendFeature(current, nextFeature));
      setSelectedFeatureId(String(nextFeature.id));
      setHoverCoordinate(null);
      setMode("select");
      return;
    }

    if (event.originalEvent.detail > 1) {
      return;
    }

    setDraftCoordinates((current) => [...current, coordinate]);
  }

  function handleMapDoubleClick() {
    if (mode === "draw-line" || mode === "draw-polygon") {
      finalizeDraft();
    }
  }

  function finalizeDraft() {
    if (mode === "draw-line") {
      if (draftCoordinates.length < 2) {
        return;
      }

      const nextFeature = createLineFeature(draftCoordinates);
      setFeatures((current) => appendFeature(current, nextFeature));
      setSelectedFeatureId(String(nextFeature.id));
      setDraftCoordinates([]);
      setHoverCoordinate(null);
      setMode("select");
      return;
    }

    if (mode === "draw-polygon") {
      if (draftCoordinates.length < 3) {
        return;
      }

      const nextFeature = createPolygonFeature(draftCoordinates);
      setFeatures((current) => appendFeature(current, nextFeature));
      setSelectedFeatureId(String(nextFeature.id));
      setDraftCoordinates([]);
      setHoverCoordinate(null);
      setMode("select");
    }
  }

  function cancelDraft() {
    setDraftCoordinates([]);
    setHoverCoordinate(null);
  }

  function handleDeleteSelectedFeature() {
    if (!selectedFeatureId) {
      return;
    }

    setFeatures((current) => ({
      ...current,
      features: current.features.filter((feature) => String(feature.id) !== selectedFeatureId),
    }));
    setSelectedFeatureId(null);
  }

  function handleVertexDrag(featureId: string, vertexIndex: number, coordinate: LngLat) {
    setFeatures((current) => updateFeatureVertex(current, featureId, vertexIndex, coordinate));
  }

  const selectedFeature = selectedFeatureId
    ? features.features.find((feature) => String(feature.id) === selectedFeatureId) ?? null
    : null;
  const selectedVertices = selectedFeature ? getFeatureVertices(selectedFeature) : [];
  const isDirty =
    !dataset ||
    JSON.stringify(dataset.features) !== JSON.stringify(features) ||
    JSON.stringify(dataset.center) !== JSON.stringify(viewport.center) ||
    dataset.zoomLevel !== viewport.zoomLevel;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "Escape") {
        if (draftCoordinates.length > 0) {
          event.preventDefault();
          cancelDraft();
          return;
        }

        setSelectedFeatureId(null);
        return;
      }

      if (event.key === "Enter" && (mode === "draw-line" || mode === "draw-polygon")) {
        event.preventDefault();
        finalizeDraft();
        return;
      }

      if (event.key === "Backspace" && (mode === "draw-line" || mode === "draw-polygon")) {
        if (draftCoordinates.length > 0) {
          event.preventDefault();
          setDraftCoordinates((current) => current.slice(0, -1));
        }
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedFeatureId) {
        event.preventDefault();
        handleDeleteSelectedFeature();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [draftCoordinates.length, mode, selectedFeatureId]);

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

        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1"
            onClick={() => void handleSaveDataset()}
            variant="primary"
          >
            Save
          </Button>
          <Button className="flex-1" onClick={handleResetDataset} variant="secondary">
            Reset
          </Button>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-slate-700">Mode</p>
          <div className="grid grid-cols-4 gap-2">
            <ModeButton
              active={mode === "select"}
              icon={IconPointer}
              label="Select"
              onClick={() => handleModeChange("select")}
            />
            <ModeButton
              active={mode === "draw-point"}
              icon={IconPoint}
              label="Point"
              onClick={() => handleModeChange("draw-point")}
            />
            <ModeButton
              active={mode === "draw-line"}
              icon={IconVectorSpline}
              label="LineString"
              onClick={() => handleModeChange("draw-line")}
            />
            <ModeButton
              active={mode === "draw-polygon"}
              icon={IconVectorTriangle}
              label="Polygon"
              onClick={() => handleModeChange("draw-polygon")}
            />
          </div>
        </div>

        <div className="mt-6 space-y-3 rounded-3xl border border-sky-100 bg-slate-50/80 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-slate-700">Features</span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              {features.features.length}
            </span>
          </div>
          <p className="text-slate-500">{getModeDescription(mode, draftCoordinates.length)}</p>
          {selectedFeature ? (
            <div className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Selected
              </p>
              <p className="mt-2 font-medium text-slate-900">{selectedFeature.geometry.type}</p>
              <p className="mt-1">Vertices: {selectedVertices.length}</p>
              <Button
                className="mt-3 w-full"
                onClick={handleDeleteSelectedFeature}
                variant="ghost"
              >
                Delete Feature
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/70 px-4 py-3 text-slate-500">
              {mode === "select"
                ? "Click a feature to inspect and adjust its vertices."
                : "Click on the map to place vertices. Press Enter or double-click to finish."}
            </div>
          )}
          {draftCoordinates.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              Draft vertices: {draftCoordinates.length}
            </div>
          ) : null}
          <div className="text-xs text-slate-400">
            {isDirty ? "Unsaved changes" : "All changes saved"}
          </div>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <MapCanvas
          draftCoordinates={draftCoordinates}
          features={features}
          hoverCoordinate={hoverCoordinate}
          isDraggingVertex={isDraggingVertex}
          mode={mode}
          onFeatureClick={setSelectedFeatureId}
          onMapClick={handleMapClick}
          onMapDoubleClick={handleMapDoubleClick}
          onMapHover={setHoverCoordinate}
          onVertexDrag={handleVertexDrag}
          selectedFeatureId={selectedFeatureId}
          selectedVertices={selectedVertices}
          setIsDraggingVertex={setIsDraggingVertex}
          viewport={viewport}
          onViewportChange={setViewport}
        />
      </section>
    </main>
  );
}

function MapCanvas({
  draftCoordinates,
  features,
  hoverCoordinate,
  isDraggingVertex,
  mode,
  onFeatureClick,
  onMapClick,
  onMapDoubleClick,
  onMapHover,
  onVertexDrag,
  selectedFeatureId,
  selectedVertices,
  setIsDraggingVertex,
  viewport,
  onViewportChange,
}: {
  draftCoordinates: LngLat[];
  features: DatasetFeatureCollection;
  hoverCoordinate: LngLat | null;
  isDraggingVertex: boolean;
  mode: EditorMode;
  onFeatureClick: (featureId: string | null) => void;
  onMapClick: (event: MapLayerMouseEvent) => void;
  onMapDoubleClick: () => void;
  onMapHover: (coordinate: LngLat | null) => void;
  onVertexDrag: (featureId: string, vertexIndex: number, coordinate: LngLat) => void;
  selectedFeatureId: string | null;
  selectedVertices: LngLat[];
  setIsDraggingVertex: (value: boolean) => void;
  viewport: { center: LngLat; zoomLevel: number };
  onViewportChange: (viewport: { center: LngLat; zoomLevel: number }) => void;
}) {
  const mapLibreStyleUrl =
    import.meta.env.VITE_MAPLIBRE_STYLE_URL || "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
  const center = viewport.center;
  const zoom = viewport.zoomLevel;
  const renderedFeatures = buildRenderableFeatures(features, selectedFeatureId);
  const draftFeatures = buildDraftFeatures(mode, draftCoordinates, hoverCoordinate);

  return (
    <div className="h-full min-h-screen">
      <Map
        latitude={center[1]}
        mapLib={maplibregl}
        mapStyle={mapLibreStyleUrl}
        longitude={center[0]}
        cursor={getMapCursor(mode, isDraggingVertex)}
        doubleClickZoom={mode === "select"}
        dragPan={!isDraggingVertex}
        interactiveLayerIds={INTERACTIVE_LAYER_IDS}
        onClick={(event) => {
          onMapClick(event);
          if (mode === "select" && !getClickedFeatureId(event)) {
            onFeatureClick(null);
          }
        }}
        onDblClick={(event) => {
          event.originalEvent.preventDefault();
          onMapDoubleClick();
        }}
        onMouseMove={(event) => {
          if (mode !== "draw-line" && mode !== "draw-polygon") {
            return;
          }

          onMapHover([event.lngLat.lng, event.lngLat.lat]);
        }}
        onMouseLeave={() => onMapHover(null)}
        onMove={(event: ViewStateChangeEvent) => {
          onViewportChange({
            center: [event.viewState.longitude, event.viewState.latitude],
            zoomLevel: event.viewState.zoom,
          });
        }}
        style={{ width: "100%", height: "100%" }}
        zoom={zoom}
      >
        <Source data={renderedFeatures} id={FEATURE_SOURCE_ID} type="geojson">
          <Layer {...FEATURE_FILL_LAYER} />
          <Layer {...FEATURE_LINE_LAYER} />
          <Layer {...FEATURE_POINT_LAYER} />
          <Layer {...SELECTED_FILL_LAYER} />
          <Layer {...SELECTED_LINE_LAYER} />
          <Layer {...SELECTED_POINT_LAYER} />
        </Source>
        <Source data={draftFeatures} id={DRAFT_SOURCE_ID} type="geojson">
          <Layer {...DRAFT_FILL_LAYER} />
          <Layer {...DRAFT_LINE_LAYER} />
          <Layer {...DRAFT_POINT_LAYER} />
        </Source>
        {mode === "select" && selectedFeatureId
          ? selectedVertices.map((vertex, index) => (
              <Marker
                draggable
                key={`${selectedFeatureId}-${index}`}
                latitude={vertex[1]}
                longitude={vertex[0]}
                onDragStart={() => setIsDraggingVertex(true)}
                onDrag={(event) => {
                  onVertexDrag(selectedFeatureId, index, [event.lngLat.lng, event.lngLat.lat]);
                }}
                onDragEnd={(event) => {
                  setIsDraggingVertex(false);
                  onVertexDrag(selectedFeatureId, index, [event.lngLat.lng, event.lngLat.lat]);
                }}
              >
                <div className="h-4 w-4 rounded-full border-2 border-white bg-orange-500 shadow-lg" />
              </Marker>
            ))
          : null}
        <NavigationControl position="top-right" />
      </Map>
    </div>
  );
}

function ModeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof IconPointer;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className="h-12 w-full rounded-2xl px-0"
      onClick={onClick}
      title={label}
      variant={active ? "primary" : "secondary"}
    >
      <Icon size={20} stroke={1.9} />
    </Button>
  );
}

function createFeatureId() {
  return crypto.randomUUID();
}

function createPointFeature(coordinate: LngLat): Feature<Point> {
  return {
    type: "Feature",
    id: createFeatureId(),
    properties: {},
    geometry: {
      type: "Point",
      coordinates: coordinate,
    },
  };
}

function createLineFeature(coordinates: LngLat[]): Feature<LineString> {
  return {
    type: "Feature",
    id: createFeatureId(),
    properties: {},
    geometry: {
      type: "LineString",
      coordinates,
    },
  };
}

function createPolygonFeature(coordinates: LngLat[]): Feature<Polygon> {
  return {
    type: "Feature",
    id: createFeatureId(),
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[...coordinates, coordinates[0]]],
    },
  };
}

function appendFeature(
  collection: DatasetFeatureCollection,
  feature: Feature<DatasetGeometry>,
): DatasetFeatureCollection {
  return {
    ...collection,
    features: [...collection.features, feature],
  };
}

function buildRenderableFeatures(
  collection: DatasetFeatureCollection,
  selectedFeatureId: string | null,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        featureId: String(feature.id),
        isSelected: String(feature.id) === selectedFeatureId,
      },
    })),
  };
}

function buildDraftFeatures(
  mode: EditorMode,
  coordinates: LngLat[],
  hoverCoordinate: LngLat | null,
): FeatureCollection {
  if (mode === "draw-point") {
    return {
      type: "FeatureCollection",
      features: [],
    };
  }

  const draftFeatures: Feature[] = coordinates.map((coordinate, index) => ({
    type: "Feature",
    id: `draft-point-${index}`,
    properties: {},
    geometry: {
      type: "Point",
      coordinates: coordinate,
    },
  }));

  if (mode === "draw-line" && coordinates.length >= 1) {
    draftFeatures.push({
      type: "Feature",
      id: "draft-line",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: hoverCoordinate ? [...coordinates, hoverCoordinate] : coordinates,
      },
    });
  }

  if (mode === "draw-polygon" && coordinates.length >= 2) {
    const previewCoordinates = hoverCoordinate ? [...coordinates, hoverCoordinate] : coordinates;
    draftFeatures.push({
      type: "Feature",
      id: "draft-polygon",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[...previewCoordinates, previewCoordinates[0]]],
      },
    });
  }

  return {
    type: "FeatureCollection",
    features: draftFeatures,
  };
}

function getClickedFeatureId(event: MapLayerMouseEvent) {
  const clickedFeature = event.features?.find(
    (feature) => feature.properties && "featureId" in feature.properties,
  );

  if (!clickedFeature?.properties) {
    return null;
  }

  return String(clickedFeature.properties.featureId);
}

function getFeatureVertices(feature: Feature<DatasetGeometry>): LngLat[] {
  if (feature.geometry.type === "Point") {
    return [feature.geometry.coordinates as LngLat];
  }

  if (feature.geometry.type === "LineString") {
    return feature.geometry.coordinates as LngLat[];
  }

  return (feature.geometry.coordinates[0]?.slice(0, -1) ?? []) as LngLat[];
}

function updateFeatureVertex(
  collection: DatasetFeatureCollection,
  featureId: string,
  vertexIndex: number,
  coordinate: LngLat,
): DatasetFeatureCollection {
  return {
    ...collection,
    features: collection.features.map((feature) => {
      if (String(feature.id) !== featureId) {
        return feature;
      }

      if (feature.geometry.type === "Point") {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: coordinate,
          },
        };
      }

      if (feature.geometry.type === "LineString") {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: feature.geometry.coordinates.map((current, index) =>
              index === vertexIndex ? coordinate : current,
            ) as Position[],
          },
        };
      }

      const ring = [...feature.geometry.coordinates[0]];
      ring[vertexIndex] = coordinate;
      ring[ring.length - 1] = ring[0];

      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: [ring],
        },
      };
    }),
  };
}

function getModeDescription(mode: EditorMode, draftCount: number) {
  if (mode === "select") {
    return "Select features, drag vertices, and delete with Backspace or Delete.";
  }

  if (mode === "draw-point") {
    return "Click once to place a point.";
  }

  if (mode === "draw-line") {
    return draftCount > 0
      ? "Continue clicking to add vertices. Press Enter or double-click to finish."
      : "Click to start a line.";
  }

  return draftCount > 0
    ? "Continue clicking to shape the polygon. Press Enter or double-click to finish."
    : "Click to start a polygon.";
}

function getMapCursor(mode: EditorMode, isDraggingVertex: boolean) {
  if (isDraggingVertex) {
    return "grabbing";
  }

  return mode === "select" ? "grab" : "crosshair";
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}
