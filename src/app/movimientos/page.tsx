"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, EmptyState, PageHeader, Spinner, Stat, api, fmtDate } from "@/components/ui";
import { LEVELS, type Level } from "@/lib/config";
import { cop } from "@/lib/finance";

interface Item {
  id: string;
  at: number;
  kind: "deposito_ilp" | "retiro_ilp" | "desembolso_breb" | "pago_breb";
  level: Level;
  amountCop: number;
  mode: string;
  hasReceipt: boolean;
  /** Llegó solo una parte de lo pedido */
  partial: boolean;
}

/** Cómo ve cada movimiento el propio usuario: entra (+) o sale (−) de su bolsillo */
const VIEW: Record<Item["kind"], { label: string; via: string; sign: "+" | "−" }> = {
  deposito_ilp: { label: "Inversión", via: "Interledger", sign: "−" },
  retiro_ilp: { label: "Retiro a tu wallet", via: "Interledger", sign: "+" },
  desembolso_breb: { label: "Desembolso recibido", via: "Bre-B", sign: "+" },
  pago_breb: { label: "Pago de cuota", via: "Bre-B", sign: "−" },
};

type Filter = "todos" | "entradas" | "salidas";

export default function MovementsPage() {
  const [data, setData] = useState<{ role: "inversor" | "acreditado"; items: Item[] } | null>(null);
  const [filter, setFilter] = useState<Filter>("todos");

  useEffect(() => {
    api<{ role: "inversor" | "acreditado"; items: Item[] }>("/api/movements").then(setData).catch(() => {});
  }, []);

  if (!data)
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner /> Cargando tus movimientos…
      </p>
    );

  const sum = (kind: Item["kind"]) => data.items.filter((i) => i.kind === kind).reduce((s, i) => s + i.amountCop, 0);
  const shown = data.items.filter((i) => filter === "todos" || (filter === "entradas" ? VIEW[i.kind].sign === "+" : VIEW[i.kind].sign === "−"));
  const investor = data.role === "inversor";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={investor ? "Inversionista" : "Acreditado"}
        title="Movimientos"
        description={investor ? "Tus inversiones y retiros por Interledger." : "Tus desembolsos y pagos de cuotas por Bre-B."}
      />

      <Card className="grid grid-cols-2 gap-6">
        {investor ? (
          <>
            <Stat label="Total invertido" value={cop(sum("deposito_ilp"))} />
            <Stat label="Total retirado" value={cop(sum("retiro_ilp"))} />
          </>
        ) : (
          <>
            <Stat label="Total recibido" value={cop(sum("desembolso_breb"))} />
            <Stat label="Total pagado" value={cop(sum("pago_breb"))} />
          </>
        )}
      </Card>

      {data.items.length === 0 ? (
        <EmptyState
          title="Aún no tienes movimientos"
          description={investor ? "Cuando inviertas o retires, lo verás aquí." : "Cuando recibas tu crédito o pagues una cuota, lo verás aquí."}
          action={
            <Link href={investor ? "/invertir" : "/credito"} className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
              {investor ? "Hacer una inversión" : "Pedir un crédito"}
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-card">
          <div className="flex gap-2 border-b border-line p-3" role="tablist" aria-label="Filtrar movimientos">
            {(["todos", "entradas", "salidas"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`min-h-9 rounded-full px-3 text-sm capitalize transition ${filter === f ? "bg-brand text-white" : "text-muted hover:text-foreground"}`}
              >
                {f}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">No hay movimientos con este filtro.</p>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((i) => {
                const v = VIEW[i.kind];
                const incoming = v.sign === "+";
                return (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        incoming ? "bg-mint/15 text-mint" : "bg-brand-soft text-brand-strong"
                      }`}
                      aria-hidden="true"
                    >
                      {incoming ? "↓" : "↑"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-snug">{v.label}</div>
                      <div className="text-xs text-muted">{fmtDate(i.at)}</div>
                      <div className="text-[11px] text-muted">
                        {LEVELS[i.level].name} · vía {v.via}
                        {i.partial && " · llegó una parte"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-sm font-semibold tabular-nums ${incoming ? "text-mint" : ""}`}>
                        {v.sign} {cop(i.amountCop)}
                      </div>
                      {i.hasReceipt && (
                        <a href={`/api/receipts/${i.id}`} target="_blank" rel="noopener" className="text-xs font-medium text-brand hover:underline">
                          Comprobante PDF
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
