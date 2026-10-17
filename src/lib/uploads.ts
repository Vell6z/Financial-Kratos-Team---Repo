import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { isSupabaseEnabled, removeObjects, uploadObject } from "./supabase";

// Documentos que suben los usuarios (cédula en el registro, soportes del estudio).
// Con Supabase van a un bucket privado; sin Supabase, a data/uploads/ (fuera de /public: no quedan expuestos en la web).
// `key` es la ruta dentro del almacenamiento, por ejemplo "a1b2c3d4/idFront.jpg".

const LOCAL_DIR = path.join(process.cwd(), "data", "uploads");

/** Guarda un documento y devuelve la referencia que queda en la base */
export async function saveUpload(key: string, bytes: Uint8Array, mime: string): Promise<string> {
  if (isSupabaseEnabled()) return uploadObject(key, bytes, mime);
  const file = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
  return path.relative(process.cwd(), file);
}

/** Borra documentos ya guardados (por ejemplo, si el registro falló después de subirlos) */
export async function removeUploads(keys: string[]) {
  if (isSupabaseEnabled()) return removeObjects(keys);
  await Promise.all(keys.map((k) => fs.rm(path.join(LOCAL_DIR, k), { force: true })));
}
