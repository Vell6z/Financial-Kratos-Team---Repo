import { handle } from "@/lib/api";
import { requireAdmin, requireUser } from "@/lib/auth";
import { emptyDB, withDB } from "@/lib/db";
import { accrueAll, BusinessError } from "@/lib/services";

/** Controles de demo: adelantar el reloj (para ver intereses y cuotas) y reiniciar los datos. */
export async function POST(request: Request) {
  const { action, days } = await request.json();
  return handle(() =>
    withDB(async (db) => {
      requireAdmin(await requireUser(db));
      if (action === "advance") {
        accrueAll(db);
        db.clockOffsetMs += Number(days) * 86_400_000;
        accrueAll(db);
      } else if (action === "reset") {
        // Conserva las cuentas de usuario, sus sesiones y el permiso de la bóveda; borra el resto de la demo
        Object.assign(db, { ...emptyDB(), users: db.users, sessions: db.sessions, vaultGrant: db.vaultGrant });
      } else {
        throw new BusinessError("Acción inválida");
      }
      return { ok: true };
    }),
  );
}
