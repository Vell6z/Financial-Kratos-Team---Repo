"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog, useToast } from "@/components/feedback";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner, Stat, api, fmtDate } from "@/components/ui";
import { LEVEL_IDS, LEVELS, SEED_CAPITAL, VAULT_BREB, type Level } from "@/lib/config";
import { cop, pct } from "@/lib/finance";

interface State {
  now: number;
  clockOffsetDays: number;
  interledger: boolean;
  vaultGrant: { grantedAt: number; assetCode: string; limit: number; spent: number } | null;
  pools: Record<Level, { liquidity: number; lent: number }>;
  investorBalance: number;
  loans: { id: string; status: string; overdue: boolean; level: Level }[];
  txs: { id: string; at: number; kind: string; level: Level; amountCop: number; detail: string; mode: string }[];
  faceReviews: {
    id: string;
    name: string;
    cedula: string;
    at: number;
    dedupDistance: number | null;
    dedupMatchCedula: string | null;
    yawRange: number;
    mode: string;
    reason: "parecido" | "duplicado_probable" | "sin_camara";
  }[];
}

const KIND: Record<string, { label: string; sign: string }> = {
  deposito_ilp: { label: "Inversión · Interledger", sign: "+" },
  retiro_ilp: { label: "Retiro · Interledger", sign: "−" },
  desembolso_breb: { label: "Desembolso · Bre-B", sign: "−" },
  pago_breb: { label: "Pago de cuota · Bre-B", sign: "+" },
};

export default function VaultPage() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const toast = useToast();

  const load = useCallback(() => api<State>("/api/state").then(setState), []);

  // Resultado de autorizar la bóveda al volver de la wallet
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("permiso");
    if (!r) return;
    if (r === "ok") toast("success", "Bóveda autorizada", "Los retiros de los inversionistas ahora salen automáticamente de la bóveda.");
    else if (r === "rechazado") toast("warning", "Autorización cancelada", "No se aprobó el permiso en la wallet de la bóveda.");
    else toast("error", "No se pudo autorizar la bóveda", q.get("msg") ?? "Intenta de nuevo.");
    window.history.replaceState(null, "", "/boveda");
  }, [toast]);

  async function authorizeVault() {
    setBusy(true);
    try {
      const { redirectUrl } = await api<{ redirectUrl: string }>("/api/op/vault-grant", {});
      window.location.assign(redirectUrl);
    } catch (e) {
      toast("error", "No se pudo pedir el permiso", (e as Error).message);
      setBusy(false);
    }
  }

  async function revokeVault() {
    setBusy(true);
    try {
      await fetch("/api/op/vault-grant", { method: "DELETE" });
      await load();
      toast("info", "Permiso revocado", "Cada retiro volverá a necesitar aprobación en la wallet de la bóveda.");
    } finally {
      setBusy(false);
      setConfirmRevoke(false);
    }
  }

  useEffect(() => {
    const refresh = () => void load().catch(() => {});
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  async function admin(body: { action: "advance"; days: number } | { action: "reset" }) {
    setBusy(true);
    try {
      await api("/api/admin", body);
      await load();
      if (body.action === "reset") toast("success", "Demo reiniciada", "Se borraron inversiones, créditos y movimientos. Las cuentas se conservan.");
      else toast("info", `Reloj adelantado ${body.days} días`, "Las cajitas rentaron y las cuotas avanzaron.");
    } catch (e) {
      toast("error", "No se pudo completar la acción", (e as Error).message);
    } finally {
      setBusy(false);
      setConfirmReset(false);
    }
  }

  async function resolveFace(userId: string, approve: boolean) {
    setBusy(true);
    try {
      await api("/api/admin", { action: approve ? "face-approve" : "face-reject", userId });
      await load();
      toast(approve ? "success" : "info", approve ? "Verificación aprobada" : "Verificación rechazada", approve ? "El usuario ya puede pedir crédito o invertir." : "La cuenta queda bloqueada: ya no puede iniciar sesión.");
    } catch (e) {
      toast("error", "No se pudo resolver", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!state)
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner /> Cargando bóveda…
      </p>
    );

  const active = state.loans.filter((l) => l.status === "activo");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Solo operador"
        title="Panel del operador"
        description={`Información interna de la bóveda: liquidez de los pools, cartera y movimientos de todos los usuarios. Fecha simulada: ${fmtDate(state.now)}${state.clockOffsetDays ? ` (+${state.clockOffsetDays} días)` : ""}.`}
        actions={<Badge tone={state.interledger ? "good" : "warn"}>{state.interledger ? "Open Payments conectado" : "Modo simulado"}</Badge>}
      />

      {state.loans.some((l) => l.overdue) && (
        <Alert tone="error" title={`${state.loans.filter((l) => l.overdue).length} crédito(s) en mora`}>
          Hay cuotas vencidas sin pagar. El riesgo lo asumen los inversionistas del pool correspondiente.
        </Alert>
      )}
      {state.loans.some((l) => l.status === "en_espera") && (
        <Alert tone="warning" title="Créditos esperando fondeo">
          Algún pool no tiene liquidez suficiente. Se desembolsarán automáticamente cuando entren inversiones o pagos.
        </Alert>
      )}

      {state.faceReviews.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Verificación facial en revisión</h2>
              <p className="text-sm text-muted">
                Cuentas que no pueden pedir crédito ni invertir hasta que las revises: rostros parecidos a otra cuenta o registros sin
                cámara (verifica la identidad por otro medio, por ejemplo una videollamada).
              </p>
            </div>
            <Badge tone="warn">{state.faceReviews.length} pendiente(s)</Badge>
          </div>
          <ul className="divide-y divide-line">
            {state.faceReviews.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <div className="font-medium">
                    {r.name} <span className="text-muted">· CC {r.cedula}</span>
                  </div>
                  <div className="text-xs text-muted">
                    {r.reason === "sin_camara" ? (
                      <>{fmtDate(r.at)} · se registró sin cámara: falta verificar su identidad</>
                    ) : (
                      <>
                        {fmtDate(r.at)} · {r.reason === "duplicado_probable" ? "muy parecido" : "parecido"} a CC {r.dedupMatchCedula ?? "—"} · distancia{" "}
                        {r.dedupDistance !== null ? r.dedupDistance.toFixed(3) : "—"} · giro {r.yawRange}°
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" disabled={busy} onClick={() => resolveFace(r.id, true)}>
                    {r.reason === "sin_camara" ? "Identidad verificada" : "Es otra persona"}
                  </Button>
                  <Button variant="danger" disabled={busy} onClick={() => resolveFace(r.id, false)}>
                    {r.reason === "sin_camara" ? "Rechazar" : "Es duplicado"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="¿Reiniciar la demo?"
        confirmLabel="Sí, reiniciar"
        danger
        loading={busy}
        onConfirm={() => admin({ action: "reset" })}
        onCancel={() => setConfirmReset(false)}
      >
        Se borrarán todas las inversiones, créditos y movimientos. Las cuentas de usuario se conservan. Esta acción no se puede deshacer.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmRevoke}
        title="¿Revocar el permiso de la bóveda?"
        confirmLabel="Revocar"
        danger
        loading={busy}
        onConfirm={revokeVault}
        onCancel={() => setConfirmRevoke(false)}
      >
        Los retiros dejarán de salir automáticamente: cada uno tendrá que aprobarse en la wallet de la bóveda.
      </ConfirmDialog>

      {state.interledger && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Retiros desde la bóveda</h2>
              <p className="text-sm text-muted">
                {state.vaultGrant
                  ? "Automáticos: cuando un inversionista retira, la plata sale de la bóveda a su wallet al instante."
                  : "Cada retiro necesita que el operador lo apruebe en la wallet de la bóveda. Autorízala una vez para que salgan solos."}
              </p>
            </div>
            <Badge tone={state.vaultGrant ? "good" : "warn"}>{state.vaultGrant ? "Autorizada" : "Sin autorizar"}</Badge>
          </div>
          {state.vaultGrant && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted">
                <span>
                  Usado {state.vaultGrant.spent.toLocaleString("es-CO", { minimumFractionDigits: 2 })} de{" "}
                  {state.vaultGrant.limit.toLocaleString("es-CO")} {state.vaultGrant.assetCode}
                </span>
                <span>Desde el {fmtDate(state.vaultGrant.grantedAt)}</span>
              </div>
              <div className="h-2 rounded-full bg-line">
                <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, (state.vaultGrant.spent / state.vaultGrant.limit) * 100)}%` }} />
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={authorizeVault} loading={busy} variant={state.vaultGrant ? "ghost" : "primary"}>
              {state.vaultGrant ? "Renovar permiso" : "Autorizar retiros automáticos"}
            </Button>
            {state.vaultGrant && (
              <Button variant="ghost" onClick={() => setConfirmRevoke(true)} disabled={busy}>
                Revocar
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted">Se abre la wallet de la bóveda para aprobar un tope total de envíos. El token nunca sale del servidor.</p>
        </Card>
      )}

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Recaudo por Bre-B</h2>
          <p className="text-sm text-muted">
            Los acreditados pagan sus cuotas a la llave <b className="text-foreground">{VAULT_BREB.key}</b>, vinculada a la bóveda. Cada pago entra al pool de su nivel.
          </p>
        </div>
        <Stat
          label="Recibido por Bre-B"
          value={cop(state.txs.filter((t) => t.kind === "pago_breb").reduce((sum, t) => sum + t.amountCop, 0))}
          sub={`${state.txs.filter((t) => t.kind === "pago_breb").length} pagos recientes · simulado`}
        />
      </Card>

      <Card className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Capital semilla" value={cop(SEED_CAPITAL)} />
        <Stat label="Saldo inversionistas" value={cop(state.investorBalance)} />
        <Stat label="Créditos activos" value={active.length} sub={`${active.filter((l) => l.overdue).length} en mora`} />
        <Stat label="En espera de fondeo" value={state.loans.filter((l) => l.status === "en_espera").length} />
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {LEVEL_IDS.map((l) => (
          <Card key={l} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Pool {LEVELS[l].name}</span>
              <Badge>{pct(LEVELS[l].rateEA)} EA</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Disponible" value={<span className="text-base sm:text-xl">{cop(state.pools[l].liquidity)}</span>} />
              <Stat label="Prestado" value={<span className="text-base sm:text-xl">{cop(state.pools[l].lent)}</span>} />
            </div>
            <PoolUsage liquidity={state.pools[l].liquidity} lent={state.pools[l].lent} />
          </Card>
        ))}
      </div>

      <Card className="space-y-3">
        <h2 className="font-semibold">Controles de demo</h2>
        <p className="text-sm text-muted">Adelanta el reloj para ver crecer las cajitas y vencer las cuotas.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => admin({ action: "advance", days: 15 })}>+15 días</Button>
          <Button variant="ghost" disabled={busy} onClick={() => admin({ action: "advance", days: 30 })}>+30 días</Button>
          <Button variant="ghost" disabled={busy} onClick={() => admin({ action: "advance", days: 365 })}>+1 año</Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setConfirmReset(true)}
          >
            Reiniciar demo
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Movimientos</h2>
        {state.txs.length === 0 && <EmptyState title="Sin movimientos todavía" description="Aquí verás inversiones, desembolsos, pagos y retiros." />}
        <ul className="divide-y divide-line">
          {state.txs.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <div className="font-medium">{KIND[t.kind]?.label ?? t.kind}</div>
                <div className="text-xs text-muted">
                  {fmtDate(t.at)} · {LEVELS[t.level].name} · {t.detail}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={t.mode === "interledger" ? "good" : "neutral"}>{t.mode}</Badge>
                <span className="font-semibold tabular-nums">
                  {KIND[t.kind]?.sign} {cop(t.amountCop)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function PoolUsage({ liquidity, lent }: { liquidity: number; lent: number }) {
  const total = liquidity + lent;
  const used = total > 0 ? lent / total : 0;
  return (
    <div className="space-y-1">
      <div className="h-1.5 rounded-full bg-line">
        <div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.round(used * 100)}%` }} />
      </div>
      <div className="text-[11px] text-muted">{Math.round(used * 100)}% del pool prestado</div>
    </div>
  );
}
