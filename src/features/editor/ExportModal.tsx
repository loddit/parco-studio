import type { FormEvent } from "react";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";

export type ExportFormat = "geojson" | "gpx";

type ExportModalProps = {
  canExportGpx: boolean;
  fileName: string;
  onClose: () => void;
  onFileNameChange: (value: string) => void;
  onExport: (format: ExportFormat) => void;
};

export function ExportModal({
  canExportGpx,
  fileName,
  onClose,
  onFileNameChange,
  onExport,
}: ExportModalProps) {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-40 bg-slate-950/20 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        aria-modal="true"
        className="mx-auto mt-16 w-full max-w-md rounded-[28px] border border-sky-100 bg-white/95 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-slate-950">Export Feature</p>
            <p className="mt-1 text-sm text-slate-500">Rename the file and click a format.</p>
          </div>
          <Button className="h-10 w-10 rounded-full px-0" onClick={onClose} variant="ghost">
            ×
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">File Name</p>
            <TextInput
              autoFocus
              onChange={(event) => onFileNameChange(event.target.value)}
              placeholder="feature-name"
              value={fileName}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Export as</p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                className="justify-center rounded-2xl px-4 py-3"
                onClick={() => onExport("geojson")}
                type="button"
                variant="primary"
              >
                <span>GeoJSON</span>
              </Button>
              <Button
                className="justify-center rounded-2xl px-4 py-3"
                disabled={!canExportGpx}
                onClick={() => onExport("gpx")}
                type="button"
                variant="primary"
              >
                <span>GPX</span>
              </Button>
              <Button
                className="justify-center rounded-2xl px-4 py-3"
                disabled={!canExportGpx}
                onClick={onClose}
                type="button"
                variant="secondary"
              >
                <span>Cancel</span>
              </Button>
 
            </div>
            {!canExportGpx ? (
              <p className="mt-2 text-xs text-slate-400">GPX only works for lines.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
