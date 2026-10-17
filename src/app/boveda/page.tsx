"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/feedback";
import { Badge, PageHeader, Spinner, api, fmtDate } from "@/components/ui";
import { AuditSection } from "./sections/auditoria";
import { PortfolioSection } from "./sections/cartera";
import { InvestmentsSection } from "./sections/inversiones";
import { TransactionsSection } from "./sections/movimientos";
import { SummarySection } from "./sections/resumen";
import { UsersSection } from "./sections/usuarios";
import type { AdminAction, State, TabId } from "./types";

// Panel del operador: secciones con pestañas (la elegida queda en la URL, ?seccion=…).
// Todas las acciones van a /api/admin y quedan en la bitácora de auditoría.

const TABS: { id: TabId; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "cartera", label: "Cartera" },
  { id: "usuarios", label: "Usuarios" },
  { id: "inversiones", label: "Inversiones" },
  { id: "movimientos", label: "Movimientos" },
  { id: "auditoria", label: "Auditoría" },
];

export default function VaultPage() {
  const [state, setState] = useState<State | null>(null);
  const [tab, setTab] = useState<TabId>("resumen");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(() => api<State>("/api/state").then(setState), []);

  // Sección inicial desde la URL y resultado de autorizar la bóveda al volver de la wallet
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("seccion");
    if (s && TABS.some((t) => t.id === s)) setTimeout(() => setTab(s as TabId), 0);
    const r = q.get("permiso");
    if (!r) return;
    if (r === "ok") toast("success", "Bóveda autorizada", "Los retiros de los inversionistas ahora salen automáticamente de la bóveda.");
    else if (r === "rechazado") toast("warning", "Autorización cancelada", "No se aprobó el permiso en la wallet de la bóveda.");
    else toast("error", "No se pudo autorizar la bóveda", q.get("msg") ?? "Intenta de nuevo.");
    window.history.replaceState(null, "", "/boveda");
  }, [toast]);

  // Se actualiza cada 10 s, siempre después de que termina la consulta anterior (con Supabase cada una tarda unos segundos)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = () =>
      void load()
        .catch(() => {})
        .finally(() => {
          if (!stopped) timer = setTimeout(tick, 10_000);
        });
    timer = setTimeout(tick, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [load]);

  function go(id: TabId) {
    setTab(id);
    window.history.replaceState(null, "", id === "resumen" ? "/boveda" : `/boveda?seccion=${id}`);
  }

  const act: AdminAction = async (body, done) => {
    setBusy(true);
    try {
      await api("/api/admin", body);
      await load();
      toast(done.tone ?? "success", done.title, done.text);
      return true;
    } catch (e) {
      toast("error", "No se pudo completar la acción", (e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!state)
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner /> Cargando el panel…
      </p>
    );

  const counts: Partial<Record<TabId, { n: number; tone: "warn" | "bad" }>> = {
    cartera: state.loans.some((l) => l.overdue) ? { n: state.loans.filter((l) => l.overdue).length, tone: "bad" } : undefined,
    usuarios: state.faceReviews.length ? { n: state.faceReviews.length, tone: "warn" } : undefined,
    auditoria: state.audit.broken ? { n: 1, tone: "bad" } : undefined,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Solo operador"
        title="Panel del operador"
        description={`Cartera, usuarios, inversiones, movimientos y bitácora de auditoría. Fecha de la demo: ${fmtDate(state.now)}${state.clockOffsetDays ? ` (+${state.clockOffsetDays} días)` : ""}.`}
        actions={<Badge tone={state.interledger ? "good" : "warn"}>{state.interledger ? "Open Payments conectado" : "Modo simulado"}</Badge>}
      />

      <nav className="-mx-4 overflow-x-auto px-4" aria-label="Secciones del panel">
        <div className="flex min-w-max gap-1 rounded-xl border border-line bg-card p-1" role="tablist">
          {TABS.map((t) => {
            const c = counts[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => go(t.id)}
                className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm transition ${tab === t.id ? "bg-brand font-medium text-white" : "text-muted hover:text-foreground"}`}
              >
                {t.label}
                {c && (
                  <span
                    className={`rounded-full px-1.5 text-[11px] font-semibold ${
                      tab === t.id ? "bg-white/25 text-white" : c.tone === "bad" ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {c.n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {tab === "resumen" && <SummarySection state={state} busy={busy} act={act} reload={load} go={go} />}
      {tab === "cartera" && <PortfolioSection state={state} />}
      {tab === "usuarios" && <UsersSection state={state} busy={busy} act={act} />}
      {tab === "inversiones" && <InvestmentsSection state={state} busy={busy} act={act} />}
      {tab === "movimientos" && <TransactionsSection state={state} />}
      {tab === "auditoria" && <AuditSection state={state} />}
    </div>
  );
}
