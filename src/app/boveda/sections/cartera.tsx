"use client";

import { useEffect, useState } from "react";
import { Badge, Card, EmptyState, Input, Spinner, api, fmtDate } from "@/components/ui";
import { CREDIT_PURPOSES, LEVELS, type Level } from "@/lib/config";
import { cop } from "@/lib/finance";
import { fmtDateTime, type AuditEventView, type InstallmentState, type LoanRow, type State } from "../types";
import { AuditList } from "./auditoria";

type Filter = "todos" | "activos" | "mora" | "castigados" | "espera" | "pagados" | "cancelados";
const FILTERS: { id: Filter; label: string; test: (l: LoanRow) => boolean }[] = [
  { id: "todos", label: "Todos", test: () => true },
  { id: "activos", label: "Activos", test: (l) => l.status === "activo" },
  { id: "mora", label: "En mora", test: (l) => l.status === "activo" && l.overdue },
  { id: "castigados", label: "Castigados", test: (l) => Boolean(l.chargedOffAt) },
  { id: "espera", label: "En espera", test: (l) => l.status === "en_espera" },
  { id: "pagados", label: "Pagados", test: (l) => l.status === "pagado" },
  { id: "cancelados", label: "No desembolsados", test: (l) => l.status === "cancelado" },
];

const STATE_BADGE: Record<InstallmentState, { label: string; tone: "neutral" | "good" | "warn" | "bad" }> = {
  PENDIENTE: { label: "Pendiente", tone: "neutral" },
  POR_PAGAR: { label: "Por pagar", tone: "warn" },
  PAGADA: { label: "A tiempo", tone: "good" },
  EN_MORA: { label: "En mora", tone: "bad" },
  PAGADA_CON_MORA: { label: "Pagada tarde", tone: "warn" },
};

const DISBURSEMENT_LABEL: Record<string, string> = {
  CREDIT_APPROVED: "Crédito aprobado",
  BREB_KEY_VERIFIED: "Llave Bre-B verificada",
  USER_CONFIRMED_BENEFICIARY: "Beneficiario confirmado",
  TREASURY_DEBITED: "Capital reservado del pool",
  PAYOUT_SUBMITTED: "Payout armado (simulado)",
  DISBURSED: "Desembolsado",
  BREB_KEY_REJECTED: "Llave rechazada al desembolsar",
};

function LoanStatus({ l }: { l: LoanRow }) {
  if (l.chargedOffAt && l.status === "activo") return <Badge tone="bad">Castigado · {l.daysLate} d</Badge>;
  if (l.status === "activo")
    return l.overdue ? (
      <Badge tone="bad">Mora · {l.daysLate} d</Badge>
    ) : l.schedule.some((i) => i.state === "POR_PAGAR") ? (
      <Badge tone="warn">Cuota por pagar</Badge>
    ) : (
      <Badge tone="good">Al día</Badge>
    );
  if (l.status === "pagado") return <Badge tone="good">Pagado</Badge>;
  if (l.status === "en_espera") return <Badge tone="warn">En espera</Badge>;
  return <Badge>No desembolsado</Badge>;
}

export function PortfolioSection({ state }: { state: State }) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [level, setLevel] = useState<Level | 0>(0);
  const [text, setText] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const q = text.trim().toLowerCase();
  const rows = state.loans
    .filter(FILTERS.find((f) => f.id === filter)!.test)
    .filter((l) => !level || l.level === level)
    .filter((l) => !q || [l.id, l.name, l.cedula].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Input label="Buscar" placeholder="Titular, cédula o número de crédito" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Nivel</span>
            <select value={level} onChange={(e) => setLevel(Number(e.target.value) as Level | 0)} className="min-h-11 rounded-lg border border-line bg-background px-3 text-sm">
              <option value={0}>Todos</option>
              {([1, 2, 3] as Level[]).map((l) => (
                <option key={l} value={l}>
                  {LEVELS[l].name}
                </option>
              ))}
            </select>
          </label>
          <a href="/api/admin/export?tipo=cartera" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium hover:border-brand/50">
            Exportar CSV
          </a>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Estado del crédito">
          {FILTERS.map((f) => {
            const n = state.loans.filter(f.test).length;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`min-h-9 rounded-full px-3 text-sm transition ${filter === f.id ? "bg-brand text-white" : "border border-line text-muted hover:text-foreground"}`}
              >
                {f.label} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="Sin créditos con este filtro" description="Cambia el filtro o la búsqueda." />
      ) : (
        <ul className="space-y-2">
          {rows.map((l) => (
            <li key={l.id}>
              <Card className="p-0">
                <button type="button" className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left sm:px-5" onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}>
                  <div className="min-w-0">
                    <div className="font-medium">
                      {l.name} <span className="text-sm font-normal text-muted">· CC {l.cedula}</span>
                    </div>
                    <div className="text-xs text-muted">
                      N.º {l.id} · {LEVELS[l.level].name} · {cop(l.amount)} en {l.installments} cuotas · {l.paidCount}/{l.installments} pagadas
                      {l.disbursedAt ? ` · desembolso ${fmtDate(l.disbursedAt)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {l.status === "activo" && <span className="text-sm font-semibold tabular-nums">Saldo {cop(l.owed)}</span>}
                    <LoanStatus l={l} />
                    <span className={`text-xs text-muted transition ${open === l.id ? "rotate-180" : ""}`} aria-hidden="true">
                      ▾
                    </span>
                  </div>
                </button>
                {open === l.id && <LoanDetail l={l} />}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LoanDetail({ l }: { l: LoanRow }) {
  const [events, setEvents] = useState<AuditEventView[] | null>(null);
  useEffect(() => {
    api<{ events: AuditEventView[] }>(`/api/admin/audit?entidad=${encodeURIComponent(`credito:${l.id}`)}`)
      .then((r) => setEvents(r.events))
      .catch(() => setEvents([]));
  }, [l.id]);

  return (
    <div className="grid gap-5 border-t border-line px-4 py-4 sm:px-5 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a href={`/api/loans/${l.id}/plan`} target="_blank" rel="noopener" className="font-medium text-brand hover:underline">
            Plan de pagos (PDF)
          </a>
          {l.disbursementTxId && (
            <a href={`/api/receipts/${l.disbursementTxId}`} target="_blank" rel="noopener" className="font-medium text-brand hover:underline">
              Comprobante de desembolso
            </a>
          )}
          {l.status === "pagado" && (
            <a href={`/api/loans/${l.id}/paz-y-salvo`} target="_blank" rel="noopener" className="font-medium text-brand hover:underline">
              Paz y salvo
            </a>
          )}
        </div>
        <dl className="grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
          <dt className="text-muted">Destino</dt>
          <dd>{CREDIT_PURPOSES.find((p) => p.id === l.purpose)?.title ?? "—"}</dd>
          {l.payout && (
            <>
              <dt className="text-muted">Desembolso a</dt>
              <dd>
                {l.payout.key} · {l.payout.bank} · {l.payout.directory}
              </dd>
            </>
          )}
          {l.disbursement?.rejectedReason && (
            <>
              <dt className="text-muted">Rechazo</dt>
              <dd className="text-red-600 dark:text-red-400">{l.disbursement.rejectedReason}</dd>
            </>
          )}
          {l.creditReport && l.creditReport.status !== "al_dia" && (
            <>
              <dt className="text-muted">Centrales (simulado)</dt>
              <dd>
                {l.creditReport.status === "aviso" ? `Aviso previo ${fmtDate(l.creditReport.noticeAt)}` : l.creditReport.status === "en_mora" ? `Reportado en mora ${fmtDate(l.creditReport.reportedAt!)}` : "Pagada después de mora"}
              </dd>
            </>
          )}
        </dl>

        {l.disbursement && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Estados del desembolso</h3>
            <ol className="space-y-1.5 border-l border-line pl-4 text-sm">
              {l.disbursement.history.map((h, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${h.state === "BREB_KEY_REJECTED" ? "bg-red-500" : "bg-brand"}`} aria-hidden="true" />
                  {DISBURSEMENT_LABEL[h.state] ?? h.state} <span className="text-xs text-muted">· {fmtDateTime(h.at)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {l.schedule.length > 0 && l.disbursedAt && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1">#</th>
                  <th>Vence</th>
                  <th className="text-right">Cuota</th>
                  <th className="text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {l.schedule.map((i) => (
                  <tr key={i.n} className="border-t border-line">
                    <td className="py-1.5 text-muted">{i.n}</td>
                    <td className="whitespace-nowrap">{fmtDate(i.dueAt)}</td>
                    <td className="text-right">{cop(i.payment)}</td>
                    <td className="whitespace-nowrap text-right">
                      <Badge tone={STATE_BADGE[i.state].tone}>
                        {STATE_BADGE[i.state].label}
                        {i.daysLate > 3 ? ` · ${i.daysLate} d` : ""}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Trazabilidad del crédito</h3>
        {events === null ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Cargando…
          </p>
        ) : (
          <AuditList events={events} compact />
        )}
      </div>
    </div>
  );
}
