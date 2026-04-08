import { useState } from "react";
import { Button } from "@/components/Button";

type LineAdjustModalProps = {
  initialCompressionRatio: number;
  onApplyCompression: (compressionRatio: number) => void;
  onClose: () => void;
  onReverseDirection: () => void;
};

export function LineAdjustModal({
  initialCompressionRatio,
  onApplyCompression,
  onClose,
  onReverseDirection,
}: LineAdjustModalProps) {
  const [compressionRatio, setCompressionRatio] = useState(initialCompressionRatio);

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
            <p className="text-lg font-semibold text-slate-950">Adjust Route</p>
            <p className="mt-1 text-sm text-slate-500">Reverse direction or simplify points with RDP.</p>
          </div>
          <Button className="h-10 w-10 rounded-full px-0" onClick={onClose} variant="ghost">
            ×
          </Button>
        </div>

        <div className="mt-5 space-y-5">
          <section className="rounded-2xl border border-sky-100 bg-slate-50/80 p-4">
            <p className="text-sm font-medium text-slate-800">Direction</p>
            <p className="mt-1 text-sm text-slate-500">Swap the route start and finish by reversing vertex order.</p>
            <Button className="mt-3 w-full justify-center rounded-2xl px-4 py-3" onClick={onReverseDirection} variant="secondary">
              Reverse Direction
            </Button>
          </section>

          <section className="rounded-2xl border border-sky-100 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-800">RDP Simplify</p>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                {Math.round(compressionRatio * 100)}%
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Choose how aggressively to reduce points.</p>
            <input
              className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-sky-100 accent-sky-500"
              max={95}
              min={0}
              onChange={(event) => setCompressionRatio(Number(event.target.value) / 100)}
              step={5}
              type="range"
              value={Math.round(compressionRatio * 100)}
            />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>Keep most points</span>
              <span>Compress harder</span>
            </div>
            <Button
              className="mt-4 w-full justify-center rounded-2xl px-4 py-3"
              onClick={() => onApplyCompression(compressionRatio)}
              variant="primary"
            >
              Apply Simplification
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
