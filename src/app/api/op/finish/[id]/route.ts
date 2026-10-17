import { audit, ownerActor, SYSTEM } from "@/lib/audit";
import type { NextRequest } from "next/server";
import { withDB } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { finishPayment, receivedShare, vaultUrl, verifyInteractHash } from "@/lib/openpayments";
import { processPayouts } from "@/lib/payouts";
import { createRecurring, recurringReceipt } from "@/lib/recurring";
import { creditDeposit, debitWithdraw } from "@/lib/services";

/** Callback de Open Payments: el usuario aprobó (o rechazó) el pago en su wallet. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = request.nextUrl.searchParams;
  const back = (status: string, message?: string, txId?: string) => {
    const url = new URL("/invertir", publicOrigin(request));
    url.searchParams.set("pago", status);
    if (message) url.searchParams.set("msg", message);
    if (txId) url.searchParams.set("tx", txId);
    return Response.redirect(url, 303);
  };

  const pending = await withDB((db) => {
    const i = db.pending.findIndex((p) => p.id === id);
    return i >= 0 ? db.pending.splice(i, 1)[0] : null;
  });
  if (!pending) return back("error", "El pago ya fue procesado o expiró");

  // Trazabilidad de los pagos que no se completan (los completados los registra creditDeposit / debitWithdraw)
  const kind = pending.kind === "deposit" ? "inversión" : "retiro";
  const fail = (action: string, summary: string) =>
    withDB((db) =>
      audit(db, {
        category: "inversion",
        action,
        actor: pending.kind === "deposit" ? ownerActor(db, { wallet: pending.wallet }) : SYSTEM,
        summary,
        data: { monto: pending.amountCop, nivel: pending.level, tipo: pending.kind },
      }),
    );

  const interactRef = q.get("interact_ref");
  if (q.get("result") === "grant_rejected" || !interactRef) {
    await fail("pago_rechazado_en_wallet", `No se aprobó en la wallet la ${kind} de ${pending.amountCop.toLocaleString("es-CO")} pesos`);
    return back("rechazado");
  }
  if (!verifyInteractHash(pending, interactRef, q.get("hash"))) {
    await fail("aprobacion_no_verificada", `La vuelta de la wallet no pasó la verificación del hash GNAP (${kind})`);
    return back("error", "No pudimos verificar la aprobación del pago");
  }

  try {
    const { confirmation, token } = await finishPayment({ ...pending, interactRef });
    // Se abona (o descuenta) lo que confirmó la wallet que recibe, no lo que se pidió
    const share = confirmation ? receivedShare(confirmation) : 1;
    const amountCop = Math.round(pending.amountCop * share);
    const txId = await withDB((db) => {
      const id =
        pending.kind === "deposit"
          ? creditDeposit(db, pending.wallet, pending.level, amountCop, "interledger", { partial: share < 1 })
          : debitWithdraw(db, pending.wallet, pending.level, amountCop, "interledger");
      const tx = db.txs.find((t) => t.id === id);
      if (tx?.receipt) Object.assign(tx.receipt, { vaultWallet: vaultUrl(), requestedCop: pending.amountCop, quote: pending.quote, confirmation });
      // Inversión recurrente: se guarda el permiso para cobrar el mismo monto en los siguientes intervalos
      if (pending.kind === "deposit" && pending.recurring) {
        const r = pending.recurring;
        const subId = createRecurring(db, {
          wallet: pending.wallet,
          level: pending.level,
          mode: "interledger",
          amountCop: pending.amountCop,
          interval: r.interval,
          start: Date.parse(r.start),
          debitAmount: r.debitAmount,
          grant: token,
        });
        if (tx?.receipt) tx.receipt.recurring = recurringReceipt(db.recurring!.find((s) => s.id === subId)!, 1);
      }
      return id;
    });
    if (pending.kind === "deposit") void processPayouts();
    if (share < 1)
      return back(
        "parcial",
        `Llegó solo una parte del pago: ${Math.round(share * 100)} %. ${pending.kind === "deposit" ? "Abonamos a tu cajita" : "Descontamos de tu cajita"} ${amountCop.toLocaleString("es-CO")} pesos.`,
        txId,
      );
    return back(pending.kind === "deposit" ? "invertido" : "retirado", undefined, txId);
  } catch (err) {
    console.error(err);
    await fail("pago_fallido", `No se completó la ${kind}: ${err instanceof Error ? err.message : "error de Interledger"}`).catch(() => {});
    return back("error", err instanceof Error ? err.message : "Error completando el pago");
  }
}
