import { requireUser } from "@/lib/auth";
import { buildPlanPdf, planFileName } from "@/lib/credit-docs";
import { now, withDB } from "@/lib/db";
import { pdfResponse } from "@/lib/pdf-response";
import { BusinessError } from "@/lib/services";

/** Plan de pagos del crédito en PDF, con el estado de cada cuota. Para el acreditado dueño o el operador. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return pdfResponse(request, () =>
    withDB(async (db) => {
      const user = await requireUser(db);
      const loan = db.loans.find((l) => l.id === id && (user.role === "admin" || (user.role === "acreditado" && l.cedula === user.cedula)));
      if (!loan || loan.status === "cancelado") throw new BusinessError("No encontramos ese crédito");
      return { body: buildPlanPdf(loan, now(db)), name: planFileName(loan) };
    }),
  );
}
