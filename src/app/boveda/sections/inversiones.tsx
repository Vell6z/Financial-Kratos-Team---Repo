"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/feedback";
import { Badge, Button, Card, EmptyState, Stat, fmtDate } from "@/components/ui";
import { fmtRate, LEVELS } from "@/lib/config";
import { cop } from "@/lib/finance";
import { walletLabel } from "@/lib/validators";
import { fmtDateTime, type AdminAction, type State } from "../types";

export function InvestmentsSection({ state, busy, act }: { state: State; busy: boolean; act: AdminAction }) {
  const [toCancel, setToCancel] = useState<State["recurring"][number] | null>(null);
  const [reason, setReason] = useState("");
  const investors = [...new Set(state.positions.map((p) => p.wallet))];
  const total = state.positions.reduce((s, p) => s + p.balance, 0);
  const deposited = state.positions.reduce((s, p) => s + p.deposited - p.withdrawn, 0);

  return (
    <div className="space-y-4">
      <Card className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <Stat label="Saldo de las cajitas" value={cop(total)} />
        <Stat label="Rendimiento acumulado" value={<span className="text-mint">{cop(total - deposited)}</span>} sub="Rentabilidad esperada, no garantizada" />
        <Stat label="Inversionistas" value={investors.length} />
        <Stat label="Recurrentes activas" value={state.recurring.filter((r) => r.status === "activa").length} sub={`${state.recurring.filter((r) => r.status === "pausada").length} pausada(s)`} />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Cajitas por inversionista</h2>
        {state.positions.length === 0 ? (
          <EmptyState title="Sin cajitas todavía" description="Cuando alguien invierta, aquí verás su saldo por nivel." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1">Inversionista</th>
                  <th>Cajita</th>
                  <th className="text-right">Aportado neto</th>
                  <th className="text-right">Saldo</th>
                  <th className="text-right">Próximo vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {state.positions
                  .slice()
                  .sort((a, b) => b.balance - a.balance)
                  .map((p) => (
                    <tr key={p.id} className="border-t border-line">
                      <td className="py-2">
                        <div className="font-medium">{p.owner ?? "—"}</div>
                        <div className="max-w-56 truncate text-xs text-muted">{walletLabel(p.wallet)}</div>
                      </td>
                      <td className="whitespace-nowrap">
                        {LEVELS[p.level].name} · {fmtRate(LEVELS[p.level].investorRateEA)}
                      </td>
                      <td className="text-right">{cop(p.deposited - p.withdrawn)}</td>
                      <td className="text-right font-semibold">{cop(p.balance)}</td>
                      <td className="whitespace-nowrap text-right text-muted">{p.nextMaturity ? fmtDate(p.nextMaturity) : "Todo vencido"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Inversiones recurrentes</h2>
        {state.recurring.length === 0 ? (
          <p className="text-sm text-muted">Nadie tiene inversiones recurrentes activas.</p>
        ) : (
          <ul className="divide-y divide-line">
            {state.recurring.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <div className="font-medium">
                    {r.owner ?? walletLabel(r.wallet)} · {r.debit ? `${r.debit.value.toLocaleString("es-CO")} ${r.debit.assetCode}` : cop(r.amountCop)} {r.intervalLabel}
                  </div>
                  <div className="text-xs text-muted">
                    {LEVELS[r.level].name} · {r.mode} · {r.runs} cobro(s){r.nextRunAt ? ` · próximo ${fmtDateTime(r.nextRunAt)}` : ""}
                    {r.lastError ? ` · ${r.lastError}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={r.status === "activa" ? "good" : "warn"}>{r.status === "activa" ? "Activa" : "Pausada"}</Badge>
                  <Button variant="ghost" disabled={busy} onClick={() => setToCancel(r)}>
                    Cancelar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={toCancel !== null}
        title="¿Cancelar la inversión recurrente?"
        confirmLabel="Cancelar inversión"
        danger
        loading={busy}
        onConfirm={async () => {
          if (!toCancel || !reason.trim()) return;
          if (await act({ action: "cancel-recurring", recurringId: toCancel.id, reason }, { title: "Inversión recurrente cancelada", text: "Se revocó el permiso en la wallet del inversionista." })) {
            setToCancel(null);
            setReason("");
          }
        }}
        onCancel={() => (setToCancel(null), setReason(""))}
      >
        <div className="space-y-3">
          <p>No habrá más cobros y se revoca el permiso en la wallet. Lo ya invertido sigue en su cajita.</p>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground">Motivo (obligatorio)</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={200}
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Queda en la bitácora de auditoría"
            />
          </label>
        </div>
      </ConfirmDialog>
    </div>
  );
}
