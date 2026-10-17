import { requireUser } from "@/lib/auth";
import { buildReleasePdf, releaseFileName } from "@/lib/credit-docs";
import { now, withDB } from "@/lib/db";
import { pdfResponse } from "@/lib/pdf-response";
import { loanForTx } from "@/lib/receipts";
import { BusinessError } from "@/lib/services";

/** Paz y salvo en PDF: solo cuando el crédito quedó pagado completo. Para el acreditado dueño o el operador. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return pdfResponse(request, () =>
    withDB(async (db) => {
      const user = await requireUser(db);
      const loan = db.loans.find((l) => l.id === id && (user.role === "admin" || (user.role === "acreditado" && l.cedula === user.cedula)));
      if (!loan) throw new BusinessError("No encontramos ese crédito");
      if (loan.status !== "pagado") throw new BusinessError("El paz y salvo se expide cuando terminas de pagar el crédito");
      const holder = db.users.find((u) => u.cedula === loan.cedula);
      const payments = db.txs.filter((t) => t.kind === "pago_breb" && t.cedula === loan.cedula && loanForTx(db, t)?.id === loan.id);
      return { body: buildReleasePdf(loan, { name: holder?.name ?? loan.name, cedula: loan.cedula }, payments, now(db)), name: releaseFileName(loan) };
    }),
  );
}
