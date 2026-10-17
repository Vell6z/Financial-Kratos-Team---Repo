"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Card, EmptyState, Input, Spinner, api } from "@/components/ui";
import { AUDIT_CATEGORIES, fmtDateTime, type AuditEventView, type State } from "../types";

const ACTOR_TONE: Record<AuditEventView["actor"]["type"], "neutral" | "good" | "warn"> = { usuario: "neutral", operador: "warn", sistema: "good" };
const ACTOR_LABEL: Record<AuditEventView["actor"]["type"], string> = { usuario: "Usuario", operador: "Operador", sistema: "Sistema" };

/** Lista de eventos de la bitácora; cada uno se expande para ver los datos, la IP y la cadena de hash */
export function AuditList({ events, compact = false, onEntity }: { events: AuditEventView[]; compact?: boolean; onEntity?: (e: string) => void }) {
  if (!events.length) return <p className="py-4 text-center text-sm text-muted">Sin eventos todavía.</p>;
  return (
    <ul className="divide-y divide-line">
      {events.map((e) => (
        <li key={e.id} className="py-2">
          <details className="group">
            <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium leading-snug">{e.summary}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span className="tabular-nums">#{e.seq}</span>
                  <span>{fmtDateTime(e.at)}</span>
                  <Badge tone={ACTOR_TONE[e.actor.type]}>
                    {ACTOR_LABEL[e.actor.type]}
                    {e.actor.name && e.actor.type !== "sistema" ? ` · ${e.actor.name}` : ""}
                  </Badge>
                  {!compact && <Badge>{AUDIT_CATEGORIES[e.category] ?? e.category}</Badge>}
                </div>
              </div>
              <span className="text-xs text-muted transition group-open:rotate-180" aria-hidden="true">
                ▾
              </span>
            </summary>
            <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-lg bg-brand-soft p-3 text-xs sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted">Acción</dt>
              <dd className="font-mono">{e.action}</dd>
              {e.entity && (
                <>
                  <dt className="text-muted">Sobre</dt>
                  <dd>
                    {onEntity ? (
                      <button type="button" className="font-mono text-brand hover:underline" onClick={() => onEntity(`${e.entity!.type}:${e.entity!.id}`)}>
                        {e.entity.type}:{e.entity.id}
                      </button>
                    ) : (
                      <span className="font-mono">
                        {e.entity.type}:{e.entity.id}
                      </span>
                    )}
                  </dd>
                </>
              )}
              <dt className="text-muted">Fecha de la demo</dt>
              <dd>{fmtDateTime(e.demoAt)}</dd>
              {e.data &&
                Object.entries(e.data).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="break-all">{v === null ? "—" : String(v)}</dd>
                  </div>
                ))}
              {e.ip && (
                <>
                  <dt className="text-muted">IP</dt>
                  <dd className="font-mono">{e.ip}</dd>
                </>
              )}
              <dt className="text-muted">Hash</dt>
              <dd className="break-all font-mono text-[10px]">{e.hash}</dd>
              <dt className="text-muted">Hash anterior</dt>
              <dd className="break-all font-mono text-[10px]">{e.prevHash}</dd>
            </dl>
          </details>
        </li>
      ))}
    </ul>
  );
}

export function AuditSection({ state }: { state: State }) {
  const [category, setCategory] = useState("");
  const [text, setText] = useState("");
  const [entity, setEntity] = useState("");
  const [data, setData] = useState<{ total: number; broken: State["audit"]["broken"]; events: AuditEventView[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const params = new URLSearchParams({ ...(category ? { categoria: category } : {}), ...(text ? { q: text } : {}), ...(entity ? { entidad: entity } : {}) }).toString();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api(`/api/admin/audit${params ? `?${params}` : ""}`));
    } finally {
      setLoading(false);
    }
  }, [params]);

  // Recarga al cambiar los filtros (con una pausa corta para la búsqueda de texto) y cuando hay eventos nuevos
  useEffect(() => {
    const t = setTimeout(() => void load().catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [load, state.audit.total]);

  return (
    <div className="space-y-4">
      {state.audit.broken ? (
        <Alert tone="error" title="Cadena de auditoría rota">
          El evento #{state.audit.broken.seq} no coincide: {state.audit.broken.reason}. Alguien modificó la base por fuera de la app.
        </Alert>
      ) : (
        <Alert tone="success" title="Cadena íntegra">
          Los {state.audit.total} eventos están encadenados por hash (SHA-256): cada uno incluye el hash del anterior, así que editar o borrar uno se detecta.
        </Alert>
      )}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Input label="Buscar" placeholder="Nombre, crédito, acción, monto…" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Categoría</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="min-h-11 rounded-lg border border-line bg-background px-3 text-sm">
              <option value="">Todas</option>
              {Object.entries(AUDIT_CATEGORIES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <a
            href={`/api/admin/audit?${params ? `${params}&` : ""}formato=csv`}
            className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium hover:border-brand/50"
          >
            Exportar CSV
          </a>
        </div>
        {entity && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Filtrando por</span>
            <Badge>{entity}</Badge>
            <button type="button" className="text-xs text-brand hover:underline" onClick={() => setEntity("")}>
              Quitar
            </button>
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{data ? `${data.events.length} evento(s)${data.events.length === 500 ? " (los 500 más recientes)" : ""}` : ""}</span>
          {loading && <Spinner />}
        </div>
        {data ? (
          data.events.length ? (
            <AuditList events={data.events} onEntity={setEntity} />
          ) : (
            <EmptyState title="Sin resultados" description="Prueba con otra búsqueda o categoría." />
          )
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Cargando la bitácora…
          </p>
        )}
      </Card>
    </div>
  );
}
