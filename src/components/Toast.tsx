import clsx from "clsx";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ShowToastOptions = {
  duration?: number;
  tone?: ToastTone;
};

type ToastContextValue = {
  dismissToast: (id: number) => void;
  showToast: (message: string, options?: ShowToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Array<ToastItem & { duration: number }>>([]);
  const nextToastIdRef = useRef(1);

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      dismissToast(id) {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      },
      showToast(message, options) {
        const id = nextToastIdRef.current;
        nextToastIdRef.current += 1;

        setToasts((current) => [
          ...current,
          {
            id,
            message,
            tone: options?.tone ?? "info",
            duration: options?.duration ?? 2500,
          },
        ]);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed top-4 z-50 flex w-full flex-col items-center gap-2">
        {toasts.map((toast) => (
          <ToastCard
            key={toast.id}
            duration={toast.duration}
            id={toast.id}
            message={toast.message}
            onDismiss={contextValue.dismissToast}
            tone={toast.tone}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }

  return context;
}

function ToastCard({
  duration,
  id,
  message,
  onDismiss,
  tone,
}: {
  duration: number;
  id: number;
  message: string;
  onDismiss: (id: number) => void;
  tone: ToastTone;
}) {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => onDismiss(id), duration);
    return () => window.clearTimeout(timeoutId);
  }, [duration, id, onDismiss]);

  return (
    <div
      className={clsx(
        "toast-enter pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur",
        tone === "success" && "border-emerald-200 bg-emerald-50/95 text-emerald-900",
        tone === "error" && "border-rose-200 bg-rose-50/95 text-rose-900",
        tone === "info" && "border-sky-200 bg-white/95 text-slate-700",
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1">{message}</p>
        <button
          aria-label="Dismiss toast"
          className="cursor-pointer rounded-full px-2 py-0.5 text-xs font-semibold opacity-60 transition hover:bg-black/5 hover:opacity-100"
          onClick={() => onDismiss(id)}
          type="button"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
