import { actorOf, audit } from "@/lib/audit";
import { handle } from "@/lib/api";
import { publicOrigin } from "@/lib/origin";
import { requireAdmin, requireUser } from "@/lib/auth";
import { withDB } from "@/lib/db";
import { isInterledgerEnabled, revokeVaultGrant, startVaultGrant } from "@/lib/openpayments";
import { BusinessError } from "@/lib/services";

/** El operador pide el permiso de la bóveda: devuelve la URL de la wallet donde lo aprueba */
export async function POST(request: Request) {
  const origin = publicOrigin(request);
  return handle(async () => {
    await withDB(async (db) => requireAdmin(await requireUser(db)));
    if (!isInterledgerEnabled()) throw new BusinessError("Open Payments no está configurado");
    const { redirectUrl, pending } = await startVaultGrant(`${origin}/api/op/vault-grant/finish`, crypto.randomUUID());
    await withDB((db) => {
      db.pendingVaultGrant = pending;
    });
    return { redirectUrl };
  });
}

/** Revoca el permiso: los retiros vuelven a requerir aprobación en la wallet */
export async function DELETE() {
  return handle(async () => {
    const grant = await withDB(async (db) => {
      const admin = await requireUser(db);
      requireAdmin(admin);
      const g = db.vaultGrant;
      db.vaultGrant = null;
      if (g) audit(db, { category: "boveda", action: "permiso_boveda_revocado", actor: actorOf(admin), entity: { type: "boveda", id: "permiso" }, summary: "Revocó el permiso de retiros automáticos de la bóveda" });
      return g;
    });
    if (grant) await revokeVaultGrant(grant);
    return { ok: true };
  });
}
