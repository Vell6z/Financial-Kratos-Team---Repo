import { promises as fs } from "fs";
import path from "path";
import { handle } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { withDB } from "@/lib/db";
import { readDocuments, type UploadedDoc } from "@/lib/doc-reader";
import { validateIdFile } from "@/lib/registration";
import { DOC_KEYS, DOCS, type DocKey, type StudyAnswers } from "@/lib/scoring";
import { BusinessError, saveStudy, studyView } from "@/lib/services";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

/** Resultado del estudio del acreditado de la sesión (null si no lo ha hecho) */
export async function GET() {
  return handle(() =>
    withDB(async (db) => {
      const user = await requireUser(db);
      requireRole(user, "acreditado");
      const a = db.applicants.find((x) => x.cedula === user.cedula);
      return { study: a ? studyView(db, a) : null };
    }),
  );
}

/** Envía el estudio (multipart): `answers` en JSON + documentos opcionales `doc_<clave>`. */
export async function POST(request: Request) {
  return handle(async () => {
    const form = await request.formData();
    let answers: StudyAnswers;
    try {
      answers = JSON.parse(String(form.get("answers") ?? ""));
    } catch {
      throw new BusinessError("Respuestas inválidas");
    }

    const files: [DocKey, File][] = [];
    for (const key of DOC_KEYS) {
      const f = form.get(`doc_${key}`);
      if (!(f instanceof File) || f.size === 0) continue;
      const error = validateIdFile(f, DOCS[key].toLowerCase());
      if (error) throw new BusinessError(error.replace("Adjunta la copia de tu documento", "Adjunta").replace("El documento", "El archivo"));
      files.push([key, f]);
    }

    const user = await withDB(async (db) => {
      const u = await requireUser(db);
      requireRole(u, "acreditado");
      return u;
    });

    const uploads: UploadedDoc[] = await Promise.all(files.map(async ([key, f]) => ({ key, name: f.name, mime: f.type, bytes: Buffer.from(await f.arrayBuffer()) })));

    // Los documentos se guardan fuera de /public: no quedan expuestos en la web
    const docs: Partial<Record<DocKey, string>> = {};
    if (uploads.length) {
      const dir = path.join(process.cwd(), "data", "uploads", user.id, "estudio");
      await fs.mkdir(dir, { recursive: true });
      for (const u of uploads) {
        const file = path.join(dir, `${u.key}.${EXT[u.mime]}`);
        await fs.writeFile(file, u.bytes);
        docs[u.key] = path.relative(process.cwd(), file);
      }
    }

    // Lectura con IA (Gemini) si hay GEMINI_API_KEY; si no, trucos en el nombre del archivo
    const readings = await readDocuments(uploads);

    return withDB((db) => saveStudy(db, user.cedula, user.name, user.age, answers, docs, readings));
  });
}
