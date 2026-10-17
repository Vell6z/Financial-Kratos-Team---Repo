import { handle } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { brebMode, holderMatches, resolveBrebKey } from "@/lib/breb";
import { BREB_KEY_TYPE_IDS, brebKeyFormatError, normalizeBrebKey, type BrebKeyType } from "@/lib/breb-keys";
import { newId, withDB } from "@/lib/db";
import { BusinessError } from "@/lib/services";

const TTL_MS = 5 * 60 * 1000;

/** Contra qué directorio se verifica: sandbox, producción o simulado (sin credenciales) */
export async function GET() {
  return handle(async () => ({ mode: brebMode() }));
}

/**
 * Verifica una llave Bre-B en el directorio (solo lectura, no mueve dinero) y guarda el resultado por 5 minutos.
 * Devuelve el titular enmascarado y la entidad para que el usuario confirme el beneficiario.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return handle(async () => {
    const key = normalizeBrebKey(String(body.key ?? ""));
    const keyType = String(body.keyType ?? "") as BrebKeyType;
    if (!BREB_KEY_TYPE_IDS.includes(keyType)) throw new BusinessError("Elige el tipo de llave");
    const formatError = brebKeyFormatError(key, keyType);
    if (formatError) throw new BusinessError(formatError);

    const user = await withDB(async (db) => {
      const u = await requireUser(db);
      requireRole(u, "acreditado");
      return u;
    });

    const r = await resolveBrebKey(key, keyType);
    if (!r.ok) throw new BusinessError(r.message);

    return withDB((db) => {
      const t = Date.now();
      // Solo se conservan las verificaciones vigentes de otros usuarios y las ya usadas (quedan en el crédito)
      db.brebVerifications = db.brebVerifications.filter((v) => v.status === "USED" || (v.userId !== user.id && v.expiresAt > t));
      const v = {
        id: newId(),
        userId: user.id,
        key: r.keyValue || key,
        keyType: r.keyType,
        holderName: r.holderName,
        financialEntity: r.financialEntity,
        nameMatches: holderMatches(r.holderName, user.name),
        mode: r.mode,
        status: "VERIFIED" as const,
        verifiedAt: t,
        expiresAt: t + TTL_MS,
      };
      db.brebVerifications.push(v);
      // Al navegador no van el usuario ni el estado interno
      return { id: v.id, key: v.key, keyType: v.keyType, holderName: v.holderName, financialEntity: v.financialEntity, nameMatches: v.nameMatches, mode: v.mode, expiresAt: v.expiresAt };
    });
  });
}
