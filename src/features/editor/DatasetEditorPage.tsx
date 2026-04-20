import type { ChangeEvent } from "react";
import type { Feature, GeoJSON, LineString } from "geojson";
import { lazy, Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useToast } from "@/components/Toast";
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
import { LineAdjustModal } from "./LineAdjustModal";
import {
  appendFeature,
  cloneFeatureCollection,
  createLineFeature,
  createPointFeature,
  createPolygonFeature,
  extractSupportedFeatures,
  FALLBACK_CENTER,
  FALLBACK_ZOOM,
  getCoordinateElevation,
  formatArea,
  formatLineLength,
  getFeatureBounds,
  getClickedFeatureId,
  getLinkableLineEndpoints,
  getLineLength,
  getPolygonArea,
  getFeatureMidpoints,
  getFeatureVertices,
  getLineRouteAnnotations,
  getLineDistanceToVertex,
  HISTORY_LIMIT,
  insertFeatureVertexAtMidpoint,
  isTypingTarget,
  linkLineFeaturesAtEndpoints,
  replaceLineFeatureCoordinates,
  removeFeatureVertex,
  reverseLineFeatureCoordinates,
  simplifyLineCoordinatesByRdpRatio,
  splitLineFeatureAtVertex,
  updateFeatureVertex,
  updateFeatureVertexElevation,
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
  const { showToast } = useToast();
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
  const [isLineAdjustModalOpen, setIsLineAdjustModalOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState("");
  const [isRouteAnnotationsVisible, setIsRouteAnnotationsVisible] = useState(false);
  const [lineCompressionRatio, setLineCompressionRatio] = useState(0.4);
  const [pendingLinkEndpoint, setPendingLinkEndpoint] = useState<{
    featureId: string;
    vertexIndex: number;
  } | null>(null);

  function resetSelectionState() {
    setSelectedFeatureId(null);
    setSelectedVertexIndex(null);
    setPendingLinkEndpoint(null);
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
      setPendingLinkEndpoint(null);
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
    setPendingLinkEndpoint(null);
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
    setPendingLinkEndpoint(null);
    setSelectedFeatureId(featureId);
    setSelectedVertexIndex(vertexIndex);
  }

  function handleSetSelectedFeatureElevation(elevationMeters: number | null) {
    if (!selectedFeatureId) {
      return;
    }

    const feature = features.features.find((item) => String(item.id) === selectedFeatureId);
    if (!feature || feature.geometry.type !== "Point") {
      return;
    }

    commitFeatureChange(updateFeatureVertexElevation(features, selectedFeatureId, 0, elevationMeters));
  }

  function handleSetSelectedVertexElevation(elevationMeters: number | null) {
    if (!selectedFeatureId || selectedVertexIndex === null) {
      return;
    }

    const feature = features.features.find((item) => String(item.id) === selectedFeatureId);
    if (!feature || feature.geometry.type !== "LineString") {
      return;
    }

    commitFeatureChange(
      updateFeatureVertexElevation(features, selectedFeatureId, selectedVertexIndex, elevationMeters),
    );
  }

  function handleDeleteSelectedVertex() {
    if (!selectedFeatureId || selectedVertexIndex === null) {
      return;
    }

    const nextFeatures = removeFeatureVertex(features, selectedFeatureId, selectedVertexIndex);
    const nextFeature =
      nextFeatures.features.find((feature) => String(feature.id) === selectedFeatureId) ?? null;

    commitFeatureChange(nextFeatures);
    setPendingLinkEndpoint(null);

    if (!nextFeature || nextFeature.geometry.type === "Point") {
      setSelectedVertexIndex(null);
      return;
    }

    const nextVertexCount = getFeatureVertices(nextFeature).length;
    setSelectedVertexIndex(nextVertexCount === 0 ? null : Math.min(selectedVertexIndex, nextVertexCount - 1));
  }

  function handleSplitSelectedLineString() {
    if (!selectedFeatureId || selectedVertexIndex === null || selectedFeature?.geometry.type !== "LineString") {
      return;
    }

    const selectedFeaturePosition = features.features.findIndex(
      (feature) => String(feature.id) === selectedFeatureId,
    );
    const nextFeatures = splitLineFeatureAtVertex(features, selectedFeatureId, selectedVertexIndex);

    commitFeatureChange(nextFeatures);
    setPendingLinkEndpoint(null);
    setSelectedVertexIndex(null);
    setSelectedFeatureId(
      selectedFeaturePosition >= 0 ? String(nextFeatures.features[selectedFeaturePosition]?.id ?? null) : null,
    );
  }

  function handleToggleLinkSelectedLineString() {
    if (!selectedFeatureId || selectedVertexIndex === null) {
      return;
    }

    setPendingLinkEndpoint((current) =>
      current?.featureId === selectedFeatureId && current.vertexIndex === selectedVertexIndex
        ? null
        : {
            featureId: selectedFeatureId,
            vertexIndex: selectedVertexIndex,
          },
    );
  }

  function handleReverseSelectedLineString() {
    if (!selectedFeatureId || selectedFeature?.geometry.type !== "LineString") {
      return;
    }

    commitFeatureChange(reverseLineFeatureCoordinates(features, selectedFeatureId));
    setSelectedFeatureId(selectedFeatureId);
    setSelectedVertexIndex(null);
    setPendingLinkEndpoint(null);
  }

  function handleSimplifySelectedLineString(compressionRatio: number) {
    if (!selectedFeatureId || selectedFeature?.geometry.type !== "LineString") {
      return;
    }

    const nextCoordinates = simplifyLineCoordinatesByRdpRatio(selectedVertices, compressionRatio);

    if (JSON.stringify(nextCoordinates) === JSON.stringify(selectedVertices)) {
      return;
    }

    commitFeatureChange(replaceLineFeatureCoordinates(features, selectedFeatureId, nextCoordinates));
    setLineCompressionRatio(compressionRatio);
    setSelectedFeatureId(selectedFeatureId);
    setSelectedVertexIndex(null);
    setPendingLinkEndpoint(null);
  }

  function handleLinkEndpointClick(featureId: string, vertexIndex: number) {
    if (!pendingLinkEndpoint) {
      setSelectedFeatureId(featureId);
      setSelectedVertexIndex(vertexIndex);
      return;
    }

    const nextFeatures = linkLineFeaturesAtEndpoints(
      features,
      pendingLinkEndpoint.featureId,
      pendingLinkEndpoint.vertexIndex,
      featureId,
      vertexIndex,
    );

    if (JSON.stringify(nextFeatures) === JSON.stringify(features)) {
      return;
    }

    commitFeatureChange(nextFeatures);
    setPendingLinkEndpoint(null);
    setSelectedFeatureId(pendingLinkEndpoint.featureId);
    setSelectedVertexIndex(null);
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

  function importFeaturesFromContent(
    content: string,
    sourceName: string,
    sourceType: "geojson" | "gpx" | "auto" = "auto",
  ) {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return false;
    }

    const normalizedSourceName = sourceName.toLowerCase();
    const shouldParseAsGpx =
      sourceType === "gpx" ||
      normalizedSourceName.endsWith(".gpx") ||
      trimmedContent.startsWith("<?xml") ||
      trimmedContent.startsWith("<gpx");

    try {
      const importedFeatures = shouldParseAsGpx
        ? parseGpx(trimmedContent)
        : extractSupportedFeatures(JSON.parse(trimmedContent) as GeoJSON);

      if (importedFeatures.length === 0) {
        window.alert(
          shouldParseAsGpx
            ? "No supported GPX features found. Waypoints and tracks/routes with at least two points are imported."
            : "No supported GeoJSON features found. Only Point, LineString, and Polygon are imported.",
        );
        return true;
      }

      commitFeatureChange({
        ...features,
        features: [...features.features, ...importedFeatures],
      });
      resetTransientEditorState();
      mapActions.setPendingFitBounds(getFeatureBounds(importedFeatures));

      return true;
    } catch {
      window.alert(
        shouldParseAsGpx
          ? "Failed to import GPX. Check that the content contains valid GPX XML."
          : "Failed to import GeoJSON. Check that the content contains valid JSON.",
      );
      return true;
    }
  }

  function looksLikeImportableClipboardText(content: string) {
    const trimmedContent = content.trim();

    return (
      trimmedContent.startsWith("<?xml") ||
      trimmedContent.startsWith("<gpx") ||
      trimmedContent.startsWith("{") ||
      trimmedContent.startsWith("[")
    );
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      importFeaturesFromContent(content, file.name);
    } finally {
      event.target.value = "";
    }
  }

  const onWindowPaste = useEffectEvent((event: ClipboardEvent) => {
    if (isTypingTarget(event.target)) {
      return;
    }

    const clipboardData = event.clipboardData;

    if (!clipboardData) {
      return;
    }

    const file = Array.from(clipboardData.files).find((candidate) => {
      const fileName = candidate.name.toLowerCase();

      return fileName.endsWith(".geojson") || fileName.endsWith(".json") || fileName.endsWith(".gpx");
    });

    if (file) {
      event.preventDefault();
      void file.text().then((content) => {
        importFeaturesFromContent(content, file.name);
      });
      return;
    }

    const text = clipboardData.getData("text/plain");

    if (!looksLikeImportableClipboardText(text)) {
      return;
    }

    if (importFeaturesFromContent(text, "clipboard", "auto")) {
      event.preventDefault();
    }
  });

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      onWindowPaste(event);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [onWindowPaste]);

  const selectedFeature = selectedFeatureId
    ? features.features.find((feature) => String(feature.id) === selectedFeatureId) ?? null
    : null;
  const selectedFeatureIndexInCollection = selectedFeatureId
    ? features.features.findIndex((feature) => String(feature.id) === selectedFeatureId)
    : -1;
  const selectedFeatureOrdinal =
    selectedFeatureIndexInCollection >= 0 ? selectedFeatureIndexInCollection + 1 : null;
  const selectedVertices = selectedFeature ? getFeatureVertices(selectedFeature) : [];
  const selectedMidpoints = selectedFeature ? getFeatureMidpoints(selectedFeature) : [];
  const selectedRouteAnnotations =
    isRouteAnnotationsVisible && selectedFeature?.geometry.type === "LineString"
      ? getLineRouteAnnotations(selectedVertices)
      : [];
  const selectedFeatureLength =
    selectedFeature?.geometry.type === "LineString"
      ? formatLineLength(
          getLineDistanceToVertex(
            selectedFeature as Feature<LineString>,
            selectedVertices.length - 1,
          ),
        )
      : null;
  const selectedFeatureArea =
    selectedFeature?.geometry.type === "Polygon"
      ? formatArea(getPolygonArea(selectedVertices))
      : null;
  const draftLength =
    mode === "draw-line" && draftCoordinates.length >= 2
      ? formatLineLength(getLineLength(draftCoordinates))
      : null;
  const draftArea =
    mode === "draw-polygon" && draftCoordinates.length >= 3
      ? formatArea(getPolygonArea(draftCoordinates))
      : null;
  const selectedVertexDistanceFromStart =
    selectedFeature?.geometry.type === "LineString" && selectedVertexIndex !== null
      ? formatLineLength(
          getLineDistanceToVertex(selectedFeature as Feature<LineString>, selectedVertexIndex),
        )
      : null;
  const selectedFeatureElevationMeters =
    selectedFeature?.geometry.type === "Point"
      ? getCoordinateElevation(selectedFeature.geometry.coordinates as LngLat)
      : null;
  const selectedVertexElevationMeters =
    selectedVertexIndex !== null ? getCoordinateElevation(selectedVertices[selectedVertexIndex]) : null;
  const linkableLineEndpoints = getLinkableLineEndpoints(features);
  const canSplitSelectedLineString =
    selectedFeature?.geometry.type === "LineString" &&
    selectedVertexIndex !== null &&
    ((selectedVertices.length >= 3 &&
      JSON.stringify(selectedVertices[0]) === JSON.stringify(selectedVertices[selectedVertices.length - 1]) &&
      (selectedVertexIndex === 0 || selectedVertexIndex === selectedVertices.length - 1)) ||
      (selectedVertexIndex > 0 && selectedVertexIndex < selectedVertices.length - 2));
  const canLinkSelectedLineString =
    selectedFeature?.geometry.type === "LineString" &&
    selectedVertexIndex !== null &&
    (selectedVertexIndex === 0 || selectedVertexIndex === selectedVertices.length - 1);
  const isLinkingSelectedLineString =
    canLinkSelectedLineString &&
    pendingLinkEndpoint?.featureId === selectedFeatureId &&
    pendingLinkEndpoint.vertexIndex === selectedVertexIndex;
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

  function handleNavigateFeature(direction: -1 | 1) {
    const list = features.features;
    const n = list.length;
    if (n === 0) {
      return;
    }

    setPendingLinkEndpoint(null);

    const currentIdx = selectedFeatureId
      ? list.findIndex((feature) => String(feature.id) === selectedFeatureId)
      : -1;

    let nextIdx: number;
    if (currentIdx < 0) {
      nextIdx = direction > 0 ? 0 : n - 1;
    } else {
      nextIdx = (currentIdx + direction + n) % n;
    }

    const nextFeature = list[nextIdx];
    setSelectedFeatureId(String(nextFeature.id));
    setSelectedVertexIndex(null);

    const bounds = getFeatureBounds([nextFeature]);
    if (bounds) {
      mapActions.setPendingFitBounds(bounds);
    }
  }

  function handleNavigateVertex(direction: -1 | 1) {
    if (!selectedFeatureId || selectedFeature?.geometry.type !== "LineString") {
      return;
    }

    const vertices = getFeatureVertices(selectedFeature);
    const n = vertices.length;
    if (n === 0) {
      return;
    }

    setPendingLinkEndpoint(null);

    const safeCurrent =
      selectedVertexIndex !== null && selectedVertexIndex >= 0 && selectedVertexIndex < n
        ? selectedVertexIndex
        : -1;

    let nextIdx: number;
    if (safeCurrent < 0) {
      nextIdx = direction > 0 ? 0 : n - 1;
    } else {
      nextIdx = (safeCurrent + direction + n) % n;
    }

    setSelectedVertexIndex(nextIdx);
  }

  async function handleCopySelectedFeatureGeoJson() {
    if (!selectedFeature) {
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(selectedFeature, null, 2));
      showToast("GeoJSON copied to clipboard.", { tone: "success" });
    } catch {
      showToast("Failed to copy GeoJSON to clipboard.", { tone: "error" });
    }
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
        draftArea={draftArea}
        draftLength={draftLength}
        featureCount={features.features.length}
        onNavigateFeature={handleNavigateFeature}
        onNavigateVertex={handleNavigateVertex}
        selectedFeatureOrdinal={selectedFeatureOrdinal}
        importInputRef={importInputRef}
        isDirty={isDirty}
        mapActions={mapActions}
        mapState={mapState}
        mode={mode}
        onLinkSelectedLineString={handleToggleLinkSelectedLineString}
        onDeleteSelectedVertex={handleDeleteSelectedVertex}
        onDeleteSelectedFeature={handleDeleteSelectedFeature}
        onCopySelectedFeatureGeoJson={() => void handleCopySelectedFeatureGeoJson()}
        onExportSelectedFeature={handleExportSelectedFeature}
        onSplitSelectedLineString={handleSplitSelectedLineString}
        onImportFileChange={handleImportFile}
        onModeChange={handleModeChange}
        onOpenImport={() => importInputRef.current?.click()}
        onOpenLineAdjustments={() => setIsLineAdjustModalOpen(true)}
        onReset={handleResetDataset}
        onSave={() => void handleSaveDataset()}
        onToggleRouteAnnotations={() => setIsRouteAnnotationsVisible((current) => !current)}
        selectedFeatureElevationMeters={selectedFeatureElevationMeters}
        selectedFeature={selectedFeature}
        selectedFeatureArea={selectedFeatureArea}
        selectedFeatureLength={selectedFeatureLength}
        isRouteAnnotationsVisible={isRouteAnnotationsVisible}
        selectedVertexElevationMeters={selectedVertexElevationMeters}
        onSetSelectedFeatureElevation={handleSetSelectedFeatureElevation}
        onSetSelectedVertexElevation={handleSetSelectedVertexElevation}
        selectedVertexDistanceFromStart={selectedVertexDistanceFromStart}
        selectedVertexIndex={selectedVertexIndex}
        selectedVerticesCount={selectedVertices.length}
        canSplitSelectedLineString={canSplitSelectedLineString}
        canLinkSelectedLineString={Boolean(canLinkSelectedLineString)}
        isLinkingSelectedLineString={Boolean(isLinkingSelectedLineString)}
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
            onLinkEndpointClick={handleLinkEndpointClick}
            onSelectVertex={handleSelectVertex}
            onVertexDrag={handleVertexDrag}
            onVertexDragEnd={handleVertexDragEnd}
            onVertexDragStart={handleVertexDragStart}
            pendingLinkEndpoint={pendingLinkEndpoint}
            selectedFeatureId={selectedFeatureId}
            linkableLineEndpoints={linkableLineEndpoints}
            selectedMidpoints={selectedMidpoints}
            selectedRouteAnnotations={selectedRouteAnnotations}
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
      {isLineAdjustModalOpen && selectedFeature?.geometry.type === "LineString" ? (
        <LineAdjustModal
          initialCompressionRatio={lineCompressionRatio}
          onApplyCompression={(compressionRatio) => {
            handleSimplifySelectedLineString(compressionRatio);
            setIsLineAdjustModalOpen(false);
          }}
          onClose={() => setIsLineAdjustModalOpen(false)}
          onReverseDirection={() => {
            handleReverseSelectedLineString();
            setIsLineAdjustModalOpen(false);
          }}
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
