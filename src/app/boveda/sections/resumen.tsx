"use client";

import { useState } from "react";
import { ConfirmDialog, useToast } from "@/components/feedback";
import { Alert, Badge, Button, Card, Stat, api, fmtDate } from "@/components/ui";
import { fmtRate, INVESTOR_ECONOMICS, LEVEL_IDS, LEVELS, SEED_CAPITAL, VAULT_BREB } from "@/lib/config";
import { cop, pct } from "@/lib/finance";
import type { AdminAction, State, TabId } from "../types";
import { AuditList } from "./auditoria";

const share = (part: number, total: number) => (total > 0 ? `${((part / total) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %` : "0 %");

export function SummarySection({ state, busy, act, reload, go }: { state: State; busy: boolean; act: AdminAction; reload: () => Promise<void>; go: (t: TabId) => void }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [vaultBusy, setVaultBusy] = useState(false);
  const toast = useToast();
  const k = state.kpis;
  const active = state.loans.filter((l) => l.status === "activo");
  const waiting = state.loans.filter((l) => l.status === "en_espera");

  async function authorizeVault() {
    setVaultBusy(true);
    try {
      const { redirectUrl } = await api<{ redirectUrl: string }>("/api/op/vault-grant", {});
      window.location.assign(redirectUrl);
    } catch (e) {
      toast("error", "No se pudo pedir el permiso", (e as Error).message);
      setVaultBusy(false);
    }
  }

  async function revokeVault() {
    setVaultBusy(true);
    try {
      await fetch("/api/op/vault-grant", { method: "DELETE" });
      await reload();
      toast("info", "Permiso revocado", "Cada retiro volverá a necesitar aprobación en la wallet de la bóveda.");
    } finally {
      setVaultBusy(false);
      setConfirmRevoke(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Lo que requiere atención del operador */}
      <div className="space-y-2">
        {state.audit.broken && (
          <Alert tone="error" title="La bitácora de auditoría no está íntegra" action={<Button variant="ghost" onClick={() => go("auditoria")}>Ver bitácora</Button>}>
            El evento #{state.audit.broken.seq} no coincide con la cadena: {state.audit.broken.reason}.
          </Alert>
        )}
        {state.faceReviews.length > 0 && (
          <Alert tone="warning" title={`${state.faceReviews.length} verificación(es) de identidad por revisar`} action={<Button variant="ghost" onClick={() => go("usuarios")}>Revisar</Button>}>
            Esas cuentas no pueden pedir crédito ni invertir hasta que las apruebes.
          </Alert>
        )}
        {active.some((l) => l.overdue) && (
          <Alert tone="error" title={`${active.filter((l) => l.overdue).length} crédito(s) en mora`} action={<Button variant="ghost" onClick={() => go("cartera")}>Ver cartera</Button>}>
            Cuotas con más de 3 días sin pagar desde la solicitud de pago. El riesgo lo asumen los inversionistas del pool.
          </Alert>
        )}
        {waiting.length > 0 && (
          <Alert tone="info" title={`${waiting.length} crédito(s) esperando fondeo`}>
            Algún pool no tiene liquidez por encima del encaje. Se desembolsan solos cuando entren inversiones o pagos.
          </Alert>
        )}
      </div>

      {/* Indicadores */}
      <Card className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <Stat label="Cartera vigente" value={cop(k.portfolio)} sub={`${active.length} crédito(s) activo(s)`} />
        <Stat
          label="Cartera en mora"
          value={<span className={k.overdue ? "text-red-600 dark:text-red-400" : ""}>{share(k.overdue, k.portfolio)}</span>}
          sub={`${cop(k.overdue)} · mora > 30 días ${share(k.par30, k.portfolio)}`}
        />
        <Stat label="Desembolsado" value={cop(k.disbursed)} sub={`Recaudado ${cop(k.collected)}`} />
        <Stat label="Saldo inversionistas" value={cop(state.investorBalance)} sub={`Invertido ${cop(k.invested)} · retirado ${cop(k.withdrawn)}`} />
      </Card>

      {/* Pools con encaje */}
      <div className="grid gap-3 lg:grid-cols-3">
        {LEVEL_IDS.map((l) => {
          const pool = state.pools[l];
          const total = pool.liquidity + pool.lent;
          const reserve = INVESTOR_ECONOMICS.reserveRequirement * total;
          const lowReserve = pool.liquidity < reserve;
          return (
            <Card key={l} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">Pool {LEVELS[l].name}</span>
                <Badge>
                  {pct(LEVELS[l].rateEA)} → {fmtRate(LEVELS[l].investorRateEA)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Disponible" value={<span className="text-base sm:text-xl">{cop(pool.liquidity)}</span>} />
                <Stat label="Prestado" value={<span className="text-base sm:text-xl">{cop(pool.lent)}</span>} />
              </div>
              <div className="space-y-1">
                <div className="relative h-2 rounded-full bg-line">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${total ? Math.round((pool.lent / total) * 100) : 0}%` }} />
                  {/* Marca del máximo prestable (85 %): a la derecha queda el encaje */}
                  <div className="absolute -top-1 h-4 w-0.5 bg-foreground/60" style={{ left: `${(1 - INVESTOR_ECONOMICS.reserveRequirement) * 100}%` }} aria-hidden="true" />
                </div>
                <div className="flex justify-between text-[11px] text-muted">
                  <span>{total ? Math.round((pool.lent / total) * 100) : 0} % prestado</span>
                  <span className={lowReserve ? "font-medium text-amber-600 dark:text-amber-400" : ""}>
                    Encaje 15 %: {cop(reserve)}
                    {lowReserve ? " · por debajo" : ""}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bóveda: retiros automáticos y recaudo Bre-B */}
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Bóveda</h2>
              <p className="text-sm text-muted">
                Recibe las inversiones por Interledger y las cuotas por Bre-B en la llave <b className="text-foreground">{VAULT_BREB.key}</b>. Capital semilla {cop(SEED_CAPITAL)}.
              </p>
            </div>
            {state.interledger && <Badge tone={state.vaultGrant ? "good" : "warn"}>{state.vaultGrant ? "Retiros automáticos" : "Retiros manuales"}</Badge>}
          </div>
          {state.interledger && state.vaultGrant && (
            <div className="space-y-1">
              <div className="flex flex-wrap justify-between gap-x-4 text-xs text-muted">
                <span>
                  Usado {state.vaultGrant.spent.toLocaleString("es-CO", { minimumFractionDigits: 2 })} de {state.vaultGrant.limit.toLocaleString("es-CO")} {state.vaultGrant.assetCode}
                </span>
                <span>Desde el {fmtDate(state.vaultGrant.grantedAt)}</span>
              </div>
              <div className="h-2 rounded-full bg-line">
                <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, (state.vaultGrant.spent / state.vaultGrant.limit) * 100)}%` }} />
              </div>
            </div>
          )}
          {state.interledger && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={authorizeVault} loading={vaultBusy} variant={state.vaultGrant ? "ghost" : "primary"}>
                {state.vaultGrant ? "Renovar permiso" : "Autorizar retiros automáticos"}
              </Button>
              {state.vaultGrant && (
                <Button variant="ghost" onClick={() => setConfirmRevoke(true)} disabled={vaultBusy}>
                  Revocar
                </Button>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted">El token del permiso nunca sale del servidor. Autorizar, renovar o revocar queda en la bitácora.</p>
        </Card>

        {/* Controles de la demo */}
        <Card className="space-y-3">
          <h2 className="font-semibold">Controles de la demo</h2>
          <p className="text-sm text-muted">Adelanta el reloj para ver crecer las cajitas, vencer cuotas, la mora y el reporte de los 90 días.</p>
          <div className="flex flex-wrap gap-2">
            {[3, 15, 30, 90, 365].map((d) => (
              <Button key={d} variant="ghost" disabled={busy} onClick={() => act({ action: "advance", days: d }, { title: `Reloj adelantado ${d} días`, tone: "info" })}>
                +{d === 365 ? "1 año" : `${d} días`}
              </Button>
            ))}
            <Button variant="ghost" disabled={busy} onClick={() => setConfirmReset(true)}>
              Reiniciar demo
            </Button>
          </div>
        </Card>
      </div>

      {state.creditReports.length > 0 && (
        <Card className="space-y-3">
          <div>
            <h2 className="font-semibold">Reportes a centrales de riesgo</h2>
            <p className="mt-1 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300">SIMULACIÓN: estos reportes no se envían a ninguna central de riesgo.</p>
          </div>
          <ul className="divide-y divide-line text-sm">
            {state.creditReports.map((r) => (
              <li key={r.loanId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <div className="font-medium">
                    {r.name} · crédito {r.loanId} · {LEVELS[r.level].name}
                  </div>
                  <div className="text-xs text-muted">
                    Aviso {fmtDate(r.noticeAt)}
                    {r.reportedAt ? ` · reportado ${fmtDate(r.reportedAt)}` : " · se reporta a los 90 días de mora"}
                    {r.snapshot ? ` · saldo en mora ${cop(r.snapshot.overdueBalance)}` : ""}
                    {r.chargedOffAt ? " · castigado" : ""}
                  </div>
                </div>
                <Badge tone={r.status === "pagada" ? "warn" : "bad"}>{r.status === "aviso" ? "Aviso previo" : r.status === "en_mora" ? "Reportado en mora" : "Pagada después de mora"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Actividad reciente</h2>
            <p className="text-sm text-muted">Últimos eventos de la bitácora de auditoría ({state.audit.total} en total).</p>
          </div>
          <Button variant="ghost" onClick={() => go("auditoria")}>
            Ver bitácora completa
          </Button>
        </div>
        <AuditList events={state.audit.latest} compact />
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title="¿Reiniciar la demo?"
        confirmLabel="Sí, reiniciar"
        danger
        loading={busy}
        onConfirm={async () => {
          await act({ action: "reset" }, { title: "Demo reiniciada", text: "Se borraron inversiones, créditos y movimientos. Las cuentas y la bitácora se conservan." });
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      >
        Se borrarán todas las inversiones, créditos y movimientos, y se vuelven a precargar los datos de las cuentas demo. Las cuentas y la bitácora se conservan.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmRevoke}
        title="¿Revocar el permiso de la bóveda?"
        confirmLabel="Revocar"
        danger
        loading={vaultBusy}
        onConfirm={revokeVault}
        onCancel={() => setConfirmRevoke(false)}
      >
        Los retiros dejarán de salir automáticamente: cada uno tendrá que aprobarse en la wallet de la bóveda.
      </ConfirmDialog>
    </div>
  );
}
