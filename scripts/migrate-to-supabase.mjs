// Migra la demo local a Supabase (una sola vez):
// 1. Sube los documentos de data/uploads/ al bucket privado y cambia sus rutas en la base a "supabase:<bucket>/<ruta>".
// 2. Guarda la base en la fila app_state (la crea si no existe; si ya existe, la actualiza con control de versión).
// No borra nada local: data/db.json y data/uploads/ quedan como respaldo.
// Uso: npm run supabase:migrate   (lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env)

import { readFile, access } from "node:fs/promises";
import path from "node:path";

process.loadEnvFile?.(".env");

const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "").replace(/\/(rest|storage)\/v1$/, "");
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();
const bucket = process.env.SUPABASE_BUCKET?.trim() || "documentos";
if (!url || !key) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const headers = (extra = {}) => ({ apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), ...extra });
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
const LOCAL_PREFIX = path.join("data", "uploads") + path.sep;

async function api(p, init = {}) {
  const res = await fetch(`${url}${p}`, { ...init, headers: headers(init.headers) });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${p.split("?")[0]} → ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

/** Sube un documento local y devuelve su referencia nueva (o la misma si no es local o el archivo no existe) */
const uploaded = new Map();
async function migrateRef(ref) {
  if (typeof ref !== "string" || !ref.startsWith(LOCAL_PREFIX)) return ref;
  if (uploaded.has(ref)) return uploaded.get(ref);
  const objectKey = ref.slice(LOCAL_PREFIX.length).split(path.sep).join("/");
  try {
    await access(ref);
  } catch {
    console.warn(`  · No existe ${ref}: se deja la ruta igual`);
    return ref;
  }
  const mime = MIME[path.extname(ref).slice(1).toLowerCase()] ?? "application/octet-stream";
  const bytes = await readFile(ref);
  await api(`/storage/v1/object/${bucket}/${objectKey.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { "Content-Type": mime, "x-upsert": "true" },
    body: new Blob([bytes], { type: mime }),
  });
  const next = `supabase:${bucket}/${objectKey}`;
  uploaded.set(ref, next);
  return next;
}

// 1. Punto de partida: la fila de Supabase si ya existe (el servidor pudo crearla), si no data/db.json
const rows = await (await api(`/rest/v1/app_state?id=eq.main&select=data,version`)).json();
let data, version;
if (rows[0]) {
  ({ data, version } = rows[0]);
  console.log(`Supabase ya tiene la base (versión ${version}): se actualizan las rutas de los documentos.`);
} else {
  data = JSON.parse(await readFile(path.join("data", "db.json"), "utf8"));
  version = null;
  console.log("Supabase está vacío: se sube data/db.json.");
}

// 2. Documentos: cédula de cada usuario y soportes del estudio
for (const u of data.users ?? []) {
  if (!u.documents) continue;
  for (const side of ["idFront", "idBack"]) u.documents[side] = await migrateRef(u.documents[side]);
}
for (const a of data.applicants ?? []) {
  for (const k of Object.keys(a.docs ?? {})) a.docs[k] = await migrateRef(a.docs[k]);
}
console.log(`Documentos subidos al bucket "${bucket}": ${uploaded.size}`);

// 3. Guarda la base
if (version === null) {
  await api(`/rest/v1/app_state`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ id: "main", data, version: 1 }),
  });
} else {
  const res = await api(`/rest/v1/app_state?id=eq.main&version=eq.${version}&select=version`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ data, version: version + 1, updated_at: new Date().toISOString() }),
  });
  if (!(await res.json()).length) throw new Error("La base cambió mientras migraba (alguien usó la app). Vuelve a correr el script.");
}

const counts = ["users", "positions", "applicants", "loans", "txs"].map((k) => `${k}: ${(data[k] ?? []).length}`).join(", ");
console.log(`Listo. Base en Supabase → ${counts}`);
