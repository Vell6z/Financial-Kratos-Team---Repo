"use client";

import { useState } from "react";
import { Badge, Card, EmptyState, Input } from "@/components/ui";
import { LEVELS, type Level } from "@/lib/config";
import { cop } from "@/lib/finance";
import { fmtDateTime, TX_KIND, type State } from "../types";

const PAGE = 50;

export function TransactionsSection({ state }: { state: State }) {
  const [kind, setKind] = useState("");
  const [level, setLevel] = useState<Level | 0>(0);
  const [text, setText] = useState("");
  const [shown, setShown] = useState(PAGE);
  const q = text.trim().toLowerCase();
  const rows = state.txs
    .filter((t) => !kind || t.kind === kind)
    .filter((t) => !level || t.level === level)
    .filter((t) => !q || [t.id, t.detail].some((s) => s.toLowerCase().includes(q)));
  const total = (k: string) => rows.filter((t) => t.kind === k).reduce((s, t) => s + t.amountCop, 0);

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Input label="Buscar" placeholder="Nombre, wallet, llave, referencia…" value={text} onChange={(e) => (setText(e.target.value), setShown(PAGE))} />
          </div>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Tipo</span>
            <select value={kind} onChange={(e) => (setKind(e.target.value), setShown(PAGE))} className="min-h-11 rounded-lg border border-line bg-background px-3 text-sm">
              <option value="">Todos</option>
              {Object.entries(TX_KIND).map(([id, k]) => (
                <option key={id} value={id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
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
          <a href="/api/admin/export?tipo=movimientos" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium hover:border-brand/50">
            Exportar CSV
          </a>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
          <span>{rows.length} movimiento(s)</span>
          <span>Inversiones {cop(total("deposito_ilp"))}</span>
          <span>Retiros {cop(total("retiro_ilp"))}</span>
          <span>Desembolsos {cop(total("desembolso_breb"))}</span>
          <span>Pagos {cop(total("pago_breb"))}</span>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="Sin movimientos" description="Cambia los filtros o la búsqueda." />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {rows.slice(0, shown).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{TX_KIND[t.kind]?.label ?? t.kind}</div>
                  <div className="truncate text-xs text-muted" title={t.detail}>
                    {fmtDateTime(t.at)} · {LEVELS[t.level].name} · {t.detail}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={t.mode === "interledger" ? "good" : "neutral"}>{t.mode}</Badge>
                  {t.hasReceipt && (
                    <a href={`/api/receipts/${t.id}`} target="_blank" rel="noopener" className="text-xs font-medium text-brand hover:underline">
                      PDF
                    </a>
                  )}
                  <span className="font-semibold tabular-nums">
                    {TX_KIND[t.kind]?.sign} {cop(t.amountCop)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {rows.length > shown && (
            <button type="button" className="w-full border-t border-line py-3 text-sm font-medium text-brand hover:underline" onClick={() => setShown(shown + PAGE)}>
              Ver {Math.min(PAGE, rows.length - shown)} más
            </button>
          )}
        </Card>
      )}
    </div>
  );
}
