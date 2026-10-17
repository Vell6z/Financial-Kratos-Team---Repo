import "server-only";
import { createHash } from "node:crypto";
import type { DB, User } from "./db";

// Bitácora de auditoría (trazabilidad): quién hizo qué, sobre qué y cuándo, en todos los flujos con dinero,
// identidad o datos. Cada evento lleva el hash del anterior (cadena tipo blockchain), así que si alguien
// edita o borra un evento del medio, la verificación lo detecta. Se guarda en la misma base (db.audit).
// Sin datos sensibles: nada de contraseñas, tokens, documentos ni respuestas del estudio.

export type AuditCategory = "acceso" | "identidad" | "estudio" | "credito" | "pago" | "inversion" | "boveda" | "mora" | "operador" | "demo";

export interface AuditEvent {
  id: string;
  /** Número consecutivo (no se reinicia aunque se recorte la bitácora) */
  seq: number;
  /** Hora real del servidor */
  at: number;
  /** Hora del reloj de la demo (puede ir adelantado) */
  demoAt: number;
  category: AuditCategory;
  /** Acción en snake_case, por ejemplo credito_solicitado */
  action: string;
  /** Quién: un usuario, el operador o un proceso automático del sistema */
  actor: { type: "usuario" | "operador" | "sistema"; id?: string; name?: string; role?: string };
  /** Sobre qué */
  entity?: { type: "usuario" | "credito" | "movimiento" | "cajita" | "recurrente" | "boveda" | "demo"; id: string };
  /** Resumen legible */
  summary: string;
  /** Datos clave, solo valores simples */
  data?: Record<string, string | number | boolean | null>;
  /** IP de origen, si la petición la trae */
  ip?: string;
  prevHash: string;
  hash: string;
}

/** Máximo de eventos guardados (la base completa viaja en cada lectura) */
const MAX_EVENTS = 3000;
const GENESIS = "0".repeat(64);

/**
 * JSON con las claves ordenadas: el hash no puede depender del orden de las claves, porque Supabase (jsonb)
 * las reordena al guardar. Los campos sin valor se omiten (undefined y null valen lo mismo).
 */
function canonical(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (typeof v === "object")
    return `{${Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined && (v as Record<string, unknown>)[k] !== null)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

const digest = (e: Omit<AuditEvent, "hash">) =>
  createHash("sha256")
    .update(canonical({ seq: e.seq, at: e.at, demoAt: e.demoAt, category: e.category, action: e.action, actor: e.actor, entity: e.entity, summary: e.summary, data: e.data, ip: e.ip, prevHash: e.prevHash }))
    .digest("hex");

/** Actor a partir del usuario de la sesión */
export const actorOf = (u: Pick<User, "id" | "name" | "role">): AuditEvent["actor"] => ({
  type: u.role === "admin" ? "operador" : "usuario",
  id: u.id,
  name: u.name,
  role: u.role,
});

export const SYSTEM: AuditEvent["actor"] = { type: "sistema", name: "Sistema" };

/** Actor dueño de una wallet o una cédula (para eventos registrados en los servicios, sin la sesión a mano) */
export function ownerActor(db: DB, owner: { wallet?: string; cedula?: string }): AuditEvent["actor"] {
  const u = db.users.find((x) => (owner.wallet && x.wallet === owner.wallet) || (owner.cedula && x.cedula === owner.cedula));
  return u ? actorOf(u) : { type: "usuario", name: owner.wallet ?? owner.cedula };
}

/** IP de la petición (detrás de un proxy, la primera de x-forwarded-for) */
export function requestIp(request?: Request) {
  const h = request?.headers;
  return h?.get("x-forwarded-for")?.split(",")[0].trim() || h?.get("x-real-ip") || undefined;
}

/** Agrega un evento a la bitácora. Llamar DENTRO de withDB, en la misma transacción del cambio que registra */
export function audit(
  db: DB,
  e: Pick<AuditEvent, "category" | "action" | "actor" | "summary"> & Partial<Pick<AuditEvent, "entity" | "data" | "ip">>,
) {
  const log = (db.audit ??= []);
  const last = log.at(-1);
  const base: Omit<AuditEvent, "hash"> = {
    id: crypto.randomUUID().slice(0, 8),
    seq: (last?.seq ?? 0) + 1,
    at: Date.now(),
    demoAt: Date.now() + db.clockOffsetMs,
    category: e.category,
    action: e.action,
    actor: e.actor,
    ...(e.entity ? { entity: e.entity } : {}),
    summary: e.summary,
    ...(e.data ? { data: e.data } : {}),
    ...(e.ip ? { ip: e.ip } : {}),
    prevHash: last?.hash ?? GENESIS,
  };
  log.push({ ...base, hash: digest(base) });
  if (log.length > MAX_EVENTS) log.splice(0, log.length - MAX_EVENTS);
}

/** Versión del formato del hash (2 = JSON canónico con claves ordenadas) */
export const AUDIT_FORMAT = 2;

/**
 * Migración única: los eventos sellados con el formato 1 (sensible al orden de las claves, que Supabase cambia)
 * se vuelven a sellar con el formato actual, y queda un evento que lo registra. Se llama al cargar la base.
 */
export function migrateAuditFormat(db: DB) {
  if (!db.audit?.length || db.auditFormat === AUDIT_FORMAT) {
    db.auditFormat = AUDIT_FORMAT;
    return;
  }
  let prev = GENESIS;
  for (const e of db.audit) {
    e.prevHash = prev;
    const { hash: _old, ...rest } = e;
    void _old;
    e.hash = digest(rest);
    prev = e.hash;
  }
  db.auditFormat = AUDIT_FORMAT;
  audit(db, {
    category: "operador",
    action: "bitacora_resellada",
    actor: SYSTEM,
    summary: `Se volvió a sellar la bitácora con el formato ${AUDIT_FORMAT} del hash (JSON canónico): ${db.audit.length} eventos`,
  });
}

/**
 * Verifica la cadena: cada hash corresponde a su evento y apunta al anterior.
 * Devuelve el primer evento roto (editado, borrado o insertado), o null si está íntegra.
 */
export function verifyAuditChain(log: AuditEvent[]) {
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    const { hash, ...rest } = e;
    if (digest(rest) !== hash) return { seq: e.seq, reason: "El contenido del evento no coincide con su hash (fue modificado)" };
    if (i > 0 && e.prevHash !== log[i - 1].hash) return { seq: e.seq, reason: "No apunta al evento anterior (falta o se insertó un evento)" };
  }
  return null;
}

/** CSV con separador ; (abre bien en Excel en español) */
export function toCsv(rows: Record<string, string | number | null | undefined>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM para que Excel reconozca las tildes
  return "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => cell(r[c])).join(";"))].join("\n");
}
