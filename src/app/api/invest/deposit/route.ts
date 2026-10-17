import { handle, parseLevel } from "@/lib/api";
import { requireRole, requireUser, requireVerifiedIdentity } from "@/lib/auth";
import { withDB, newId } from "@/lib/db";
import { isInterledgerEnabled, normalizeWallet, startPayment } from "@/lib/openpayments";
import { MIN_INVESTMENT } from "@/lib/config";
import { processPayouts } from "@/lib/payouts";
import { BusinessError, creditDeposit } from "@/lib/services";
import { validateMoney, validateWallet } from "@/lib/validators";

/**
 * Inversión: el extranjero envía dinero a la bóveda por Interledger.
 * Con Open Payments configurado devuelve la URL para aprobar el pago en su wallet; si no, se simula.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const origin = new URL(request.url).origin;
  return handle(async () => {
    const level = parseLevel(body.level);
    const amountCop = Number(body.amountCop);
    const amountError = validateMoney(amountCop, { min: MIN_INVESTMENT });
    if (amountError) throw new BusinessError(amountError);
    const walletError = body.wallet ? validateWallet(String(body.wallet)) : null;
    if (walletError) throw new BusinessError(walletError);
    // La wallet indicada queda guardada en el perfil del usuario
    const wallet = await withDB(async (db) => {
      const user = await requireUser(db);
      requireRole(user, "inversor");
      requireVerifiedIdentity(user, "invertir");
      if (body.wallet) user.wallet = normalizeWallet(String(body.wallet));
      if (!user.wallet) throw new BusinessError("Ingresa tu wallet address de Interledger");
      return user.wallet;
    });

    if (!isInterledgerEnabled()) {
      const txId = await withDB((db) => creditDeposit(db, wallet, level, amountCop, "simulado"));
      void processPayouts();
      return { status: "completed", mode: "simulado", txId };
    }

    const id = newId();
    const started = await startPayment({
      kind: "deposit",
      investorWallet: wallet,
      amountCop,
      finishUrl: `${origin}/api/op/finish/${id}`,
      nonce: crypto.randomUUID(),
    });
    await withDB((db) => {
      db.pending.push({ id, kind: "deposit", wallet, level, amountCop, createdAt: Date.now(), ...started });
    });
    return { status: "pending", redirectUrl: started.redirectUrl, debit: started.debit, receive: started.receive, quote: started.quote };
  });
}
