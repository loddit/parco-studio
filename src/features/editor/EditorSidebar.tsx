import {
  IconChevronLeft,
  IconCut,
  IconPoint,
  IconPointer,
  IconTrash,
  IconVectorSpline,
  IconLayoutSidebarLeftExpand,
  IconLayoutSidebarLeftCollapse,
  IconLine,
  IconPolygon,
  IconFileExport,
  IconSquareXFilled,
  IconClipboardText,
  IconSignRight,
  IconAdjustments,
  IconCheck,
  IconX,
  IconCaretRightFilled,
  IconCaretLeftFilled,
} from "@tabler/icons-react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import type { Feature } from "geojson";
import type { DatasetGeometry } from "@/types/dataset";
import { getModeDescription } from "./editor-helpers";
import type { EditorMode } from "./editor-types";
import type { EditorMapActions, EditorMapState } from "./useEditorMapState";
import { MapSettingsModal } from "./MapSettingsModal";

type EditorSidebarProps = {
  datasetName: string;
  draftArea: string | null;
  draftCount: number;
  draftLength: string | null;
  featureCount: number;
  onNavigateFeature: (direction: -1 | 1) => void;
  onNavigateVertex: (direction: -1 | 1) => void;
  selectedFeatureOrdinal: number | null;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  isDirty: boolean;
  mapActions: Pick<EditorMapActions, "setMapSource">;
  mapState: Pick<EditorMapState, "mapSource" | "mapSourceOptions" | "selectedMapSourceRequirement">;
  mode: EditorMode;
  onLinkSelectedLineString: () => void;
  onSplitSelectedLineString: () => void;
  onDeleteSelectedVertex: () => void;
  onDeleteSelectedFeature: () => void;
  onCopySelectedFeatureGeoJson: () => void;
  onExportSelectedFeature: () => void;
  onImportFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onModeChange: (mode: EditorMode) => void;
  onOpenImport: () => void;
  onReset: () => void;
  onSave: () => void;
  onOpenLineAdjustments: () => void;
  onToggleRouteAnnotations: () => void;
  isRouteAnnotationsVisible: boolean;
  selectedFeatureElevationMeters: number | null;
  selectedFeature: Feature<DatasetGeometry> | null;
  selectedFeatureArea: string | null;
  selectedFeatureLength: string | null;
  selectedVertexElevationMeters: number | null;
  onSetSelectedFeatureElevation: (elevationMeters: number | null) => void;
  onSetSelectedVertexElevation: (elevationMeters: number | null) => void;
  selectedVertexDistanceFromStart: string | null;
  selectedVertexIndex: number | null;
  selectedVerticesCount: number;
  canLinkSelectedLineString: boolean;
  isLinkingSelectedLineString: boolean;
  canSplitSelectedLineString: boolean;
};

export function EditorSidebar({
  datasetName,
  draftArea,
  draftCount,
  draftLength,
  featureCount,
  onNavigateFeature,
  onNavigateVertex,
  selectedFeatureOrdinal,
  importInputRef,
  isDirty,
  mapActions,
  mapState,
  mode,
  onLinkSelectedLineString,
  onSplitSelectedLineString,
  onDeleteSelectedVertex,
  onDeleteSelectedFeature,
  onCopySelectedFeatureGeoJson,
  onExportSelectedFeature,
  onImportFileChange,
  onModeChange,
  onOpenImport,
  onReset,
  onSave,
  onOpenLineAdjustments,
  onToggleRouteAnnotations,
  isRouteAnnotationsVisible,
  selectedFeatureElevationMeters,
  selectedFeature,
  selectedFeatureArea,
  selectedFeatureLength,
  selectedVertexElevationMeters,
  onSetSelectedFeatureElevation,
  onSetSelectedVertexElevation,
  selectedVertexDistanceFromStart,
  selectedVertexIndex,
  selectedVerticesCount,
  canLinkSelectedLineString,
  isLinkingSelectedLineString,
  canSplitSelectedLineString,
}: EditorSidebarProps) {
  const [isMapSettingsOpen, setIsMapSettingsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    function handleMediaQueryChange(event: MediaQueryListEvent) {
      setIsCollapsed(event.matches);
    }

    mediaQuery.addEventListener("change", handleMediaQueryChange);
    return () => mediaQuery.removeEventListener("change", handleMediaQueryChange);
  }, []);

  return (
    <aside
      className={clsx(
        "flex shrink-0 flex-col border-r border-sky-100 bg-white/92 transition-[width,padding] duration-200",
        isCollapsed ? "w-12 items-center px-1 py-4" : "w-[320px] p-5",
      )}
    >
      <div className={clsx("flex gap-3", isCollapsed ? "flex-col items-center" : "items-center")}>
        {isCollapsed ? null : (
          <>
            <Link
              aria-label="Back to datasets"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              to="/"
            >
              <IconChevronLeft size={18} stroke={1.9} />
            </Link>
            <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight text-slate-950">
              {datasetName}
            </h1>
          </>
        )}
        <Button
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="h-9 w-9 shrink-0 rounded-full px-0"
          onClick={() => setIsCollapsed((current) => !current)}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          type="button"
          variant="secondary"
        >
          {isCollapsed ? <IconLayoutSidebarLeftExpand size={18} stroke={1.9} /> : <IconLayoutSidebarLeftCollapse size={18} stroke={1.9} />}
        </Button>
      </div>

      <input
        accept=".geojson,.json,.gpx,application/geo+json,application/json,application/gpx+xml"
        className="hidden"
        onChange={(event) => void onImportFileChange(event)}
        ref={importInputRef}
        type="file"
      />

      {isCollapsed ? null : (
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={onSave} variant="primary">
            Save
          </Button>
          <Button className="flex-1" onClick={onReset} variant="secondary">
            Reset
          </Button>
          <Button className="flex-1" onClick={onOpenImport} variant="secondary">
            Import
          </Button>
        </div>
      )}

      <div className={clsx(isCollapsed ? "mt-4 w-full" : "mt-6")}>
        {isCollapsed ? null : <p className="mb-2 text-sm font-medium text-slate-700">Mode</p>}
        <div className={clsx("gap-2", isCollapsed ? "flex flex-col items-center" : "grid grid-cols-4")}>
          <ModeButton
            active={mode === "select"}
            icon={IconPointer}
            isCollapsed={isCollapsed}
            label="Select"
            onClick={() => onModeChange("select")}
          />
          <ModeButton
            active={mode === "draw-point"}
            icon={IconPoint}
            isCollapsed={isCollapsed}
            label="Point"
            onClick={() => onModeChange("draw-point")}
          />
          <ModeButton
            active={mode === "draw-line"}
            icon={IconLine}
            isCollapsed={isCollapsed}
            label="LineString"
            onClick={() => onModeChange("draw-line")}
          />
          <ModeButton
            active={mode === "draw-polygon"}
            icon={IconPolygon}
            isCollapsed={isCollapsed}
            label="Polygon"
            onClick={() => onModeChange("draw-polygon")}
          />
        </div>
      </div>

      {isCollapsed ? null : (
        <div className="mt-6 space-y-3 rounded-3xl border border-sky-100 bg-slate-50/80 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-slate-700">Features</span>
            <div className="flex items-center gap-0.5">
              <Button
                aria-label="Previous feature"
                className="h-7 w-7 shrink-0 rounded-full px-0"
                disabled={featureCount === 0}
                onClick={() => onNavigateFeature(-1)}
                title="Previous feature"
                type="button"
                variant="ghost"
              >
                <IconCaretLeftFilled size={15} stroke={1.9} />
              </Button>
              <span className="min-w-[3.25rem] rounded-full bg-white px-2 py-1 text-center text-xs font-semibold tabular-nums text-slate-500">
                {featureCount === 0
                  ? "0"
                  : selectedFeatureOrdinal !== null
                    ? `${selectedFeatureOrdinal} / ${featureCount}`
                    : `— / ${featureCount}`}
              </span>
              <Button
                aria-label="Next feature"
                className="h-7 w-7 shrink-0 rounded-full px-0"
                disabled={featureCount === 0}
                onClick={() => onNavigateFeature(1)}
                title="Next feature"
                type="button"
                variant="ghost"
              >
                <IconCaretRightFilled size={15} stroke={1.9} />
              </Button>
            </div>
          </div>
          <p className="text-slate-500">{getModeDescription(mode, draftCount)}</p>
          {selectedFeature ? (
            <SelectedFeatureCard
              onDelete={onDeleteSelectedFeature}
              onDeleteVertex={onDeleteSelectedVertex}
              onCopyGeoJson={onCopySelectedFeatureGeoJson}
              onExport={onExportSelectedFeature}
              onLink={onLinkSelectedLineString}
              onNavigateVertex={onNavigateVertex}
              onOpenLineAdjustments={onOpenLineAdjustments}
              onSplit={onSplitSelectedLineString}
              onToggleRouteAnnotations={onToggleRouteAnnotations}
              selectedFeatureElevationMeters={selectedFeatureElevationMeters}
              selectedFeature={selectedFeature}
              selectedFeatureArea={selectedFeatureArea}
              selectedFeatureLength={selectedFeatureLength}
              isRouteAnnotationsVisible={isRouteAnnotationsVisible}
              selectedVertexElevationMeters={selectedVertexElevationMeters}
              onSetSelectedFeatureElevation={onSetSelectedFeatureElevation}
              onSetSelectedVertexElevation={onSetSelectedVertexElevation}
              selectedVertexDistanceFromStart={selectedVertexDistanceFromStart}
              selectedVertexIndex={selectedVertexIndex}
              selectedVerticesCount={selectedVerticesCount}
              canLink={canLinkSelectedLineString}
              isLinking={isLinkingSelectedLineString}
              canSplit={canSplitSelectedLineString}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/70 px-4 py-3 text-slate-500">
              {mode === "select"
                ? "Click a feature to inspect and adjust its vertices."
                : "Click on the map to place vertices. Press Enter or double-click to finish."}
            </div>
          )}
          {draftCount > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">
                Draft Feature
              </p>
              <p className="mt-2 font-medium">{mode === "draw-polygon" ? "Polygon" : "LineString"}</p>
              <p className="mt-1">Vertices: {draftCount}</p>
              {mode === "draw-polygon" ? (
                draftArea ? <p className="mt-1">Area: {draftArea}</p> : null
              ) : draftLength ? (
                <p className="mt-1">Length: {draftLength}</p>
              ) : null}
            </div>
          ) : null}
          <div className="text-xs text-slate-400">
            {isDirty ? "Unsaved changes" : "All changes saved"}
          </div>
        </div>
      )}

      {isCollapsed ? null : (
        <div className="mt-auto pt-6">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-slate-50/80 px-4 py-3 text-sm">
            <p className="text-slate-600">
              <span className="font-medium text-slate-700">Map Service:</span>{" "}
              {mapState.mapSourceOptions.find((option) => option.value === mapState.mapSource)?.label ??
                mapState.mapSource}
            </p>
            <Button
              aria-label="Open map settings"
              className="shrink-0 rounded-full px-3 py-1.5 text-xs"
              onClick={() => setIsMapSettingsOpen(true)}
              type="button"
              variant="secondary"
            >
              Edit
            </Button>
          </div>
        </div>
      )}

      <MapSettingsModal
        isOpen={isMapSettingsOpen}
        mapActions={mapActions}
        mapState={mapState}
        onClose={() => setIsMapSettingsOpen(false)}
      />
    </aside>
  );
}

function SelectedFeatureCard({
  onDelete,
  onDeleteVertex,
  onCopyGeoJson,
  onExport,
  onLink,
  onNavigateVertex,
  onOpenLineAdjustments,
  onSplit,
  onToggleRouteAnnotations,
  selectedFeatureElevationMeters,
  selectedFeature,
  selectedFeatureArea,
  selectedFeatureLength,
  isRouteAnnotationsVisible,
  selectedVertexElevationMeters,
  onSetSelectedFeatureElevation,
  onSetSelectedVertexElevation,
  selectedVertexDistanceFromStart,
  selectedVertexIndex,
  selectedVerticesCount,
  canLink,
  isLinking,
  canSplit,
}: {
  onDelete: () => void;
  onDeleteVertex: () => void;
  onCopyGeoJson: () => void;
  onExport: () => void;
  onLink: () => void;
  onNavigateVertex: (direction: -1 | 1) => void;
  onOpenLineAdjustments: () => void;
  onSplit: () => void;
  onToggleRouteAnnotations: () => void;
  selectedFeatureElevationMeters: number | null;
  selectedFeature: Feature<DatasetGeometry>;
  selectedFeatureArea: string | null;
  selectedFeatureLength: string | null;
  isRouteAnnotationsVisible: boolean;
  selectedVertexElevationMeters: number | null;
  onSetSelectedFeatureElevation: (elevationMeters: number | null) => void;
  onSetSelectedVertexElevation: (elevationMeters: number | null) => void;
  selectedVertexDistanceFromStart: string | null;
  selectedVertexIndex: number | null;
  selectedVerticesCount: number;
  canLink: boolean;
  isLinking: boolean;
  canSplit: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-slate-600">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Selected Feature
        </p>
        <p className="mt-2 font-medium text-slate-900">{selectedFeature.geometry.type}</p>
        <p className="mt-1">Vertices: {selectedVerticesCount}</p>
        {selectedFeature.geometry.type === "Point" ? (
          <ElevationEditRow
            inputId="selected-feature-elevation"
            onApply={onSetSelectedFeatureElevation}
            valueMeters={selectedFeatureElevationMeters}
          />
        ) : null}
        {selectedFeature.geometry.type === "Polygon" ? (
          selectedFeatureArea ? <p className="mt-1">Area: {selectedFeatureArea}</p> : null
        ) : selectedFeatureLength ? (
          <p className="mt-1">Length: {selectedFeatureLength}</p>
        ) : null}
        <div className="mt-3 flex gap-1.5">
          {selectedFeature.geometry.type === "LineString" ? (
            <Button
              aria-label="Adjust route"
              className="min-w-0 flex-1 text-xs"
              onClick={onOpenLineAdjustments}
              title="Adjust route"
              variant="secondary"
            >
              <IconAdjustments size={18} />
            </Button>
          ) : null}
          {selectedFeature.geometry.type === "LineString" ? (
            <Button
              aria-label="Toggle route annotations"
              className="min-w-0 flex-1 text-xs"
              onClick={onToggleRouteAnnotations}
              title="Toggle route annotations"
              variant={isRouteAnnotationsVisible ? "primary" : "secondary"}
            >
              <IconSignRight size={18} />
            </Button>
          ) : null}
          <Button
            className="min-w-0 flex-1 text-xs"
            onClick={onExport}
            variant="secondary"
            title="Export"
          >
            <IconFileExport size={18}/>
          </Button>
          <Button
            className="min-w-0 flex-1 text-xs"
            onClick={onCopyGeoJson}
            variant="secondary"
            title="Copy GeoJSON"
          >
            <IconClipboardText size={18}/>
          </Button>
          <Button
            className="min-w-0 flex-1 text-xs"
            onClick={onDelete}
            variant="secondary"
            title="Delete"
          >
            <IconSquareXFilled size={18} />
          </Button>
        </div>
      </div>

      {selectedFeature.geometry.type === "LineString" && selectedVertexIndex !== null ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50/70 px-4 py-3 text-orange-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
            Selected Vertex
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-medium text-orange-900">Point Index</span>
            <div className="flex items-center gap-0.5">
              <Button
                aria-label="Previous vertex"
                className="h-7 w-7 shrink-0 rounded-full px-0 text-orange-900"
                disabled={selectedVerticesCount === 0}
                onClick={() => onNavigateVertex(-1)}
                title="Previous vertex"
                type="button"
                variant="ghost"
              >
                <IconCaretLeftFilled size={15} stroke={1.9} />
              </Button>
              <span className="min-w-[1.75rem] rounded-full bg-white/90 px-2 py-1 text-center text-xs font-semibold tabular-nums text-orange-900">
                {selectedVertexIndex + 1}
              </span>
              <Button
                aria-label="Next vertex"
                className="h-7 w-7 shrink-0 rounded-full px-0 text-orange-900"
                disabled={selectedVerticesCount === 0}
                onClick={() => onNavigateVertex(1)}
                title="Next vertex"
                type="button"
                variant="ghost"
              >
                <IconCaretRightFilled size={15} stroke={1.9} />
              </Button>
            </div>
          </div>
          <ElevationEditRow
            inputId="selected-vertex-elevation"
            onApply={onSetSelectedVertexElevation}
            valueMeters={selectedVertexElevationMeters}
          />
          {selectedVertexDistanceFromStart ? (
            <p className="mt-1">Distance from start: {selectedVertexDistanceFromStart}</p>
          ) : null}
          {isLinking ? (
            <p className="mt-2 rounded-xl border border-orange-200 bg-white/75 px-3 py-2 text-xs text-orange-700">
              Link mode active. Click any LineString endpoint on the map.
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            {canLink ? (
              <Button
                aria-label="Link LineString"
                className="shrink-0 px-3"
                onClick={onLink}
                title="Link LineString"
                variant={isLinking ? "primary" : "secondary"}
              >
                <IconVectorSpline size={16} stroke={1.9} />
              </Button>
            ) : null}
            {canSplit ? (
              <Button
                aria-label="Split LineString"
                className="shrink-0 px-3"
                onClick={onSplit}
                title="Split LineString"
                variant="secondary"
              >
                <IconCut size={16} stroke={1.9} />
              </Button>
            ) : null}
            <Button className="px-3" onClick={onDeleteVertex} variant="secondary">
              <IconTrash size={15} stroke={1.9} />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ElevationEditRow({
  valueMeters,
  onApply,
  inputId,
}: {
  valueMeters: number | null;
  onApply: (elevationMeters: number | null) => void;
  inputId: string;
}) {
  const [draft, setDraft] = useState(() => (valueMeters === null ? "" : String(valueMeters)));

  useEffect(() => {
    setDraft(valueMeters === null ? "" : String(valueMeters));
  }, [valueMeters]);

  function handleApply() {
    const trimmed = draft.trim();
    if (trimmed === "") {
      return;
    }

    const next = Number(trimmed);
    if (!Number.isFinite(next)) {
      setDraft(valueMeters === null ? "" : String(valueMeters));
      return;
    }

    onApply(next);
  }

  function handleClear() {
    onApply(null);
  }

  return (
    <div className="w-full mt-2 flex items-center gap-2">
      <label className="text-sm">
        Elevation:
      </label>
      <TextInput
        className="flex-1 p-0 text-sm"
        id={inputId}
        inputMode="decimal"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleApply();
          }
        }}
        placeholder="null"
        type="text"
        value={draft}
      />
      <div className="flex shrink-0 gap-1.5">
        <Button className="px-2 text-xs" onClick={handleApply} variant="secondary">
          <IconCheck size={15} stroke={1.9} />
        </Button>
        <Button className="px-2 text-xs" onClick={handleClear} variant="secondary">
          <IconTrash size={15} stroke={1.9} />
        </Button>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  icon: Icon,
  isCollapsed,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof IconPointer;
  isCollapsed?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className={clsx(
        "px-0",
        isCollapsed ? "h-9 w-9 rounded-2xl" : "h-10 w-full rounded-2xl",
      )}
      onClick={onClick}
      title={label}
      variant={active ? "primary" : "secondary"}
    >
      <Icon size={20} stroke={1.9} />
    </Button>
  );
}
