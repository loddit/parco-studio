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
import { ExportModal, type ExportFormat } from "./ExportModal";
import {
  appendFeature,
  cloneFeatureCollection,
  createLineFeature,
  createPointFeature,
  createPolygonFeature,
  extractSupportedFeatures,
  FALLBACK_CENTER,
  FALLBACK_ZOOM,
  formatCoordinateElevation,
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
import { exportLineStringToGpx, parseGpx } from "./gpx";
import type { MapCanvasLayerMouseEvent, MapCanvasMarkerEvent } from "./MapCanvas";
import type { EditorMode } from "./editor-types";
import { useEditorMapState } from "./useEditorMapState";

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
  const { mapState, mapActions } = useEditorMapState({
    initialViewport: {
      center: [FALLBACK_CENTER.lng, FALLBACK_CENTER.lat],
      zoomLevel: FALLBACK_ZOOM,
    },
  });
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [mode, setMode] = useState<EditorMode>("select");
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [draftCoordinates, setDraftCoordinates] = useState<LngLat[]>([]);
  const [hoverCoordinate, setHoverCoordinate] = useState<LngLat | null>(null);
  const [isHoveringSelectableFeature, setIsHoveringSelectableFeature] = useState(false);
  const [features, setFeatures] = useState<DatasetFeatureCollection>(createEmptyFeatureCollection());
  const [isDraggingVertex, setIsDraggingVertex] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState("");

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
    mapActions.setViewport({
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
      mapState.viewport.center,
      mapState.viewport.zoomLevel,
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
    mapActions.setViewport({
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

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const fileName = file.name.toLowerCase();
      const importedFeatures = fileName.endsWith(".gpx")
        ? parseGpx(content)
        : extractSupportedFeatures(JSON.parse(content) as GeoJSON);

      if (importedFeatures.length === 0) {
        window.alert(
          fileName.endsWith(".gpx")
            ? "No supported GPX features found. Waypoints and tracks/routes with at least two points are imported."
            : "No supported GeoJSON features found. Only Point, LineString, and Polygon are imported.",
        );
        return;
      }

      commitFeatureChange({
        ...features,
        features: [...features.features, ...importedFeatures],
      });
      resetTransientEditorState();
      mapActions.setPendingFitBounds(getFeatureBounds(importedFeatures));
    } catch {
      window.alert(
        file.name.toLowerCase().endsWith(".gpx")
          ? "Failed to import GPX. Check that the file contains valid GPX XML."
          : "Failed to import GeoJSON. Check that the file contains valid JSON.",
      );
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
  const selectedFeatureElevation =
    selectedFeature?.geometry.type === "Point"
      ? formatCoordinateElevation(selectedFeature.geometry.coordinates as LngLat)
      : "unknown";
  const selectedVertexElevation =
    selectedVertexIndex !== null ? formatCoordinateElevation(selectedVertices[selectedVertexIndex]) : null;
  const isDirty =
    !dataset ||
    JSON.stringify(dataset.features) !== JSON.stringify(features) ||
    JSON.stringify(dataset.center) !== JSON.stringify(mapState.viewport.center) ||
    dataset.zoomLevel !== mapState.viewport.zoomLevel;

  function handleExportSelectedFeature() {
    if (!selectedFeature) {
      return;
    }

    setExportFileName(getDefaultExportFileName(selectedFeature));
    setIsExportModalOpen(true);
  }

  function handleExport(format: ExportFormat) {
    if (!selectedFeature) {
      return;
    }

    if (format === "gpx" && selectedFeature.geometry.type !== "LineString") {
      return;
    }

    const sanitizedFileName = sanitizeExportFileName(exportFileName) || getDefaultExportFileName(selectedFeature);
    const extension = format === "gpx" ? "gpx" : "geojson";
    const blob =
      format === "gpx"
        ? new Blob([exportLineStringToGpx(selectedFeature, sanitizedFileName)], {
            type: "application/gpx+xml",
          })
        : new Blob([JSON.stringify(selectedFeature, null, 2)], {
            type: "application/geo+json",
          });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${sanitizedFileName}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
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
        mapActions={mapActions}
        mapState={mapState}
        mode={mode}
        onDeleteSelectedFeature={handleDeleteSelectedFeature}
        onExportSelectedFeature={handleExportSelectedFeature}
        onImportFileChange={handleImportFile}
        onModeChange={handleModeChange}
        onOpenImport={() => importInputRef.current?.click()}
        onReset={handleResetDataset}
        onSave={() => void handleSaveDataset()}
        selectedFeatureElevation={selectedFeatureElevation}
        selectedFeature={selectedFeature}
        selectedFeatureLength={selectedFeatureLength}
        selectedVertexElevation={selectedVertexElevation}
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
            mapActions={mapActions}
            mapState={mapState}
            mode={mode}
            onCloseDraftLineLoop={handleCloseDraftLineLoop}
            onFeatureClick={setSelectedFeatureId}
            onFinalizeDraft={finalizeDraft}
            onMapClick={handleMapClick}
            onMapHover={setHoverCoordinate}
            onInsertVertex={handleInsertVertex}
            onSelectVertex={handleSelectVertex}
            onVertexDrag={handleVertexDrag}
            onVertexDragEnd={handleVertexDragEnd}
            onVertexDragStart={handleVertexDragStart}
            selectedFeatureId={selectedFeatureId}
            selectedMidpoints={selectedMidpoints}
            selectedVertexIndex={selectedVertexIndex}
            selectedVertices={selectedVertices}
            setIsHoveringSelectableFeature={setIsHoveringSelectableFeature}
          />
        </Suspense>
      </section>

      {isExportModalOpen && selectedFeature ? (
        <ExportModal
          canExportGpx={selectedFeature.geometry.type === "LineString"}
          fileName={exportFileName}
          onClose={() => setIsExportModalOpen(false)}
          onFileNameChange={setExportFileName}
          onExport={handleExport}
        />
      ) : null}
    </main>
  );
}

function sanitizeExportFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-");
}

function getDefaultExportFileName(feature: Feature<DatasetGeometry>) {
  const baseName =
    typeof feature.properties?.name === "string" && feature.properties.name.trim().length > 0
      ? feature.properties.name.trim()
      : `${feature.geometry.type.toLowerCase()}-${String(feature.id)}`;

  return sanitizeExportFileName(baseName);
}
