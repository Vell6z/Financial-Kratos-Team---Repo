import { requireUser } from "@/lib/auth";
import { now, withDB } from "@/lib/db";
import { pdfResponse } from "@/lib/pdf-response";
import { buildReceiptPdf, hasReceipt, receiptFileName } from "@/lib/receipts";
import { BusinessError } from "@/lib/services";

/** Comprobante en PDF de un movimiento (inversión, retiro, desembolso o pago). Solo para su dueño o el operador. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return pdfResponse(request, () =>
    withDB(async (db) => {
      const user = await requireUser(db);
      const tx = db.txs.find((t) => t.id === id);
      const mine =
        tx &&
        (user.role === "admin" ||
          (user.role === "inversor" && tx.wallet && tx.wallet === user.wallet) ||
          (user.role === "acreditado" && tx.cedula && tx.cedula === user.cedula));
      // Igual respuesta si no existe o es de otro: no se revela qué movimientos existen
      if (!tx || !mine || !hasReceipt(db, tx)) throw new BusinessError("No encontramos ese comprobante");
      return { body: buildReceiptPdf(db, tx, now(db)), name: receiptFileName(tx) };
    }),
  );
}
