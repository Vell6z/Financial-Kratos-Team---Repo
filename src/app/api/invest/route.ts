import { handle } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { withDB } from "@/lib/db";
import { maxWithdrawalCop } from "@/lib/fx";
import { isInterledgerEnabled } from "@/lib/openpayments";
import { accrueAll, withdrawable } from "@/lib/services";

/** Cajitas del inversionista de la sesión (identificado por su wallet address) */
export async function GET() {
  return handle(async () => {
    const max = await maxWithdrawalCop();
    return withDB(async (db) => {
      const user = await requireUser(db);
      requireRole(user, "inversor");
      accrueAll(db);
      const positions = user.wallet ? db.positions.filter((p) => p.wallet === user.wallet) : [];
      // Cada cajita con su plazo y cuánto puede retirar hoy
      return { interledger: isInterledgerEnabled(), wallet: user.wallet ?? null, positions: positions.map((p) => ({ ...p, ...withdrawable(db, p, max.cop) })), maxWithdrawal: max };
    });
  });
}
