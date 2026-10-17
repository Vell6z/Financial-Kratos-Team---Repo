import { handle } from "@/lib/api";
import { requireAdmin, requireUser } from "@/lib/auth";
import { now, withDB } from "@/lib/db";
import { isInterledgerEnabled } from "@/lib/openpayments";
import { processPayouts } from "@/lib/payouts";
import { accrueAll, loanView } from "@/lib/services";

export async function GET() {
  return handle(async () => {
    await processPayouts();
    return withDB(async (db) => {
      requireAdmin(await requireUser(db));
      accrueAll(db);
      return {
        now: now(db),
        clockOffsetDays: Math.round(db.clockOffsetMs / 86_400_000),
        interledger: isInterledgerEnabled(),
        // Permiso de retiros automáticos (sin el token)
        vaultGrant: db.vaultGrant
          ? {
              grantedAt: db.vaultGrant.grantedAt,
              assetCode: db.vaultGrant.limit.assetCode,
              limit: Number(db.vaultGrant.limit.value) / 10 ** db.vaultGrant.limit.assetScale,
              spent: Number(db.vaultGrant.spent) / 10 ** db.vaultGrant.limit.assetScale,
            }
          : null,
        pools: db.pools,
        investorBalance: db.positions.reduce((s, p) => s + p.balance, 0),
        loans: db.loans.map((l) => loanView(db, l)),
        txs: db.txs.slice(0, 40),
      };
    });
  });
}
