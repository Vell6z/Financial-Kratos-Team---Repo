import type { NextRequest } from "next/server";
import { withDB } from "@/lib/db";
import { finishPayment, verifyInteractHash } from "@/lib/openpayments";
import { processPayouts } from "@/lib/payouts";
import { creditDeposit, debitWithdraw } from "@/lib/services";

/** Callback de Open Payments: el usuario aprobó (o rechazó) el pago en su wallet. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = request.nextUrl.searchParams;
  const back = (status: string, message?: string) => {
    const url = new URL("/invertir", request.nextUrl.origin);
    url.searchParams.set("pago", status);
    if (message) url.searchParams.set("msg", message);
    return Response.redirect(url, 303);
  };

  const pending = await withDB((db) => {
    const i = db.pending.findIndex((p) => p.id === id);
    return i >= 0 ? db.pending.splice(i, 1)[0] : null;
  });
  if (!pending) return back("error", "El pago ya fue procesado o expiró");

  const interactRef = q.get("interact_ref");
  if (q.get("result") === "grant_rejected" || !interactRef) return back("rechazado");
  if (!verifyInteractHash(pending, interactRef, q.get("hash"))) return back("error", "No pudimos verificar la aprobación del pago");

  try {
    await finishPayment({ ...pending, interactRef });
    await withDB((db) =>
      pending.kind === "deposit"
        ? creditDeposit(db, pending.wallet, pending.level, pending.amountCop, "interledger")
        : debitWithdraw(db, pending.wallet, pending.level, pending.amountCop, "interledger"),
    );
    if (pending.kind === "deposit") void processPayouts();
    return back(pending.kind === "deposit" ? "invertido" : "retirado");
  } catch (err) {
    console.error(err);
    return back("error", err instanceof Error ? err.message : "Error completando el pago");
  }
}
