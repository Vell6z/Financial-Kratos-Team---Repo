import "server-only";

// Supabase como almacenamiento de la demo, por su API REST (sin dependencias) y SOLO desde el servidor:
// - la base (el mismo JSON de data/db.json) en una fila de la tabla app_state, con control de versión;
// - los documentos subidos (cédula y estudio) en un bucket privado de Storage.
// Se activa con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY). Sin ellas todo sigue en archivos locales.
// La llave de servicio salta las políticas RLS: nunca debe llegar al navegador. Esquema: supabase/schema.sql.

const TIMEOUT_MS = 15_000;

function config() {
  // Solo el origen del proyecto: si alguien pega la URL de la API (…/rest/v1/), se recorta
  const url = process.env.SUPABASE_URL?.trim()
    .replace(/\/+$/, "")
    .replace(/\/(rest|storage)\/v1$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();
  return { url, key, bucket: process.env.SUPABASE_BUCKET?.trim() || "documentos" };
}

export function isSupabaseEnabled() {
  const c = config();
  return Boolean(c.url && c.key);
}

/** Las llaves nuevas (sb_secret_…) van solo en `apikey`; las antiguas (JWT) también en Authorization */
function headers(extra: Record<string, string> = {}) {
  const { key } = config();
  const h: Record<string, string> = { apikey: key!, ...extra };
  if (key!.startsWith("eyJ")) h.Authorization = `Bearer ${key}`;
  return h;
}

async function request(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  const { url } = config();
  return fetch(`${url}${path}`, { ...init, headers: headers(init.headers), cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
}

async function fail(res: Response, what: string): Promise<never> {
  const text = await res.text().catch(() => "");
  console.error(`Supabase: ${what} → ${res.status} ${text.slice(0, 300)}`);
  throw new Error(`No pudimos ${what} en Supabase (${res.status}).`);
}

// ---------------------------------------------------------------------------
// Base: una fila (id = "main") con el JSON completo y un número de versión
// ---------------------------------------------------------------------------

const STATE_ID = "main";

/** Lee la base. null si la tabla todavía no tiene la fila (base nueva) */
export async function readState(): Promise<{ data: unknown; version: number } | null> {
  const res = await request(`/rest/v1/app_state?id=eq.${STATE_ID}&select=data,version`);
  if (!res.ok) await fail(res, "leer la base");
  const rows = (await res.json()) as { data: unknown; version: number }[];
  return rows[0] ?? null;
}

/**
 * Guarda la base solo si nadie la cambió desde que se leyó (`version`). null = la fila aún no existe (la crea).
 * Devuelve false si hubo un conflicto: quien llamó debe volver a leer y reintentar.
 */
export async function writeState(data: unknown, version: number | null): Promise<boolean> {
  if (version === null) {
    const res = await request("/rest/v1/app_state", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ id: STATE_ID, data, version: 1 }),
    });
    if (res.status === 409) return false; // otra instancia la creó primero
    if (!res.ok) await fail(res, "crear la base");
    return true;
  }
  const res = await request(`/rest/v1/app_state?id=eq.${STATE_ID}&version=eq.${version}&select=version`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ data, version: version + 1, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) await fail(res, "guardar la base");
  const rows = (await res.json()) as unknown[];
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Documentos: bucket privado de Storage
// ---------------------------------------------------------------------------

const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

/** Sube un archivo al bucket privado. Devuelve la referencia que se guarda en la base */
export async function uploadObject(path: string, bytes: Uint8Array, mime: string) {
  const { bucket } = config();
  const res = await request(`/storage/v1/object/${bucket}/${encodePath(path)}`, {
    method: "POST",
    headers: { "Content-Type": mime, "x-upsert": "true" },
    body: new Blob([new Uint8Array(bytes)], { type: mime }),
  });
  if (!res.ok) await fail(res, "guardar el documento");
  return `supabase:${bucket}/${path}`;
}

/** Borra archivos del bucket (si no existen, no pasa nada) */
export async function removeObjects(paths: string[]) {
  if (!paths.length) return;
  const { bucket } = config();
  const res = await request(`/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!res.ok) console.error(`Supabase: no se pudieron borrar ${paths.length} documento(s) → ${res.status}`);
}
