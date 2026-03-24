import {
  IconChevronLeft,
  IconPoint,
  IconPointer,
  IconX,
  IconVectorSpline,
  IconVectorTriangle,
  IconLayoutSidebarLeftExpand,
  IconLayoutSidebarLeftCollapse,
} from "@tabler/icons-react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import type { Feature, LineString } from "geojson";
import type { DatasetGeometry } from "@/types/dataset";
import { getModeDescription } from "./editor-helpers";
import type { EditorMode } from "./editor-types";
import type { EditorMapActions, EditorMapState } from "./useEditorMapState";

type EditorSidebarProps = {
  datasetName: string;
  draftCount: number;
  featureCount: number;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  isDirty: boolean;
  mapActions: Pick<EditorMapActions, "setBearingEnabled" | "setMapSource" | "setPitchEnabled">;
  mapState: Pick<
    EditorMapState,
    | "isBearingEnabled"
    | "isPitchEnabled"
    | "mapSource"
    | "mapSourceOptions"
    | "selectedMapSourceRequirement"
  >;
  mode: EditorMode;
  onDeleteSelectedFeature: () => void;
  onExportSelectedFeature: () => void;
  onImportFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onModeChange: (mode: EditorMode) => void;
  onOpenImport: () => void;
  onReset: () => void;
  onSave: () => void;
  selectedFeature: Feature<DatasetGeometry> | null;
  selectedFeatureLength: string | null;
  selectedVertexDistanceFromStart: string | null;
  selectedVertexIndex: number | null;
  selectedVerticesCount: number;
};

export function EditorSidebar({
  datasetName,
  draftCount,
  featureCount,
  importInputRef,
  isDirty,
  mapActions,
  mapState,
  mode,
  onDeleteSelectedFeature,
  onExportSelectedFeature,
  onImportFileChange,
  onModeChange,
  onOpenImport,
  onReset,
  onSave,
  selectedFeature,
  selectedFeatureLength,
  selectedVertexDistanceFromStart,
  selectedVertexIndex,
  selectedVerticesCount,
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
        accept=".geojson,.json,application/geo+json,application/json"
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
            icon={IconVectorSpline}
            isCollapsed={isCollapsed}
            label="LineString"
            onClick={() => onModeChange("draw-line")}
          />
          <ModeButton
            active={mode === "draw-polygon"}
            icon={IconVectorTriangle}
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
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              {featureCount}
            </span>
          </div>
          <p className="text-slate-500">{getModeDescription(mode, draftCount)}</p>
          {selectedFeature ? (
            <SelectedFeatureCard
              onDelete={onDeleteSelectedFeature}
              onExport={onExportSelectedFeature}
              selectedFeature={selectedFeature}
              selectedFeatureLength={selectedFeatureLength}
              selectedVertexDistanceFromStart={selectedVertexDistanceFromStart}
              selectedVertexIndex={selectedVertexIndex}
              selectedVerticesCount={selectedVerticesCount}
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
              Draft vertices: {draftCount}
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

      {isMapSettingsOpen ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-slate-950/10 backdrop-blur-[1px]"
          onClick={() => setIsMapSettingsOpen(false)}
        >
          <div
            aria-modal="true"
            className="absolute left-1/2 top-24 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-[28px] border border-sky-100 bg-white/80 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-950">Map Settings</p>
                <p className="mt-1 text-sm text-slate-500">Choose the renderer source.</p>
              </div>
              <Button
                aria-label="Close map settings"
                className="h-10 w-10 rounded-full px-0"
                onClick={() => setIsMapSettingsOpen(false)}
                variant="ghost"
              >
                <IconX size={18} stroke={1.9} />
              </Button>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Map Source</p>
                <Select
                  onChange={(event) => mapActions.setMapSource(event.target.value as typeof mapState.mapSource)}
                  value={mapState.mapSource}
                >
                  {mapState.mapSourceOptions.map((option) => (
                    <option disabled={!option.isAvailable} key={option.value} value={option.value}>
                      {option.label}
                      {option.isAvailable ? "" : " (requires key)"}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Interaction</p>
                <div className="grid grid-cols-2 gap-2">
                  <ToggleButton
                    active={mapState.isBearingEnabled}
                    label="Bearing"
                    onClick={() => mapActions.setBearingEnabled(!mapState.isBearingEnabled)}
                  />
                  <ToggleButton
                    active={mapState.isPitchEnabled}
                    label="Pitch"
                    onClick={() => mapActions.setPitchEnabled(!mapState.isPitchEnabled)}
                  />
                </div>
              </div>

              {mapState.selectedMapSourceRequirement ? (
                <p className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-slate-600">
                  This source uses <code>{mapState.selectedMapSourceRequirement}</code>.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function SelectedFeatureCard({
  onDelete,
  onExport,
  selectedFeature,
  selectedFeatureLength,
  selectedVertexDistanceFromStart,
  selectedVertexIndex,
  selectedVerticesCount,
}: {
  onDelete: () => void;
  onExport: () => void;
  selectedFeature: Feature<DatasetGeometry>;
  selectedFeatureLength: string | null;
  selectedVertexDistanceFromStart: string | null;
  selectedVertexIndex: number | null;
  selectedVerticesCount: number;
}) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-slate-600">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Selected</p>
      <p className="mt-2 font-medium text-slate-900">{selectedFeature.geometry.type}</p>
      <p className="mt-1">Vertices: {selectedVerticesCount}</p>
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
        <Button className="flex-1" onClick={onExport} variant="secondary">
          Export
        </Button>
        <Button className="flex-1" onClick={onDelete} variant="ghost">
          Delete
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

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-pressed={active}
      className="justify-between rounded-2xl px-4 py-3"
      onClick={onClick}
      type="button"
      variant={active ? "primary" : "secondary"}
    >
      <span>{label}</span>
      <span className="text-xs uppercase tracking-[0.16em]">{active ? "On" : "Off"}</span>
    </Button>
  );
}
