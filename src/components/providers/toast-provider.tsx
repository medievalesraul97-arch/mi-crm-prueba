"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ToastData {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastApi {
  showToast: (toast: Omit<ToastData, "id">, duration?: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const showToast = useCallback(
    (t: Omit<ToastData, "id">, duration = 3800) => {
      clearTimer();
      idRef.current += 1;
      setToast({ ...t, id: idRef.current });
      timer.current = setTimeout(() => setToast(null), duration);
    },
    [clearTimer],
  );

  // Limpiar el temporizador al desmontar.
  useEffect(() => clearTimer, [clearTimer]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 md:bottom-6">
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg"
          >
            <span className="text-sm text-text">{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                className="shrink-0 rounded-md text-sm font-semibold text-primary"
                onClick={() => {
                  toast.onAction?.();
                  dismiss();
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
