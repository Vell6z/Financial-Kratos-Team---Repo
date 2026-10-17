import { handle } from "@/lib/api";
import { checkRegistration, register, setSessionCookie, toPublic } from "@/lib/auth";
import { removeUploads, saveUpload } from "@/lib/uploads";
import type { FaceCheck } from "@/lib/db";
import { newId, withDB } from "@/lib/db";
import {
  decryptDescriptor,
  encryptDescriptor,
  getFaceVerifier,
  isValidDescriptor,
  type KnownFace,
  type LivenessFrame,
} from "@/lib/faceverify";
import { isInterledgerEnabled, normalizeWallet, walletExists } from "@/lib/openpayments";
import { EMPTY_REGISTRATION, type RegistrationData, validateIdFile } from "@/lib/registration";
import { BusinessError } from "@/lib/services";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

/** Registro completo (multipart): datos personales, perfil según el rol, copias del documento y contraseña. */
export async function POST(request: Request) {
  return handle(async () => {
    const form = await request.formData();
    const data = Object.fromEntries(
      Object.keys(EMPTY_REGISTRATION).map((k) => [k, String(form.get(k) ?? "")]),
    ) as unknown as RegistrationData;
    const files = { idFront: form.get("idFront"), idBack: form.get("idBack") };
    for (const [key, side] of [["idFront", "lado principal"], ["idBack", "lado secundario"]] as const) {
      const f = files[key];
      const error = validateIdFile(f instanceof File ? f : null, side);
      if (error) throw new BusinessError(error);
    }

    await withDB((db) => checkRegistration(db, data));
    const wallet = data.role === "inversor" ? normalizeWallet(data.wallet) : undefined;
    if (wallet && isInterledgerEnabled() && !(await walletExists(wallet)))
      throw new BusinessError("No encontramos esa wallet address en Interledger. Revísala.");

    // --- Verificación facial (ver docs/verificacion-facial.md) ---
    // 1) liveness (giro de cabeza) y descriptor llegan del cliente; se validan aquí.
    //    Sin cámara (faceSkipped): la cuenta se crea en revisión del operador, sin dato biométrico.
    const verifier = getFaceVerifier();
    const skipped = form.get("faceSkipped") === "1";
    const descriptor = parseJson<number[]>(form.get("faceDescriptor"));
    const frames = parseJson<LivenessFrame[]>(form.get("faceFrames")) ?? [];
    let liveness: ReturnType<typeof verifier.checkLiveness> | null = null;
    if (!skipped) {
      if (!isValidDescriptor(descriptor)) throw new BusinessError("Completa la verificación facial antes de crear tu cuenta.");
      liveness = verifier.checkLiveness({ frames });
      if (!liveness.ok) throw new BusinessError(liveness.message ?? "No pudimos confirmar que eres una persona real. Repite la verificación facial.");
    }

    // Las copias del documento van a almacenamiento privado (bucket de Supabase o data/uploads): no quedan expuestas en la web
    const id = newId();
    const documents = { idFront: "", idBack: "" };
    const saved: string[] = [];
    try {
      for (const key of ["idFront", "idBack"] as const) {
        const f = files[key] as File;
        const objectKey = `${id}/${key}.${EXT[f.type]}`;
        documents[key] = await saveUpload(objectKey, new Uint8Array(await f.arrayBuffer()), f.type);
        saved.push(objectKey);
      }
    } catch (err) {
      await removeUploads(saved);
      throw err;
    }

    try {
      const { user, token } = await withDB((db) => {
        if (skipped || !descriptor || !liveness) {
          // Sin cámara: el operador verifica la identidad por otro medio (videollamada, presencial…)
          const check: FaceCheck = { mode: "sin_camara", liveness: false, yawRange: 0, documentDistance: -1, dedupDistance: null, challenge: "none", reviewReason: "sin_camara", at: Date.now() };
          return register(db, data, { id, wallet, documents, face: { verification: "pendiente", check } });
        }

        // 2) Deduplicación 1:N contra las caras ya registradas (descriptores descifrados en memoria).
        const known: KnownFace[] = db.users
          .filter((u) => u.faceDescriptor)
          .map((u) => ({ userId: u.id, cedula: u.cedula, descriptor: decryptDescriptor(u.faceDescriptor) }))
          .filter((k) => k.descriptor.length > 0);
        const duplicate = verifier.findDuplicate(descriptor, known);

        // Nunca se rechaza en automático: los umbrales del descriptor local todavía no están calibrados con
        // personas reales, así que un parecido (claro o en zona gris) solo deja la cuenta en revisión del operador.
        const check: FaceCheck = {
          mode: verifier.mode,
          liveness: true,
          yawRange: Math.round(liveness.yawRange),
          // En modo local no se compara contra el documento (ver docs): lo hará el IDV en producción.
          documentDistance: -1,
          dedupDistance: duplicate ? Math.round(duplicate.distance * 1000) / 1000 : null,
          dedupMatchCedula: duplicate?.cedula,
          challenge: "turn_head",
          reviewReason: duplicate ? (duplicate.certain ? "duplicado_probable" : "parecido") : undefined,
          at: Date.now(),
        };
        const verification = duplicate ? "pendiente" : "aprobada";

        return register(db, data, {
          id,
          wallet,
          documents,
          face: { verification, descriptor: encryptDescriptor(descriptor), check },
        });
      });
      await setSessionCookie(token);
      return toPublic(user);
    } catch (err) {
      await removeUploads(saved);
      throw err;
    }
  });
}

/** Parsea un campo JSON del formulario; null si falta o está mal formado. */
function parseJson<T>(value: FormDataEntryValue | null): T | null {
  if (typeof value !== "string" || !value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
