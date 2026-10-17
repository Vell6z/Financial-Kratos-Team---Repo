import { actorOf, audit } from "@/lib/audit";
import { handle } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { withDB } from "@/lib/db";
import { checkInvestorWallet } from "@/lib/investor-wallet";
import { changeInvestorWallet } from "@/lib/services";

/** Cambia la wallet del inversionista (de dónde paga y a dónde le llegan los retiros). Sus cajitas la siguen. */
export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));
  return handle(async () => {
    const wallet = await checkInvestorWallet(String(body.wallet ?? ""));
    return withDB(async (db) => {
      const user = await requireUser(db);
      requireRole(user, "inversor");
      const previous = user.wallet ?? null;
      changeInvestorWallet(db, user, wallet);
      audit(db, {
        category: "inversion",
        action: "wallet_cambiada",
        actor: actorOf(user),
        entity: { type: "usuario", id: user.id },
        summary: `Cambió su wallet de Interledger`,
        data: { anterior: previous, nueva: wallet },
      });
      return { wallet };
    });
  });
}
