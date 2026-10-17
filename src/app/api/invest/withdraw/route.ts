import { handle, parseLevel } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { withDB, newId } from "@/lib/db";
import { maxWithdrawalCop } from "@/lib/fx";
import { isInterledgerEnabled, sendFromVault, startPayment, VaultGrantError } from "@/lib/openpayments";
import { BusinessError, checkWithdraw, debitWithdraw, refundWithdraw } from "@/lib/services";

/**
 * Retiro: la bóveda le envía al inversionista (capital + rendimiento) por Interledger.
 * - Si el operador ya autorizó la bóveda (permiso guardado), el pago sale de inmediato, sin aprobar en la wallet.
 * - Si no, el operador debe aprobar este retiro en la wallet de la bóveda.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const origin = new URL(request.url).origin;
  return handle(async () => {
    const level = parseLevel(body.level);
    const amountCop = Number(body.amountCop);
    const max = (await maxWithdrawalCop()).cop;

    if (!isInterledgerEnabled()) {
      await withDB(async (db) => {
        const user = await requireUser(db);
        requireRole(user, "inversor");
        if (!user.wallet) throw new BusinessError("No tienes una wallet registrada");
        debitWithdraw(db, user.wallet, level, amountCop, "simulado", max);
      });
      return { status: "completed", mode: "simulado" };
    }

    // Reserva el saldo antes de enviar, para que dos retiros a la vez no gasten lo mismo
    const reserved = await withDB(async (db) => {
      const user = await requireUser(db);
      requireRole(user, "inversor");
      if (!user.wallet) throw new BusinessError("No tienes una wallet registrada");
      checkWithdraw(db, user.wallet, level, amountCop, max);
      if (!db.vaultGrant) return { wallet: user.wallet, grant: null, txId: null };
      const txId = debitWithdraw(db, user.wallet, level, amountCop, "interledger", max);
      return { wallet: user.wallet, grant: db.vaultGrant, txId };
    });

    if (reserved.grant && reserved.txId) {
      try {
        const sent = await sendFromVault(reserved.grant, reserved.wallet, amountCop);
        await withDB((db) => {
          db.vaultGrant = sent.grant;
          const tx = db.txs.find((t) => t.id === reserved.txId);
          if (tx) tx.detail = `Retiro hacia ${reserved.wallet} (${sent.sent} → ${sent.received})`;
        });
        return { status: "completed", mode: "interledger", debit: sent.sent, receive: sent.received, quote: sent.quote };
      } catch (err) {
        await withDB((db) => {
          refundWithdraw(db, reserved.wallet, level, amountCop, reserved.txId!);
          // Si el permiso ya no sirve, se borra para que el operador lo renueve
          if (err instanceof VaultGrantError) db.vaultGrant = null;
        });
        throw err;
      }
    }

    // Sin permiso guardado: el operador aprueba este retiro en la wallet de la bóveda
    const id = newId();
    const started = await startPayment({
      kind: "withdraw",
      investorWallet: reserved.wallet,
      amountCop,
      finishUrl: `${origin}/api/op/finish/${id}`,
      nonce: crypto.randomUUID(),
    });
    await withDB((db) => {
      db.pending.push({ id, kind: "withdraw", wallet: reserved.wallet, level, amountCop, createdAt: Date.now(), ...started });
    });
    return { status: "pending", redirectUrl: started.redirectUrl, debit: started.debit, receive: started.receive, quote: started.quote };
  });
}
