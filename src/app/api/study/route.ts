import { actorOf, audit } from "@/lib/audit";
import { handle } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
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

    // Los documentos van a almacenamiento privado (bucket de Supabase o data/uploads): no quedan expuestos en la web
    const docs: Partial<Record<DocKey, string>> = {};
    for (const u of uploads) docs[u.key] = await saveUpload(`${user.id}/estudio/${u.key}.${EXT[u.mime]}`, new Uint8Array(u.bytes), u.mime);

    // Lectura con IA (Gemini) si hay GEMINI_API_KEY; si no, trucos en el nombre del archivo
    const readings = await readDocuments(uploads);

    return withDB((db) => {
      const result = saveStudy(db, user.cedula, user.name, user.age, answers, docs, readings);
      const a = db.applicants.find((x) => x.cedula === user.cedula);
      audit(db, {
        category: "estudio",
        action: "estudio_realizado",
        actor: actorOf(user),
        entity: { type: "usuario", id: user.id },
        summary: `Estudio de crédito: puntaje ${a?.score ?? "—"}/100 · ${a?.riskLevel === 4 ? "no apto por ahora" : `nivel ${a?.scoreLevel ?? "—"}`}`,
        data: {
          puntaje: a?.score ?? null,
          nivel: a?.riskLevel ?? null,
          ajusteML: a?.ml?.adjustment ?? null,
          documentos: Object.keys(docs).length,
          lectura: readings ? Object.values(readings)[0]?.source ?? null : null,
        },
      });
      return result;
    });
  });
}
