"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, TONE_STYLES, ToneIcon, type Tone } from "./ui";

// ---------- Toasts (notificaciones flotantes) ----------

interface Toast {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

type Notify = (tone: Tone, title: string, description?: string) => void;

const ToastContext = createContext<Notify>(() => {});

/** `const toast = useToast(); toast("success", "Pago recibido", "detalle")` */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const notify = useCallback<Notify>(
    (tone, title, description) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-3), { id, tone, title, description }]);
      // Los errores y advertencias se quedan un poco más
      setTimeout(() => dismiss(id), tone === "error" || tone === "warning" ? 8000 : 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 top-16 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="toast-in pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl bg-card shadow-lg"
          >
            <div className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${TONE_STYLES[t.tone].box}`}>
            <ToneIcon tone={t.tone} className={`mt-0.5 h-5 w-5 ${TONE_STYLES[t.tone].icon}`} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{t.title}</div>
              {t.description && <div className="mt-0.5 text-muted">{t.description}</div>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Cerrar notificación" className="h-6 w-6 shrink-0 rounded text-muted hover:text-foreground">
              ×
            </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------- Diálogo de confirmación ----------

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirmar",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !loading && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && !loading && onCancel()}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="toast-in w-full max-w-sm space-y-4 rounded-2xl border border-line bg-card p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? "bg-red-500/10" : "bg-brand-soft"}`}>
            <ToneIcon tone={danger ? "warning" : "info"} className={danger ? "h-5 w-5 text-red-600 dark:text-red-400" : "h-5 w-5 text-brand-strong"} />
          </span>
          <h2 id="confirm-title" className="pt-2 text-lg font-semibold leading-tight">
            {title}
          </h2>
        </div>
        {children && <div className="text-sm text-muted">{children}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button ref={confirmRef} variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
