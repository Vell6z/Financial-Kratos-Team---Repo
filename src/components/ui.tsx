import type { ReactNode } from "react";

export { Choice, Input, MoneyInput, PasswordInput, Select } from "./fields";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-card p-5 ${className}`}>{children}</div>;
}

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger"; loading?: boolean }) {
  const styles = {
    primary: "bg-brand text-white hover:opacity-90",
    ghost: "border border-line text-foreground hover:bg-brand-soft",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium sm:min-h-0 transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}




export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const tones = {
    neutral: "bg-brand-soft text-foreground",
    good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    warn: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    bad: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export type Tone = "info" | "success" | "warning" | "error";

export const TONE_STYLES: Record<Tone, { box: string; icon: string }> = {
  info: { box: "border-[#959ff9]/40 bg-[#959ff9]/10", icon: "text-[#5560d6] dark:text-[#959ff9]" },
  success: { box: "border-mint/40 bg-mint/10", icon: "text-mint" },
  warning: { box: "border-orange/50 bg-orange/10", icon: "text-[#c27410] dark:text-orange" },
  error: { box: "border-red-400/50 bg-red-500/10", icon: "text-red-600 dark:text-red-400" },
};

const TONE_ICON: Record<Tone, string> = {
  info: "M12 16v-5M12 8h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  success: "M8 12.5l2.5 2.5L16 9.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  warning: "M12 9v4M12 17h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  error: "M15 9l-6 6M9 9l6 6M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
};

export function ToneIcon({ tone, className = "h-5 w-5" }: { tone: Tone; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d={TONE_ICON[tone]} />
    </svg>
  );
}

/** Aviso dentro de la página, con ícono, título opcional y acción opcional. */
export function Alert({
  children,
  tone = "info",
  title,
  action,
  onClose,
}: {
  children?: ReactNode;
  tone?: Tone;
  title?: ReactNode;
  action?: ReactNode;
  onClose?: () => void;
}) {
  const t = TONE_STYLES[tone];
  return (
    <div role={tone === "error" || tone === "warning" ? "alert" : "status"} className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${t.box}`}>
      <ToneIcon tone={tone} className={`mt-0.5 h-5 w-5 ${t.icon}`} />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={title ? "text-muted" : ""}>{children}</div>}
        {action && <div className="pt-1">{action}</div>}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Cerrar aviso" className="-mr-1 -mt-0.5 h-6 w-6 shrink-0 rounded text-muted hover:text-foreground">
          ×
        </button>
      )}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} aria-hidden="true" />;
}

/** Llama a la API. Con `body` hace POST (o el método indicado); si la sesión expiró, envía al login. */
export async function api<T>(url: string, body?: unknown, opts?: { method?: string; body?: unknown }): Promise<T> {
  const payload = opts?.body ?? body;
  const method = opts?.method ?? (payload === undefined ? "GET" : "POST");
  const res = await fetch(url, {
    method,
    cache: "no-store",
    ...(payload === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  });
  const data = await res.json();
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.assign(new URL(`/login?next=${encodeURIComponent(window.location.pathname)}`, window.location.origin));
  }
  if (!res.ok) throw new Error(data.error ?? "Error inesperado");
  return data as T;
}

export const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

/** Encabezado estándar de las pantallas internas */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        {eyebrow && <p className="text-xs font-medium uppercase tracking-widest text-mint">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="max-w-2xl text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Estado vacío con mensaje y acción */
export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
