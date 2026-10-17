import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { withDB } from "@/lib/db";
import { hasReceipt } from "@/lib/receipts";
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
        items: mine.map((tx) => ({
          id: tx.id,
          at: tx.at,
          kind: tx.kind,
          level: tx.level,
          amountCop: tx.amountCop,
          mode: tx.mode,
          // Comprobante en PDF (/api/receipts/[id])
          hasReceipt: hasReceipt(db, tx),
          partial: Boolean(tx.receipt && tx.receipt.requestedCop !== tx.amountCop),
        })),
      };
    }),
  );
}
