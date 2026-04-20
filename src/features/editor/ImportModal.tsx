import {
  IconClipboardText,
  IconFileImport,
  IconJson,
  IconRoute2,
  IconUpload,
  IconGps,
} from "@tabler/icons-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/Button";

export type ImportFormat = "auto" | "geojson" | "gpx" | "polyline";

type ImportModalSubmitPayload =
  | {
      format: "auto" | "geojson" | "gpx";
      sourceName: string;
      text: string;
    }
  | {
      format: "polyline";
      precision: 5 | 6;
      sourceName: string;
      text: string;
    };

type ImportModalProps = {
  onClose: () => void;
  onImportText: (payload: ImportModalSubmitPayload) => void;
};

const IMPORT_FORMAT_OPTIONS: Array<{
  description: string;
  icon: typeof IconClipboardText;
  label: string;
  value: ImportFormat;
}> = [
  {
    value: "auto",
    label: "Auto Detect",
    description: "Best for GeoJSON and GPX from paste or dropped files.",
    icon: IconFileImport,
  },
  {
    value: "geojson",
    label: "GeoJSON",
    description: "FeatureCollection, Feature, geometry, or raw JSON geometry.",
    icon: IconJson,
  },
  {
    value: "gpx",
    label: "GPX",
    description: "Waypoints, routes, and tracks from GPX XML.",
    icon: IconGps,
  },
  {
    value: "polyline",
    label: "Polyline",
    description: "Encoded polyline string like Strava or polyline6 exports.",
    icon: IconRoute2,
  },
];

export function ImportModal({ onClose, onImportText }: ImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [format, setFormat] = useState<ImportFormat>("auto");
  const [polylinePrecision, setPolylinePrecision] = useState<5 | 6>(5);
  const [isDropActive, setIsDropActive] = useState(false);

  function submitImport(sourceName: string, text: string, nextFormat = format) {
    const trimmedText = text.trim();

    if (!trimmedText || !looksImportable(trimmedText, nextFormat)) {
      return;
    }

    if (nextFormat === "polyline") {
      onImportText({
        format: nextFormat,
        precision: polylinePrecision,
        sourceName,
        text: trimmedText,
      });
      return;
    }

    onImportText({
      format: nextFormat,
      sourceName,
      text: trimmedText,
    });
  }

  function importFromFile(file: File) {
    const normalizedName = file.name.toLowerCase();
    const nextFormat =
      normalizedName.endsWith(".gpx")
        ? "gpx"
        : normalizedName.endsWith(".geojson") || normalizedName.endsWith(".json")
          ? "geojson"
          : format;

    if (nextFormat !== format) {
      setFormat(nextFormat);
    }

    void file.text().then((content) => {
      submitImport(file.name, content, nextFormat);
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDropActive(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      importFromFile(file);
      return;
    }

    const droppedText = event.dataTransfer.getData("text/plain");

    if (droppedText.trim()) {
      submitImport("dropped-text", droppedText);
    }
  }

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const clipboardData = event.clipboardData;

      if (!clipboardData) {
        return;
      }

      const file = clipboardData.files?.[0];

      if (file) {
        event.preventDefault();
        importFromFile(file);
        return;
      }

      const pastedText = clipboardData.getData("text/plain");

      if (!pastedText.trim() || !looksImportable(pastedText, format)) {
        return;
      }

      event.preventDefault();
      submitImport("clipboard", pastedText);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [format, polylinePrecision]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-40 bg-slate-950/20 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        aria-modal="true"
        className="mx-auto mt-10 w-full max-w-3xl rounded-[30px] border border-sky-100 bg-white/95 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-slate-950">Import Geometry</p>
            <p className="mt-1 text-sm text-slate-500">
              Pick a format, then paste, drop, or choose a file. Valid content imports immediately.
            </p>
          </div>
          <Button className="h-10 w-10 rounded-full px-0" onClick={onClose} variant="ghost">
            ×
          </Button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.45fr]">
          <section>
            <div className="rounded-[24px] border border-sky-100 bg-slate-100/80 p-4">
              <p className="text-sm font-medium text-slate-800">Import Format</p>
              <div className="mt-3 grid gap-2">
                {IMPORT_FORMAT_OPTIONS.map((option) => {
                  const Icon = option.icon;

                  return (
                    <button
                      className={`cursor-pointer rounded-2xl border px-3 py-3 text-left transition ${
                        format === option.value
                          ? "border-sky-300 bg-white shadow-sm"
                          : "border-transparent bg-white/90 hover:border-sky-200 hover:bg-white"
                      }`}
                      key={option.value}
                      onClick={() => setFormat(option.value)}
                      type="button"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                            format === option.value ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Icon size={17} stroke={1.9} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-900">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            {option.description}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {format === "polyline" ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-amber-900">Polyline Precision</p>
                    <div className="inline-flex rounded-full border border-amber-200 bg-white p-1">
                      {[5, 6].map((value) => (
                        <button
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            polylinePrecision === value
                              ? "bg-amber-500 text-white"
                              : "text-amber-800 hover:bg-amber-50"
                          }`}
                          key={value}
                          onClick={() => setPolylinePrecision(value as 5 | 6)}
                          type="button"
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-amber-800/80">
                    Strava and classic encoded polyline usually use 5. Polyline6 sources use 6.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[24px] border border-sky-100 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div
              className={`rounded-[26px] border border-dashed p-6 transition ${
                isDropActive
                  ? "border-sky-400 bg-sky-50 shadow-[0_16px_40px_rgba(14,165,233,0.14)]"
                  : "border-sky-200 bg-linear-to-br from-sky-50 via-white to-slate-50"
              }`}
              onDragEnter={() => setIsDropActive(true)}
              onDragLeave={() => setIsDropActive(false)}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDropActive(true);
              }}
              onDrop={handleDrop}
            >
              <div className="flex items-start gap-4">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm">
                  <IconUpload size={22} stroke={1.9} />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-900">Drop file or text here</p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    Paste, drop, or choose a file and valid content will import immediately. Supports `.geojson`, `.json`, `.gpx`, and encoded polyline strings.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      className="rounded-2xl px-4 py-2"
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                      variant="secondary"
                    >
                      Choose File
                    </Button>
                    <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                      Paste imports instantly
                    </span>
                  </div>
                  <input
                    accept=".geojson,.json,.gpx,application/geo+json,application/json,application/gpx+xml,text/plain"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (file) {
                        importFromFile(file);
                      }

                      event.target.value = "";
                    }}
                    ref={fileInputRef}
                    type="file"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-slate-900">Format Behavior</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                `Auto Detect` accepts GeoJSON and GPX. Switch to `Polyline` before pasting encoded route strings.
              </p>
              <p className="text-sm leading-6 text-slate-500">Invalid paste is ignored. Successful import will fit the map to the new geometry.</p>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <Button onClick={onClose} type="button" variant="secondary">
                Close
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function looksImportable(text: string, format: ImportFormat) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return false;
  }

  if (format === "polyline") {
    return true;
  }

  if (format === "gpx") {
    return trimmedText.startsWith("<?xml") || trimmedText.startsWith("<gpx");
  }

  if (format === "geojson") {
    return trimmedText.startsWith("{") || trimmedText.startsWith("[");
  }

  return (
    trimmedText.startsWith("<?xml") ||
    trimmedText.startsWith("<gpx") ||
    trimmedText.startsWith("{") ||
    trimmedText.startsWith("[")
  );
}
