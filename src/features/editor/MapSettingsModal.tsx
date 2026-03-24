import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import type { EditorMapActions, EditorMapState } from "./useEditorMapState";

type MapSettingsModalProps = {
  isOpen: boolean;
  mapActions: Pick<EditorMapActions, "setBearingEnabled" | "setMapSource" | "setPitchEnabled">;
  mapState: Pick<
    EditorMapState,
    | "isBearingEnabled"
    | "isPitchEnabled"
    | "mapSource"
    | "mapSourceOptions"
    | "selectedMapSourceRequirement"
  >;
  onClose: () => void;
};

export function MapSettingsModal({ isOpen, mapActions, mapState, onClose }: MapSettingsModalProps) {
  if (!isOpen) {
    return null;
  }

  const canControlInteraction = mapState.mapSource === "mapbox";

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-40 bg-slate-950/10 backdrop-blur-[1px]"
      onClick={onClose}
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
          <Button className="h-10 w-10 rounded-full px-0" onClick={onClose} variant="ghost">
            Close
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
          {canControlInteraction ? (
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
          ) : null}
          {mapState.selectedMapSourceRequirement ? (
            <p className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-slate-600">
              This source uses <code>{mapState.selectedMapSourceRequirement}</code>.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      aria-pressed={active}
      className="justify-between rounded-2xl px-4 py-3"
      onClick={onClick}
      disabled={disabled}
      type="button"
      variant={active ? "primary" : "secondary"}
    >
      <span>{label}</span>
      <span className="text-xs uppercase tracking-[0.16em]">{active ? "On" : "Off"}</span>
    </Button>
  );
}
