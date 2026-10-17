import { promises as fs } from "fs";
import path from "path";
import { handle } from "@/lib/api";
import { checkRegistration, register, setSessionCookie, toPublic } from "@/lib/auth";
import { newId, withDB } from "@/lib/db";
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

    // Las copias del documento se guardan fuera de /public: no quedan expuestas en la web
    const id = newId();
    const dir = path.join(process.cwd(), "data", "uploads", id);
    await fs.mkdir(dir, { recursive: true });
    const documents = { idFront: "", idBack: "" };
    for (const key of ["idFront", "idBack"] as const) {
      const f = files[key] as File;
      const file = path.join(dir, `${key}.${EXT[f.type]}`);
      await fs.writeFile(file, Buffer.from(await f.arrayBuffer()));
      documents[key] = path.relative(process.cwd(), file);
    }

    try {
      const { user, token } = await withDB((db) => register(db, data, { id, wallet, documents }));
      await setSessionCookie(token);
      return toPublic(user);
    } catch (err) {
      await fs.rm(dir, { recursive: true, force: true });
      throw err;
    }
  });
}
