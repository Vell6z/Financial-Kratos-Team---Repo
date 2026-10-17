import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { now, withDB } from "@/lib/db";
import { buildReceiptPdf, receiptFileName } from "@/lib/receipts";
import { BusinessError } from "@/lib/services";

/** Comprobante en PDF de una inversión o un retiro. Solo para su dueño o el operador. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let pdf: { body: Buffer; name: string } | null = null;
  const error = await handle(async () => {
    pdf = await withDB(async (db) => {
      const user = await requireUser(db);
      const tx = db.txs.find((t) => t.id === id);
      const mine = tx && (user.role === "admin" || (user.role === "inversor" && tx.wallet && tx.wallet === user.wallet));
      // Igual respuesta si no existe o es de otro: no se revela qué movimientos existen
      if (!tx || !mine || (tx.kind !== "deposito_ilp" && tx.kind !== "retiro_ilp")) throw new BusinessError("No encontramos ese comprobante");
      return { body: buildReceiptPdf(tx, now(db)), name: receiptFileName(tx) };
    });
    return null;
  });
  if (!pdf) return error;
  const { body, name } = pdf as { body: Buffer; name: string };
  const download = new URL(request.url).searchParams.has("descargar");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
