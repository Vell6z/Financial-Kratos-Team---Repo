import { handle } from "@/lib/api";
import { requireAdmin, requireUser } from "@/lib/auth";
import { emptyDB, withDB } from "@/lib/db";
import { processRecurring } from "@/lib/recurring";
import { accrueAll, BusinessError } from "@/lib/services";

/**
 * Controles del operador: adelantar el reloj y reiniciar la demo, además de resolver la cola de
 * revisión de verificaciones faciales en zona gris (aprobar/rechazar un usuario pendiente).
 */
export async function POST(request: Request) {
  const { action, days, userId } = await request.json();
  return handle(async () => {
    const result = await withDB(async (db) => {
      requireAdmin(await requireUser(db));
      if (action === "advance") {
        accrueAll(db);
        db.clockOffsetMs += Number(days) * 86_400_000;
        accrueAll(db);
      } else if (action === "reset") {
        // Conserva las cuentas de usuario, sus sesiones y el permiso de la bóveda; borra el resto de la demo
        Object.assign(db, { ...emptyDB(), users: db.users, sessions: db.sessions, vaultGrant: db.vaultGrant });
      } else if (action === "face-approve" || action === "face-reject") {
        const user = db.users.find((u) => u.id === userId);
        if (!user) throw new BusinessError("Usuario no encontrado");
        if (user.faceVerification !== "pendiente") throw new BusinessError("Esta verificación facial ya se resolvió");
        if (action === "face-reject") {
          // Rechazo por duplicado/identidad: la cuenta queda bloqueada y se borra el dato biométrico
          user.faceVerification = "rechazada";
          delete user.faceDescriptor;
        } else {
          user.faceVerification = "aprobada";
        }
      } else {
        throw new BusinessError("Acción inválida");
      }
      return { ok: true };
    });
    // Al adelantar el reloj, las inversiones recurrentes simuladas que vencieron se cobran de una vez
    if (action === "advance") await processRecurring();
    return result;
  });
}
