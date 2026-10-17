import { handle, parseLevel } from "@/lib/api";
import { requireRole, requireUser, requireVerifiedIdentity } from "@/lib/auth";
import { withDB, newId, now } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { isInterledgerEnabled, normalizeWallet, recurringInterval, startPayment } from "@/lib/openpayments";
import { createRecurring, recurringReceipt } from "@/lib/recurring";
import { intervalLabel } from "@/lib/recurring-interval";
import { MIN_INVESTMENT } from "@/lib/config";
import { processPayouts } from "@/lib/payouts";
import { BusinessError, changeInvestorWallet, creditDeposit } from "@/lib/services";
import { assertNotVault } from "@/lib/investor-wallet";
import { validateMoney, validateWallet } from "@/lib/validators";

/**
 * Inversión: el extranjero envía dinero a la bóveda por Interledger.
 * Con Open Payments configurado devuelve la URL para aprobar el pago en su wallet; si no, se simula.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const origin = publicOrigin(request);
  return handle(async () => {
    const level = parseLevel(body.level);
    const amountCop = Number(body.amountCop);
    // Repetir esta inversión cada intervalo (por defecto, cada mes)
    const recurring = body.recurring === true;
    const amountError = validateMoney(amountCop, { min: MIN_INVESTMENT });
    if (amountError) throw new BusinessError(amountError);
    const walletError = body.wallet ? validateWallet(String(body.wallet)) : null;
    if (walletError) throw new BusinessError(walletError);
    if (body.wallet) assertNotVault(String(body.wallet));
    // La wallet indicada queda guardada en el perfil del usuario; si cambió, sus cajitas pasan a la nueva
    const wallet = await withDB(async (db) => {
      const user = await requireUser(db);
      requireRole(user, "inversor");
      requireVerifiedIdentity(user, "invertir");
      if (body.wallet) changeInvestorWallet(db, user, normalizeWallet(String(body.wallet)));
      if (!user.wallet) throw new BusinessError("Ingresa tu wallet address de Interledger");
      assertNotVault(user.wallet);
      return user.wallet;
    });

    if (!isInterledgerEnabled()) {
      const txId = await withDB((db) => {
        const id = creditDeposit(db, wallet, level, amountCop, "simulado");
        if (recurring) {
          // Modo simulado: los cobros siguen el reloj de la demo
          const subId = createRecurring(db, { wallet, level, mode: "simulado", amountCop, interval: recurringInterval(), start: now(db) });
          const tx = db.txs.find((t) => t.id === id);
          if (tx?.receipt) tx.receipt.recurring = recurringReceipt(db.recurring!.find((s) => s.id === subId)!, 1);
        }
        return id;
      });
      void processPayouts();
      return { status: "completed", mode: "simulado", txId, recurring: recurring ? { intervalLabel: intervalLabel(recurringInterval()) } : null };
    }

    const id = newId();
    const started = await startPayment({
      kind: "deposit",
      investorWallet: wallet,
      amountCop,
      finishUrl: `${origin}/api/op/finish/${id}`,
      nonce: crypto.randomUUID(),
      recurring,
    });
    await withDB((db) => {
      db.pending.push({ id, kind: "deposit", wallet, level, amountCop, createdAt: Date.now(), ...started });
    });
    return {
      status: "pending",
      redirectUrl: started.redirectUrl,
      debit: started.debit,
      receive: started.receive,
      quote: started.quote,
      // El permiso que aprueba en la wallet: este monto en su moneda, cada intervalo
      recurring: started.recurring ? { intervalLabel: intervalLabel(started.recurring.interval) } : null,
    };
  });
}
