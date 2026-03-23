import {
  IconPoint,
  IconPointer,
  IconVectorSpline,
  IconVectorTriangle,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/Button";
import type { Feature, LineString } from "geojson";
import type { DatasetGeometry } from "@/types/dataset";
import { getModeDescription } from "./editor-helpers";
import type { EditorMode } from "./editor-types";

type EditorSidebarProps = {
  datasetName: string;
  draftCount: number;
  featureCount: number;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  isDirty: boolean;
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
  return (
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
          {datasetName}
        </h1>
      </div>

      <input
        accept=".geojson,.json,application/geo+json,application/json"
        className="hidden"
        onChange={(event) => void onImportFileChange(event)}
        ref={importInputRef}
        type="file"
      />

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

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-slate-700">Mode</p>
        <div className="grid grid-cols-4 gap-2">
          <ModeButton
            active={mode === "select"}
            icon={IconPointer}
            label="Select"
            onClick={() => onModeChange("select")}
          />
          <ModeButton
            active={mode === "draw-point"}
            icon={IconPoint}
            label="Point"
            onClick={() => onModeChange("draw-point")}
          />
          <ModeButton
            active={mode === "draw-line"}
            icon={IconVectorSpline}
            label="LineString"
            onClick={() => onModeChange("draw-line")}
          />
          <ModeButton
            active={mode === "draw-polygon"}
            icon={IconVectorTriangle}
            label="Polygon"
            onClick={() => onModeChange("draw-polygon")}
          />
        </div>
      </div>

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
