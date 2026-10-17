import { requireRole, requireUser } from "@/lib/auth";
import { buildHistoryCertificatePdf, historyFileName } from "@/lib/credit-docs";
import { now, withDB } from "@/lib/db";
import { pdfResponse } from "@/lib/pdf-response";
import { BusinessError } from "@/lib/services";

/** Certificado de historial crediticio en PDF: lo solicita el acreditado, solo el suyo */
export async function GET(request: Request) {
  return pdfResponse(request, () =>
    withDB(async (db) => {
      const user = await requireUser(db);
      requireRole(user, "acreditado");
      if (!db.applicants.some((a) => a.cedula === user.cedula)) throw new BusinessError("Haz tu estudio de crédito para tener historial");
      return { body: buildHistoryCertificatePdf(db, user.cedula, now(db)), name: historyFileName(user.cedula) };
    }),
  );
}
