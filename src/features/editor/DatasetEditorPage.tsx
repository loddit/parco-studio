import {
  IconPoint,
  IconPointer,
  IconVectorSpline,
  IconVectorTriangle,
} from "@tabler/icons-react";
import turfLength from "@turf/length";
import type {
  Feature,
  FeatureCollection,
  GeoJSON,
  Geometry,
  GeometryCollection,
  LineString,
  Point,
  Polygon,
  Position,
} from "geojson";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
  type MapRef,
  type MarkerEvent,
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
const FEATURE_LINE_HIT_LAYER_ID = "dataset-line-hit";
const FEATURE_POINT_LAYER_ID = "dataset-point";
const SELECTED_FILL_LAYER_ID = "selected-fill";
const SELECTED_LINE_LAYER_ID = "selected-line";
const SELECTED_LINE_HIT_LAYER_ID = "selected-line-hit";
const SELECTED_POINT_LAYER_ID = "selected-point";
const DRAFT_FILL_LAYER_ID = "draft-fill";
const DRAFT_LINE_LAYER_ID = "draft-line";
const DRAFT_POINT_LAYER_ID = "draft-point";
const INTERACTIVE_LAYER_IDS = [
  FEATURE_LINE_HIT_LAYER_ID,
  FEATURE_FILL_LAYER_ID,
  FEATURE_LINE_LAYER_ID,
  FEATURE_POINT_LAYER_ID,
  SELECTED_FILL_LAYER_ID,
  SELECTED_LINE_HIT_LAYER_ID,
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

const FEATURE_LINE_HIT_LAYER: LayerProps = {
  id: FEATURE_LINE_HIT_LAYER_ID,
  type: "line",
  filter: ["all", ["==", ["geometry-type"], "LineString"], ["!=", ["get", "isSelected"], true]],
  paint: {
    "line-color": "#000000",
    "line-opacity": 0.01,
    "line-width": 14,
  },
};

const FEATURE_LINE_LAYER: LayerProps = {
  id: FEATURE_LINE_LAYER_ID,
  type: "line",
  filter: ["all", ["==", ["geometry-type"], "LineString"], ["!=", ["get", "isSelected"], true]],
  paint: {
    "line-color": "#0284c7",
    "line-width": 2,
  },
};

const FEATURE_POINT_LAYER: LayerProps = {
  id: FEATURE_POINT_LAYER_ID,
  type: "circle",
  filter: ["all", ["==", ["geometry-type"], "Point"], ["!=", ["get", "isSelected"], true]],
  paint: {
    "circle-radius": 3,
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

const SELECTED_LINE_HIT_LAYER: LayerProps = {
  id: SELECTED_LINE_HIT_LAYER_ID,
  type: "line",
  filter: ["all", ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]], ["==", ["get", "isSelected"], true]],
  paint: {
    "line-color": "#000000",
    "line-opacity": 0.01,
    "line-width": 16,
  },
};

const SELECTED_LINE_LAYER: LayerProps = {
  id: SELECTED_LINE_LAYER_ID,
  type: "line",
  filter: ["all", ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]], ["==", ["get", "isSelected"], true]],
  paint: {
    "line-color": "#f97316",
    "line-width": 3,
  },
};

const SELECTED_POINT_LAYER: LayerProps = {
  id: SELECTED_POINT_LAYER_ID,
  type: "circle",
  filter: ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "isSelected"], true]],
  paint: {
    "circle-radius": 3.5,
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
    "line-width": 2,
    "line-dasharray": [1.5, 1.5],
  },
};

const DRAFT_POINT_LAYER: LayerProps = {
  id: DRAFT_POINT_LAYER_ID,
  type: "circle",
  filter: ["==", ["geometry-type"], "Point"],
  paint: {
    "circle-radius": 2.5,
    "circle-color": "#f59e0b",
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 2,
  },
};

const HISTORY_LIMIT = 100;

export function DatasetEditorPage() {
  const { datasetId = "" } = useParams();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const undoStackRef = useRef<DatasetFeatureCollection[]>([]);
  const redoStackRef = useRef<DatasetFeatureCollection[]>([]);
  const dragStartFeaturesRef = useRef<DatasetFeatureCollection | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [mode, setMode] = useState<EditorMode>("select");
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [draftCoordinates, setDraftCoordinates] = useState<LngLat[]>([]);
  const [hoverCoordinate, setHoverCoordinate] = useState<LngLat | null>(null);
  const [isHoveringSelectableFeature, setIsHoveringSelectableFeature] = useState(false);
  const [features, setFeatures] = useState<DatasetFeatureCollection>(createEmptyFeatureCollection());
  const [isDraggingVertex, setIsDraggingVertex] = useState(false);
  const [pendingFitBounds, setPendingFitBounds] = useState<[LngLat, LngLat] | null>(null);
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
      undoStackRef.current = [];
      redoStackRef.current = [];
      dragStartFeaturesRef.current = null;
      setSelectedFeatureId(null);
      setSelectedVertexIndex(null);
      setDraftCoordinates([]);
      setHoverCoordinate(null);
      setIsHoveringSelectableFeature(false);
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
    undoStackRef.current = [];
    redoStackRef.current = [];
    dragStartFeaturesRef.current = null;
    setSelectedFeatureId(null);
    setSelectedVertexIndex(null);
    setDraftCoordinates([]);
    setHoverCoordinate(null);
    setIsHoveringSelectableFeature(false);
    setMode("select");
    setViewport({
      center: dataset.center ?? [FALLBACK_CENTER.lng, FALLBACK_CENTER.lat],
      zoomLevel: dataset.zoomLevel ?? FALLBACK_ZOOM,
    });
  }

  function handleModeChange(nextMode: EditorMode) {
    setMode(nextMode);
    setSelectedFeatureId(null);
    setSelectedVertexIndex(null);
    setDraftCoordinates([]);
    setHoverCoordinate(null);
    setIsHoveringSelectableFeature(false);
  }

  function commitFeatureChange(nextFeatures: DatasetFeatureCollection) {
    if (JSON.stringify(nextFeatures) === JSON.stringify(features)) {
      return;
    }

    undoStackRef.current = [...undoStackRef.current, cloneFeatureCollection(features)].slice(
      -HISTORY_LIMIT,
    );
    redoStackRef.current = [];
    setFeatures(nextFeatures);
  }

  function applyHistorySnapshot(nextFeatures: DatasetFeatureCollection) {
    setFeatures(nextFeatures);
    setSelectedFeatureId(null);
    setSelectedVertexIndex(null);
    setDraftCoordinates([]);
    setHoverCoordinate(null);
    setMode("select");
  }

  function handleUndo() {
    const previous = undoStackRef.current.at(-1);

    if (!previous) {
      return;
    }

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, cloneFeatureCollection(features)].slice(
      -HISTORY_LIMIT,
    );
    applyHistorySnapshot(cloneFeatureCollection(previous));
  }

  function handleRedo() {
    const next = redoStackRef.current.at(-1);

    if (!next) {
      return;
    }

    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, cloneFeatureCollection(features)].slice(
      -HISTORY_LIMIT,
    );
    applyHistorySnapshot(cloneFeatureCollection(next));
  }

  function handleMapClick(event: MapLayerMouseEvent) {
    const coordinate: LngLat = [event.lngLat.lng, event.lngLat.lat];

    if (mode === "select") {
      const clickedFeatureId = getClickedFeatureId(event);
      setSelectedFeatureId(clickedFeatureId);
      setSelectedVertexIndex(null);
      return;
    }

    if (mode === "draw-point") {
      const nextFeature = createPointFeature(coordinate);
      commitFeatureChange(appendFeature(features, nextFeature));
      setSelectedFeatureId(String(nextFeature.id));
      setSelectedVertexIndex(null);
      setHoverCoordinate(null);
      setMode("select");
      return;
    }

    if (event.originalEvent.detail > 1) {
      return;
    }

    setDraftCoordinates((current) => [...current, coordinate]);
  }

  function finalizeDraft() {
    if (mode === "draw-line") {
      if (draftCoordinates.length < 2) {
        return;
      }

      const nextFeature = createLineFeature(draftCoordinates);
      commitFeatureChange(appendFeature(features, nextFeature));
      setSelectedFeatureId(String(nextFeature.id));
      setSelectedVertexIndex(null);
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
      commitFeatureChange(appendFeature(features, nextFeature));
      setSelectedFeatureId(String(nextFeature.id));
      setSelectedVertexIndex(null);
      setDraftCoordinates([]);
      setHoverCoordinate(null);
      setMode("select");
    }
  }

  function handleCloseDraftLineLoop() {
    if (mode !== "draw-line" || draftCoordinates.length < 2) {
      return;
    }

    const closedCoordinates = [...draftCoordinates, draftCoordinates[0]];
    const nextFeature = createLineFeature(closedCoordinates);
    commitFeatureChange(appendFeature(features, nextFeature));
    setSelectedFeatureId(String(nextFeature.id));
    setSelectedVertexIndex(null);
    setDraftCoordinates([]);
    setHoverCoordinate(null);
    setMode("select");
  }

  function cancelDraft() {
    setDraftCoordinates([]);
    setHoverCoordinate(null);
  }

  function handleDeleteSelectedFeature() {
    if (!selectedFeatureId) {
      return;
    }

    commitFeatureChange({
      ...features,
      features: features.features.filter((feature) => String(feature.id) !== selectedFeatureId),
    });
    setSelectedFeatureId(null);
    setSelectedVertexIndex(null);
  }

  function handleVertexDrag(featureId: string, vertexIndex: number, coordinate: LngLat) {
    setFeatures((current) => updateFeatureVertex(current, featureId, vertexIndex, coordinate));
  }

  function handleInsertVertex(featureId: string, segmentIndex: number) {
    commitFeatureChange(insertFeatureVertexAtMidpoint(features, featureId, segmentIndex));
    setSelectedFeatureId(featureId);
    setSelectedVertexIndex(segmentIndex + 1);
  }

  function handleSelectVertex(
    event: MarkerEvent<MouseEvent>,
    featureId: string,
    vertexIndex: number,
  ) {
    event.originalEvent.stopPropagation();
    setSelectedFeatureId(featureId);
    setSelectedVertexIndex(vertexIndex);
  }

  function handleDeleteSelectedVertex() {
    if (!selectedFeatureId || selectedVertexIndex === null) {
      return;
    }

    const nextFeatures = removeFeatureVertex(features, selectedFeatureId, selectedVertexIndex);
    const nextFeature =
      nextFeatures.features.find((feature) => String(feature.id) === selectedFeatureId) ?? null;

    commitFeatureChange(nextFeatures);

    if (!nextFeature || nextFeature.geometry.type === "Point") {
      setSelectedVertexIndex(null);
      return;
    }

    const nextVertexCount = getFeatureVertices(nextFeature).length;

    if (nextVertexCount === 0) {
      setSelectedVertexIndex(null);
      return;
    }

    setSelectedVertexIndex(Math.min(selectedVertexIndex, nextVertexCount - 1));
  }

  function handleVertexDragStart() {
    setIsDraggingVertex(true);
    dragStartFeaturesRef.current = cloneFeatureCollection(features);
  }

  function handleVertexDragEnd(featureId: string, vertexIndex: number, coordinate: LngLat) {
    setIsDraggingVertex(false);

    const nextFeatures = updateFeatureVertex(features, featureId, vertexIndex, coordinate);
    const startFeatures = dragStartFeaturesRef.current;

    if (
      startFeatures &&
      JSON.stringify(startFeatures) !== JSON.stringify(nextFeatures)
    ) {
      undoStackRef.current = [...undoStackRef.current, cloneFeatureCollection(startFeatures)].slice(
        -HISTORY_LIMIT,
      );
      redoStackRef.current = [];
    }

    setFeatures(nextFeatures);
    dragStartFeaturesRef.current = null;
  }

  async function handleImportGeoJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as GeoJSON;
    const importedFeatures = extractSupportedFeatures(parsed);

      if (importedFeatures.length === 0) {
        window.alert("No supported GeoJSON features found. Only Point, LineString, and Polygon are imported.");
        return;
      }

      commitFeatureChange({
        ...features,
        features: [...features.features, ...importedFeatures],
      });
      setSelectedFeatureId(null);
      setSelectedVertexIndex(null);
      setDraftCoordinates([]);
      setHoverCoordinate(null);
      setMode("select");
      setPendingFitBounds(getFeatureBounds(importedFeatures));
    } catch {
      window.alert("Failed to import GeoJSON. Check that the file contains valid JSON.");
    } finally {
      event.target.value = "";
    }
  }

  function handleExportSelectedFeature() {
    if (!selectedFeature) {
      return;
    }

    const blob = new Blob([JSON.stringify(selectedFeature, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${selectedFeature.geometry.type.toLowerCase()}-${String(selectedFeature.id)}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const selectedFeature = selectedFeatureId
    ? features.features.find((feature) => String(feature.id) === selectedFeatureId) ?? null
    : null;
  const selectedVertices = selectedFeature ? getFeatureVertices(selectedFeature) : [];
  const selectedMidpoints = selectedFeature ? getFeatureMidpoints(selectedFeature) : [];
  const selectedFeatureLength =
    selectedFeature?.geometry.type === "LineString"
      ? formatLineLength(turfLength(selectedFeature, { units: "kilometers" }))
      : null;
  const selectedVertexDistanceFromStart =
    selectedFeature?.geometry.type === "LineString" && selectedVertexIndex !== null
      ? formatLineLength(
          getLineDistanceToVertex(selectedFeature as Feature<LineString>, selectedVertexIndex),
        )
      : null;
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
        setSelectedVertexIndex(null);
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

      if ((event.key === "Delete" || event.key === "Backspace") && selectedVertexIndex !== null) {
        event.preventDefault();
        handleDeleteSelectedVertex();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();

        if (event.shiftKey) {
          handleRedo();
          return;
        }

        handleUndo();
        return;
      }

      if (event.key === "Delete" && selectedFeatureId) {
        event.preventDefault();
        handleDeleteSelectedFeature();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [draftCoordinates.length, mode, selectedFeatureId, selectedVertexIndex, features]);

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

        <input
          accept=".geojson,.json,application/geo+json,application/json"
          className="hidden"
          onChange={(event) => void handleImportGeoJson(event)}
          ref={importInputRef}
          type="file"
        />

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
          <Button
            className="flex-1"
            onClick={() => importInputRef.current?.click()}
            variant="secondary"
          >
            Import
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
              {selectedFeatureLength ? <p className="mt-1">Length: {selectedFeatureLength}</p> : null}
              {selectedFeature.geometry.type === "LineString" && selectedVertexIndex !== null ? (
                <>
                  <p className="mt-1 text-orange-600">Selected vertex: {selectedVertexIndex + 1}</p>
                  {selectedVertexDistanceFromStart ? (
                    <p className="mt-1 text-orange-600">
                      Distance from start: {selectedVertexDistanceFromStart}
                    </p>
                  ) : null}
                </>
              ) : null}
              <div className="mt-3 flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleExportSelectedFeature}
                  variant="secondary"
                >
                  Export
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleDeleteSelectedFeature}
                  variant="ghost"
                >
                  Delete
                </Button>
              </div>
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
          onFinalizeDraft={finalizeDraft}
          onMapClick={handleMapClick}
          onMapHover={setHoverCoordinate}
          onInsertVertex={handleInsertVertex}
          onCloseDraftLineLoop={handleCloseDraftLineLoop}
          onSelectVertex={handleSelectVertex}
          onVertexDragEnd={handleVertexDragEnd}
          onVertexDragStart={handleVertexDragStart}
          onVertexDrag={handleVertexDrag}
          selectedFeatureId={selectedFeatureId}
          isHoveringSelectableFeature={isHoveringSelectableFeature}
          pendingFitBounds={pendingFitBounds}
          selectedMidpoints={selectedMidpoints}
          selectedVertexIndex={selectedVertexIndex}
          selectedVertices={selectedVertices}
          setPendingFitBounds={setPendingFitBounds}
          setIsHoveringSelectableFeature={setIsHoveringSelectableFeature}
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
  onFinalizeDraft,
  onMapClick,
  onMapHover,
  onInsertVertex,
  onCloseDraftLineLoop,
  onSelectVertex,
  onVertexDragEnd,
  onVertexDragStart,
  onVertexDrag,
  isHoveringSelectableFeature,
  pendingFitBounds,
  selectedFeatureId,
  selectedMidpoints,
  selectedVertexIndex,
  selectedVertices,
  setPendingFitBounds,
  setIsHoveringSelectableFeature,
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
  onFinalizeDraft: () => void;
  onMapClick: (event: MapLayerMouseEvent) => void;
  onMapHover: (coordinate: LngLat | null) => void;
  onInsertVertex: (featureId: string, segmentIndex: number) => void;
  onCloseDraftLineLoop: () => void;
  onSelectVertex: (event: MarkerEvent<MouseEvent>, featureId: string, vertexIndex: number) => void;
  onVertexDragEnd: (featureId: string, vertexIndex: number, coordinate: LngLat) => void;
  onVertexDragStart: () => void;
  onVertexDrag: (featureId: string, vertexIndex: number, coordinate: LngLat) => void;
  isHoveringSelectableFeature: boolean;
  pendingFitBounds: [LngLat, LngLat] | null;
  selectedFeatureId: string | null;
  selectedMidpoints: Array<{ coordinate: LngLat; segmentIndex: number }>;
  selectedVertexIndex: number | null;
  selectedVertices: LngLat[];
  setPendingFitBounds: (bounds: [LngLat, LngLat] | null) => void;
  setIsHoveringSelectableFeature: (value: boolean) => void;
  setIsDraggingVertex: (value: boolean) => void;
  viewport: { center: LngLat; zoomLevel: number };
  onViewportChange: (viewport: { center: LngLat; zoomLevel: number }) => void;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const mapLibreStyleUrl =
    import.meta.env.VITE_MAPLIBRE_STYLE_URL || "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
  const center = viewport.center;
  const zoom = viewport.zoomLevel;
  const renderedFeatures = buildRenderableFeatures(features, selectedFeatureId);
  const draftFeatures = buildDraftFeatures(mode, draftCoordinates, hoverCoordinate);

  useEffect(() => {
    if (!pendingFitBounds || !mapRef.current) {
      return;
    }

    mapRef.current.fitBounds(pendingFitBounds, {
      padding: 64,
      duration: 800,
    });
    setPendingFitBounds(null);
  }, [pendingFitBounds, setPendingFitBounds]);

  return (
    <div className="h-full min-h-screen">
      <Map
        ref={mapRef}
        latitude={center[1]}
        mapLib={maplibregl}
        mapStyle={mapLibreStyleUrl}
        longitude={center[0]}
        cursor={getMapCursor(mode, isDraggingVertex, isHoveringSelectableFeature)}
        doubleClickZoom
        dragPan={!isDraggingVertex}
        interactiveLayerIds={INTERACTIVE_LAYER_IDS}
        onClick={(event) => {
          onMapClick(event);
          if (mode === "select" && !getClickedFeatureId(event)) {
            onFeatureClick(null);
          }
        }}
        onDblClick={(event) => {
          const clickedFeatureId = getClickedFeatureId(event);

          if (mode === "draw-line" || mode === "draw-polygon") {
            event.preventDefault();
            event.originalEvent.preventDefault();
            onFinalizeDraft();
            return;
          }

          if (clickedFeatureId) {
            event.preventDefault();
            event.originalEvent.preventDefault();
          }
        }}
        onMouseMove={(event) => {
          if (mode === "select") {
            setIsHoveringSelectableFeature(Boolean(getClickedFeatureId(event)));
            return;
          }

          if (mode !== "draw-line" && mode !== "draw-polygon") {
            return;
          }

          onMapHover([event.lngLat.lng, event.lngLat.lat]);
        }}
        onMouseLeave={() => {
          onMapHover(null);
          setIsHoveringSelectableFeature(false);
        }}
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
          <Layer {...FEATURE_LINE_HIT_LAYER} />
          <Layer {...FEATURE_FILL_LAYER} />
          <Layer {...FEATURE_LINE_LAYER} />
          <Layer {...FEATURE_POINT_LAYER} />
          <Layer {...SELECTED_FILL_LAYER} />
          <Layer {...SELECTED_LINE_HIT_LAYER} />
          <Layer {...SELECTED_LINE_LAYER} />
          <Layer {...SELECTED_POINT_LAYER} />
        </Source>
        <Source data={draftFeatures} id={DRAFT_SOURCE_ID} type="geojson">
          <Layer {...DRAFT_FILL_LAYER} />
          <Layer {...DRAFT_LINE_LAYER} />
          <Layer {...DRAFT_POINT_LAYER} />
        </Source>
        {mode === "draw-line" && draftCoordinates.length >= 2 ? (
          <Marker
            latitude={draftCoordinates[0][1]}
            longitude={draftCoordinates[0][0]}
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              onCloseDraftLineLoop();
            }}
          >
            <div className="h-3 w-3 rounded-full border border-amber-500 bg-amber-200 shadow-sm" />
          </Marker>
        ) : null}
        {mode === "select" && selectedFeatureId
          ? (
              <>
                {selectedMidpoints.map((midpoint) => (
                  <Marker
                    key={`${selectedFeatureId}-midpoint-${midpoint.segmentIndex}`}
                    latitude={midpoint.coordinate[1]}
                    longitude={midpoint.coordinate[0]}
                    onClick={() => onInsertVertex(selectedFeatureId, midpoint.segmentIndex)}
                  >
                    <div
                      className="h-[7px] w-[7px] rounded-full border border-orange-400 bg-orange-400/45 shadow-sm backdrop-blur-[1px]"
                      onDoubleClick={(event) => event.stopPropagation()}
                    />
                  </Marker>
                ))}
                {selectedVertices.map((vertex, index) => (
                  <Marker
                    draggable
                    key={`${selectedFeatureId}-${index}`}
                    latitude={vertex[1]}
                    longitude={vertex[0]}
                    onClick={(event) => onSelectVertex(event, selectedFeatureId, index)}
                    onDragStart={onVertexDragStart}
                    onDrag={(event) => {
                      onVertexDrag(selectedFeatureId, index, [event.lngLat.lng, event.lngLat.lat]);
                    }}
                    onDragEnd={(event) => {
                      onVertexDragEnd(selectedFeatureId, index, [
                        event.lngLat.lng,
                        event.lngLat.lat,
                      ]);
                    }}
                  >
                    <div
                      className={
                        index === selectedVertexIndex
                          ? "h-3 w-3 rounded-full border border-white bg-orange-700 shadow-lg"
                          : "h-2 w-2 rounded-full border border-white bg-orange-500 shadow-lg"
                      }
                      onDoubleClick={(event) => event.stopPropagation()}
                    />
                  </Marker>
                ))}
              </>
            )
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
      className="h-10 w-full rounded-2xl px-0"
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

function getFeatureMidpoints(feature: Feature<DatasetGeometry>) {
  if (feature.geometry.type === "Point") {
    return [];
  }

  const vertices = getFeatureVertices(feature);

  if (feature.geometry.type === "LineString") {
    return vertices.slice(0, -1).map((coordinate, index) => ({
      coordinate: getMidpoint(coordinate, vertices[index + 1]),
      segmentIndex: index,
    }));
  }

  return vertices.map((coordinate, index) => ({
    coordinate: getMidpoint(coordinate, vertices[(index + 1) % vertices.length]),
    segmentIndex: index,
  }));
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

function insertFeatureVertexAtMidpoint(
  collection: DatasetFeatureCollection,
  featureId: string,
  segmentIndex: number,
): DatasetFeatureCollection {
  return {
    ...collection,
    features: collection.features.map((feature) => {
      if (String(feature.id) !== featureId || feature.geometry.type === "Point") {
        return feature;
      }

      if (feature.geometry.type === "LineString") {
        const coordinates = [...feature.geometry.coordinates];
        const nextCoordinate = getMidpoint(
          coordinates[segmentIndex] as LngLat,
          coordinates[segmentIndex + 1] as LngLat,
        );
        coordinates.splice(segmentIndex + 1, 0, nextCoordinate);

        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates,
          },
        };
      }

      const ring = [...feature.geometry.coordinates[0].slice(0, -1)];
      const nextCoordinate = getMidpoint(
        ring[segmentIndex] as LngLat,
        ring[(segmentIndex + 1) % ring.length] as LngLat,
      );
      ring.splice(segmentIndex + 1, 0, nextCoordinate);

      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: [[...ring, ring[0]]],
        },
      };
    }),
  };
}

function removeFeatureVertex(
  collection: DatasetFeatureCollection,
  featureId: string,
  vertexIndex: number,
): DatasetFeatureCollection {
  return {
    ...collection,
    features: collection.features.map((feature) => {
      if (String(feature.id) !== featureId || feature.geometry.type === "Point") {
        return feature;
      }

      if (feature.geometry.type === "LineString") {
        if (feature.geometry.coordinates.length <= 2) {
          return feature;
        }

        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: feature.geometry.coordinates.filter((_, index) => index !== vertexIndex),
          },
        };
      }

      const ring = feature.geometry.coordinates[0]?.slice(0, -1) ?? [];

      if (ring.length <= 3) {
        return feature;
      }

      const nextRing = ring.filter((_, index) => index !== vertexIndex);

      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: [[...nextRing, nextRing[0]]],
        },
      };
    }),
  };
}

function extractSupportedFeatures(geojson: GeoJSON): Array<Feature<DatasetGeometry>> {
  if (geojson.type === "FeatureCollection") {
    return geojson.features.flatMap((feature) => extractFeature(feature));
  }

  if (geojson.type === "Feature") {
    return extractFeature(geojson);
  }

  if (isSupportedGeometry(geojson)) {
    return [createImportedFeature(geojson)];
  }

  if (geojson.type === "GeometryCollection") {
    return extractGeometryCollection(geojson);
  }

  return [];
}

function extractFeature(feature: Feature): Array<Feature<DatasetGeometry>> {
  if (!feature.geometry) {
    return [];
  }

  if (isSupportedGeometry(feature.geometry)) {
    return [
      {
        ...feature,
        id: createFeatureId(),
        geometry: feature.geometry,
        properties: feature.properties ?? {},
      },
    ];
  }

  if (feature.geometry.type === "GeometryCollection") {
    return extractGeometryCollection(feature.geometry).map((geometryFeature) => ({
      ...geometryFeature,
      properties: feature.properties ?? {},
    }));
  }

  return [];
}

function extractGeometryCollection(geometry: GeometryCollection): Array<Feature<DatasetGeometry>> {
  return geometry.geometries
    .filter(isSupportedGeometry)
    .map((supportedGeometry) => createImportedFeature(supportedGeometry));
}

function isSupportedGeometry(geometry: Geometry): geometry is DatasetGeometry {
  return (
    geometry.type === "Point" ||
    geometry.type === "LineString" ||
    geometry.type === "Polygon"
  );
}

function createImportedFeature(geometry: DatasetGeometry): Feature<DatasetGeometry> {
  return {
    type: "Feature",
    id: createFeatureId(),
    properties: {},
    geometry,
  };
}

function cloneFeatureCollection(collection: DatasetFeatureCollection): DatasetFeatureCollection {
  return structuredClone(collection);
}

function getFeatureBounds(features: Array<Feature<DatasetGeometry>>): [LngLat, LngLat] | null {
  const coordinates = features.flatMap((feature) => getGeometryCoordinates(feature.geometry));

  if (coordinates.length === 0) {
    return null;
  }

  let minLng = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLng = coordinates[0][0];
  let maxLat = coordinates[0][1];

  for (const [lng, lat] of coordinates) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function getGeometryCoordinates(geometry: DatasetGeometry): LngLat[] {
  if (geometry.type === "Point") {
    return [geometry.coordinates as LngLat];
  }

  if (geometry.type === "LineString") {
    return geometry.coordinates as LngLat[];
  }

  return (geometry.coordinates[0] ?? []) as LngLat[];
}

function getMidpoint(start: LngLat, end: LngLat): LngLat {
  return [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
}

function formatLineLength(lengthInKilometers: number) {
  if (lengthInKilometers < 1) {
    return `${Math.round(lengthInKilometers * 1000)} m`;
  }

  return `${lengthInKilometers.toFixed(2)} km`;
}

function getLineDistanceToVertex(feature: Feature<LineString>, vertexIndex: number) {
  if (vertexIndex <= 0) {
    return 0;
  }

  return turfLength(
    {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: feature.geometry.coordinates.slice(0, vertexIndex + 1),
      },
    },
    { units: "kilometers" },
  );
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

function getMapCursor(
  mode: EditorMode,
  isDraggingVertex: boolean,
  isHoveringSelectableFeature: boolean,
) {
  if (isDraggingVertex) {
    return "grabbing";
  }

  if (mode === "select" && isHoveringSelectableFeature) {
    return "pointer";
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
