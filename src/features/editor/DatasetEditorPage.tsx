import type { ChangeEvent } from "react";
import type { Feature, GeoJSON, LineString } from "geojson";
import { lazy, Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getDataset, saveDatasetState } from "@/lib/datasets-db";
import {
  createEmptyFeatureCollection,
  type Dataset,
  type DatasetFeatureCollection,
  type DatasetGeometry,
  type LngLat,
} from "@/types/dataset";
import { EditorSidebar } from "./EditorSidebar";
import {
  appendFeature,
  cloneFeatureCollection,
  createLineFeature,
  createPointFeature,
  createPolygonFeature,
  extractSupportedFeatures,
  FALLBACK_CENTER,
  FALLBACK_ZOOM,
  formatLineLength,
  getFeatureBounds,
  getClickedFeatureId,
  getFeatureMidpoints,
  getFeatureVertices,
  getLineDistanceToVertex,
  HISTORY_LIMIT,
  insertFeatureVertexAtMidpoint,
  isTypingTarget,
  removeFeatureVertex,
  updateFeatureVertex,
} from "./editor-helpers";
import type { MapCanvasLayerMouseEvent, MapCanvasMarkerEvent } from "./MapCanvas";
import type { EditorMode } from "./editor-types";
import {
  DEFAULT_MAP_SOURCE,
  getInitialMapStyle,
  getMapSourceOptions,
  getMapSourceRequirement,
  getMapStyleOptions,
  resolveMapStyleUrl,
  type EditorMapSource,
  type EditorMapStyle,
} from "./map-config";

const MapCanvas = lazy(() =>
  import("./MapCanvas").then((module) => ({
    default: module.MapCanvas,
  })),
);

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
  const [mapSource, setMapSource] = useState<EditorMapSource>(DEFAULT_MAP_SOURCE);
  const [mapStyle, setMapStyle] = useState<EditorMapStyle>(getInitialMapStyle(DEFAULT_MAP_SOURCE));

  function resetSelectionState() {
    setSelectedFeatureId(null);
    setSelectedVertexIndex(null);
  }

  function resetDraftState() {
    setDraftCoordinates([]);
    setHoverCoordinate(null);
  }

  function resetTransientEditorState(nextMode: EditorMode = "select") {
    resetSelectionState();
    resetDraftState();
    setIsHoveringSelectableFeature(false);
    setMode(nextMode);
  }

  useEffect(() => {
    void loadDataset();
  }, [datasetId]);

  async function loadDataset() {
    const nextDataset = await getDataset(datasetId);
    setDataset(nextDataset ?? null);

    if (!nextDataset) {
      return;
    }

    setFeatures(nextDataset.features);
    undoStackRef.current = [];
    redoStackRef.current = [];
    dragStartFeaturesRef.current = null;
    resetTransientEditorState();
    setViewport({
      center: nextDataset.center ?? [FALLBACK_CENTER.lng, FALLBACK_CENTER.lat],
      zoomLevel: nextDataset.zoomLevel ?? FALLBACK_ZOOM,
    });
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
    resetTransientEditorState();
    setViewport({
      center: dataset.center ?? [FALLBACK_CENTER.lng, FALLBACK_CENTER.lat],
      zoomLevel: dataset.zoomLevel ?? FALLBACK_ZOOM,
    });
  }

  function handleModeChange(nextMode: EditorMode) {
    resetTransientEditorState(nextMode);
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
    resetTransientEditorState();
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

  function handleMapClick(event: MapCanvasLayerMouseEvent) {
    const coordinate: LngLat = [event.lngLat.lng, event.lngLat.lat];

    if (mode === "select") {
      setSelectedFeatureId(getClickedFeatureId(event));
      setSelectedVertexIndex(null);
      return;
    }

    if (mode === "draw-point") {
      const nextFeature = createPointFeature(coordinate);
      commitFeatureChange(appendFeature(features, nextFeature));
      setSelectedFeatureId(String(nextFeature.id));
      setSelectedVertexIndex(null);
      resetDraftState();
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
      resetDraftState();
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
      resetDraftState();
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
    resetDraftState();
    setMode("select");
  }

  function cancelDraft() {
    resetDraftState();
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
    event: MapCanvasMarkerEvent,
    featureId: string,
    vertexIndex: number,
  ) {
    event.originalEvent.stopPropagation();
    setSelectedFeatureId(featureId);
    setSelectedVertexIndex(vertexIndex);
  }

  function handleMapSourceChange(nextSource: EditorMapSource) {
    setMapSource(nextSource);
    setMapStyle(getInitialMapStyle(nextSource));
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
    setSelectedVertexIndex(nextVertexCount === 0 ? null : Math.min(selectedVertexIndex, nextVertexCount - 1));
  }

  function handleVertexDragStart() {
    setIsDraggingVertex(true);
    dragStartFeaturesRef.current = cloneFeatureCollection(features);
  }

  function handleVertexDragEnd(featureId: string, vertexIndex: number, coordinate: LngLat) {
    setIsDraggingVertex(false);

    const nextFeatures = updateFeatureVertex(features, featureId, vertexIndex, coordinate);
    const startFeatures = dragStartFeaturesRef.current;

    if (startFeatures && JSON.stringify(startFeatures) !== JSON.stringify(nextFeatures)) {
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
      const parsed = JSON.parse(await file.text()) as GeoJSON;
      const importedFeatures = extractSupportedFeatures(parsed);

      if (importedFeatures.length === 0) {
        window.alert(
          "No supported GeoJSON features found. Only Point, LineString, and Polygon are imported.",
        );
        return;
      }

      commitFeatureChange({
        ...features,
        features: [...features.features, ...importedFeatures],
      });
      resetTransientEditorState();
      setPendingFitBounds(getFeatureBounds(importedFeatures));
    } catch {
      window.alert("Failed to import GeoJSON. Check that the file contains valid JSON.");
    } finally {
      event.target.value = "";
    }
  }

  const selectedFeature = selectedFeatureId
    ? features.features.find((feature) => String(feature.id) === selectedFeatureId) ?? null
    : null;
  const selectedVertices = selectedFeature ? getFeatureVertices(selectedFeature) : [];
  const selectedMidpoints = selectedFeature ? getFeatureMidpoints(selectedFeature) : [];
  const selectedFeatureLength =
    selectedFeature?.geometry.type === "LineString"
      ? formatLineLength(
          getLineDistanceToVertex(
            selectedFeature as Feature<LineString>,
            selectedVertices.length - 1,
          ),
        )
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
  const mapSourceOptions = getMapSourceOptions();
  const mapStyleOptions = getMapStyleOptions(mapSource);
  const mapStyleUrl = resolveMapStyleUrl(mapSource, mapStyle);
  const selectedMapSourceRequirement = getMapSourceRequirement(mapSource);

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

  const onWindowKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) {
      return;
    }

    if (event.key === "Escape") {
      if (draftCoordinates.length > 0) {
        event.preventDefault();
        cancelDraft();
        return;
      }

      resetSelectionState();
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
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      onWindowKeyDown(event);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onWindowKeyDown]);

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
      <EditorSidebar
        datasetName={dataset.name}
        draftCount={draftCoordinates.length}
        featureCount={features.features.length}
        importInputRef={importInputRef}
        isDirty={isDirty}
        mapSource={mapSource}
        mapSourceOptions={mapSourceOptions}
        mode={mode}
        onDeleteSelectedFeature={handleDeleteSelectedFeature}
        onExportSelectedFeature={handleExportSelectedFeature}
        onImportFileChange={handleImportGeoJson}
        onMapSourceChange={handleMapSourceChange}
        onModeChange={handleModeChange}
        onOpenImport={() => importInputRef.current?.click()}
        onReset={handleResetDataset}
        onSave={() => void handleSaveDataset()}
        selectedMapSourceRequirement={selectedMapSourceRequirement}
        selectedFeature={selectedFeature}
        selectedFeatureLength={selectedFeatureLength}
        selectedVertexDistanceFromStart={selectedVertexDistanceFromStart}
        selectedVertexIndex={selectedVertexIndex}
        selectedVerticesCount={selectedVertices.length}
      />

      <section className="min-w-0 flex-1">
        <Suspense
          fallback={
            <div className="flex h-full min-h-screen items-center justify-center bg-slate-100">
              <div className="rounded-3xl border border-sky-100 bg-white px-6 py-4 text-sm font-medium text-slate-600 shadow-sm">
                Loading map canvas...
              </div>
            </div>
          }
        >
          <MapCanvas
            draftCoordinates={draftCoordinates}
            features={features}
            hoverCoordinate={hoverCoordinate}
            isDraggingVertex={isDraggingVertex}
            isHoveringSelectableFeature={isHoveringSelectableFeature}
            mapSource={mapSource}
            mapStyle={mapStyle}
            mapStyleUrl={mapStyleUrl}
            mapStyleOptions={mapStyleOptions}
            mode={mode}
            onCloseDraftLineLoop={handleCloseDraftLineLoop}
            onFeatureClick={setSelectedFeatureId}
            onFinalizeDraft={finalizeDraft}
            onMapClick={handleMapClick}
            onMapHover={setHoverCoordinate}
            onMapStyleChange={setMapStyle}
            onInsertVertex={handleInsertVertex}
            onSelectVertex={handleSelectVertex}
            onVertexDrag={handleVertexDrag}
            onVertexDragEnd={handleVertexDragEnd}
            onVertexDragStart={handleVertexDragStart}
            pendingFitBounds={pendingFitBounds}
            selectedFeatureId={selectedFeatureId}
            selectedMidpoints={selectedMidpoints}
            selectedVertexIndex={selectedVertexIndex}
            selectedVertices={selectedVertices}
            setIsHoveringSelectableFeature={setIsHoveringSelectableFeature}
            setPendingFitBounds={setPendingFitBounds}
            viewport={viewport}
            onViewportChange={setViewport}
          />
        </Suspense>
      </section>
    </main>
  );
}
