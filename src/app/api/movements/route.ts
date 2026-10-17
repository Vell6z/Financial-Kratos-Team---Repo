import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { withDB } from "@/lib/db";
import { BusinessError } from "@/lib/services";

/** Movimientos propios del usuario (nunca los de otros ni los de la bóveda). */
export async function GET() {
  return handle(() =>
    withDB(async (db) => {
      const user = await requireUser(db);
      if (user.role === "admin") throw new BusinessError("El operador consulta los movimientos en su panel");
      const mine = db.txs.filter((t) => (user.role === "inversor" ? t.wallet && t.wallet === user.wallet : t.cedula && t.cedula === user.cedula));
      return {
        role: user.role,
        items: mine.map(({ id, at, kind, level, amountCop, mode }) => ({ id, at, kind, level, amountCop, mode })),
      };
    }),
  );
}
