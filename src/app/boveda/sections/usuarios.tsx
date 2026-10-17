"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/feedback";
import { Badge, Button, Card, EmptyState, Input, Spinner, api, fmtDate } from "@/components/ui";
import { LEVELS } from "@/lib/config";
import { cop } from "@/lib/finance";
import { walletLabel } from "@/lib/validators";
import type { AdminAction, AuditEventView, State, UserRow } from "../types";
import { AuditList } from "./auditoria";

type Filter = "todos" | "inversor" | "acreditado" | "revision" | "suspendidos";
const FILTERS: { id: Filter; label: string; test: (u: UserRow) => boolean }[] = [
  { id: "todos", label: "Todos", test: (u) => u.role !== "admin" },
  { id: "inversor", label: "Inversionistas", test: (u) => u.role === "inversor" },
  { id: "acreditado", label: "Acreditados", test: (u) => u.role === "acreditado" },
  { id: "revision", label: "Identidad en revisión", test: (u) => u.faceVerification === "pendiente" },
  { id: "suspendidos", label: "Suspendidos o rechazados", test: (u) => Boolean(u.suspended) || u.faceVerification === "rechazada" },
];

const ROLE: Record<UserRow["role"], string> = { inversor: "Inversionista", acreditado: "Acreditado", admin: "Operador" };

function UserStatus({ u }: { u: UserRow }) {
  if (u.suspended) return <Badge tone="bad">Suspendida</Badge>;
  if (u.faceVerification === "rechazada") return <Badge tone="bad">Identidad rechazada</Badge>;
  if (u.faceVerification === "pendiente") return <Badge tone="warn">Identidad en revisión</Badge>;
  return <Badge tone="good">Activa</Badge>;
}

export function UsersSection({ state, busy, act }: { state: State; busy: boolean; act: AdminAction }) {
  const [filter, setFilter] = useState<Filter>(state.faceReviews.length ? "revision" : "todos");
  const [text, setText] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  // Diálogo con motivo: suspender, reactivar o resolver la verificación facial
  const [dialog, setDialog] = useState<{ user: UserRow; action: "suspend" | "reactivate" | "face-approve" | "face-reject" } | null>(null);
  const [reason, setReason] = useState("");
  const q = text.trim().toLowerCase();
  const rows = state.users
    .filter(FILTERS.find((f) => f.id === filter)!.test)
    .filter((u) => !q || [u.name, u.email, u.cedula, u.id].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => b.createdAt - a.createdAt);

  const DIALOG = {
    suspend: { title: "¿Suspender la cuenta?", label: "Suspender", danger: true, need: true, done: "Cuenta suspendida" },
    reactivate: { title: "¿Reactivar la cuenta?", label: "Reactivar", danger: false, need: false, done: "Cuenta reactivada" },
    "face-approve": { title: "¿Aprobar la identidad?", label: "Aprobar", danger: false, need: false, done: "Verificación aprobada" },
    "face-reject": { title: "¿Rechazar la identidad?", label: "Rechazar", danger: true, need: false, done: "Verificación rechazada" },
  } as const;

  async function confirm() {
    if (!dialog) return;
    const d = DIALOG[dialog.action];
    if (d.need && !reason.trim()) return;
    const ok = await act({ action: dialog.action, userId: dialog.user.id, reason }, { title: d.done, text: dialog.user.name });
    if (ok) {
      setDialog(null);
      setReason("");
    }
  }

  return (
    <div className="space-y-4">
      {state.faceReviews.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Verificación de identidad en revisión</h2>
              <p className="text-sm text-muted">Rostros parecidos a otra cuenta o registros sin cámara. Verifica por otro medio (por ejemplo, videollamada) antes de aprobar.</p>
            </div>
            <Badge tone="warn">{state.faceReviews.length} pendiente(s)</Badge>
          </div>
          <ul className="divide-y divide-line">
            {state.faceReviews.map((r) => {
              const u = state.users.find((x) => x.id === r.id);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <div className="font-medium">
                      {r.name} <span className="text-muted">· CC {r.cedula}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {r.reason === "sin_camara"
                        ? `${fmtDate(r.at)} · se registró sin cámara: falta verificar su identidad`
                        : `${fmtDate(r.at)} · ${r.reason === "duplicado_probable" ? "muy parecido" : "parecido"} a CC ${r.dedupMatchCedula ?? "—"} · distancia ${r.dedupDistance !== null ? r.dedupDistance.toFixed(3) : "—"} · giro ${r.yawRange}°`}
                    </div>
                  </div>
                  {u && (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" disabled={busy} onClick={() => setDialog({ user: u, action: "face-approve" })}>
                        {r.reason === "sin_camara" ? "Identidad verificada" : "Es otra persona"}
                      </Button>
                      <Button variant="danger" disabled={busy} onClick={() => setDialog({ user: u, action: "face-reject" })}>
                        {r.reason === "sin_camara" ? "Rechazar" : "Es duplicado"}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Input label="Buscar" placeholder="Nombre, correo o cédula" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <a href="/api/admin/export?tipo=usuarios" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium hover:border-brand/50">
            Exportar CSV
          </a>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar usuarios">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-9 rounded-full px-3 text-sm transition ${filter === f.id ? "bg-brand text-white" : "border border-line text-muted hover:text-foreground"}`}
            >
              {f.label} <span className="tabular-nums opacity-70">{state.users.filter(f.test).length}</span>
            </button>
          ))}
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="Sin usuarios con este filtro" description="Cambia el filtro o la búsqueda." />
      ) : (
        <ul className="space-y-2">
          {rows.map((u) => (
            <li key={u.id}>
              <Card className="p-0">
                <button type="button" className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left sm:px-5" onClick={() => setOpen(open === u.id ? null : u.id)} aria-expanded={open === u.id}>
                  <div className="min-w-0">
                    <div className="font-medium">
                      {u.name} <span className="text-sm font-normal text-muted">· {ROLE[u.role]}</span>
                    </div>
                    <div className="truncate text-xs text-muted">
                      {u.email} · CC {u.cedula} · desde {fmtDate(u.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {u.role === "acreditado" && u.study && (
                      <span className="text-xs text-muted">
                        {u.study.level ? LEVELS[u.study.level].name : "Nivel 4"} · puntaje {u.study.creditScore}
                      </span>
                    )}
                    {u.role === "inversor" && <span className="text-xs text-muted">Saldo {cop(u.balance)}</span>}
                    <UserStatus u={u} />
                  </div>
                </button>
                {open === u.id && <UserDetail u={u} busy={busy} onAction={(action) => setDialog({ user: u, action })} />}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={dialog !== null}
        title={dialog ? DIALOG[dialog.action].title : ""}
        confirmLabel={dialog ? DIALOG[dialog.action].label : ""}
        danger={dialog ? DIALOG[dialog.action].danger : false}
        loading={busy}
        onConfirm={confirm}
        onCancel={() => (setDialog(null), setReason(""))}
      >
        {dialog && (
          <div className="space-y-3">
            <p>
              {dialog.action === "suspend"
                ? `${dialog.user.name} no podrá iniciar sesión y se cerrarán sus sesiones abiertas. Sus créditos e inversiones siguen igual.`
                : dialog.action === "reactivate"
                  ? `${dialog.user.name} podrá volver a iniciar sesión.`
                  : dialog.action === "face-approve"
                    ? `${dialog.user.name} podrá pedir crédito o invertir.`
                    : `La cuenta de ${dialog.user.name} queda bloqueada y se borra su dato biométrico.`}
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Motivo{DIALOG[dialog.action].need ? " (obligatorio)" : " (opcional)"}</span>
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
        )}
      </ConfirmDialog>
    </div>
  );
}

function UserDetail({ u, busy, onAction }: { u: UserRow; busy: boolean; onAction: (a: "suspend" | "reactivate" | "face-approve" | "face-reject") => void }) {
  const [events, setEvents] = useState<AuditEventView[] | null>(null);
  useEffect(() => {
    api<{ events: AuditEventView[] }>(`/api/admin/audit?entidad=${encodeURIComponent(`usuario:${u.id}`)}`)
      .then((r) => setEvents(r.events))
      .catch(() => setEvents([]));
  }, [u.id]);

  return (
    <div className="grid gap-5 border-t border-line px-4 py-4 sm:px-5 lg:grid-cols-2">
      <div className="space-y-4">
        <dl className="grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
          <dt className="text-muted">Id</dt>
          <dd className="font-mono">{u.id}</dd>
          <dt className="text-muted">Verificación facial</dt>
          <dd>{u.faceVerification}</dd>
          {u.wallet && (
            <>
              <dt className="text-muted">Wallet</dt>
              <dd className="break-all">{walletLabel(u.wallet)}</dd>
            </>
          )}
          {u.study && (
            <>
              <dt className="text-muted">Estudio</dt>
              <dd>
                {u.study.score}/100 · {u.study.level ? LEVELS[u.study.level].name : "nivel 4"} · puntaje de historial {u.study.creditScore}
              </dd>
            </>
          )}
          {u.study?.blockedUntil && (
            <>
              <dt className="text-muted">Bloqueado hasta</dt>
              <dd className="text-red-600 dark:text-red-400">{fmtDate(u.study.blockedUntil)}</dd>
            </>
          )}
          {u.role === "acreditado" && (
            <>
              <dt className="text-muted">Créditos</dt>
              <dd>{u.loans}</dd>
            </>
          )}
          {u.suspended && (
            <>
              <dt className="text-muted">Suspendida</dt>
              <dd className="text-red-600 dark:text-red-400">
                {fmtDate(u.suspended.at)} por {u.suspended.by}: {u.suspended.reason}
              </dd>
            </>
          )}
        </dl>
        {u.role !== "admin" && (
          <div className="flex flex-wrap gap-2">
            {u.faceVerification === "pendiente" && (
              <>
                <Button variant="ghost" disabled={busy} onClick={() => onAction("face-approve")}>
                  Aprobar identidad
                </Button>
                <Button variant="danger" disabled={busy} onClick={() => onAction("face-reject")}>
                  Rechazar identidad
                </Button>
              </>
            )}
            {u.suspended ? (
              <Button variant="ghost" disabled={busy} onClick={() => onAction("reactivate")}>
                Reactivar cuenta
              </Button>
            ) : (
              <Button variant="danger" disabled={busy} onClick={() => onAction("suspend")}>
                Suspender cuenta
              </Button>
            )}
          </div>
        )}
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Trazabilidad del usuario</h3>
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
