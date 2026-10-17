import { handle } from "@/lib/api";
import { requireRole, requireUser, requireVerifiedIdentity } from "@/lib/auth";
import { withDB } from "@/lib/db";
import { processPayouts } from "@/lib/payouts";
import { BusinessError, effectiveLevel, loanView, requestLoan } from "@/lib/services";

/** Créditos y estado del solicitante de la sesión */
export async function GET() {
  return handle(async () => {
    // Reintenta los desembolsos pendientes (por ejemplo, si el directorio Bre-B no respondió antes)
    await processPayouts();
    return withDB(async (db) => {
      const user = await requireUser(db);
      requireRole(user, "acreditado");
      const a = user.cedula ? db.applicants.find((x) => x.cedula === user.cedula) : undefined;
      return {
        applicant: a ? { ...a, level: effectiveLevel(a.scoreLevel, a.paidOnTime) } : null,
        loans: db.loans.filter((l) => l.cedula === user.cedula).map((l) => loanView(db, l)).reverse(),
      };
    });
  });
}

export async function POST(request: Request) {
  const { amount, installments, verificationId, confirmBeneficiary } = await request.json();
  return handle(async () => {
    const id = await withDB(async (db) => {
      const user = await requireUser(db);
      requireRole(user, "acreditado");
      if (!user.cedula) throw new BusinessError("Registra tu cédula para pedir un crédito");
      requireVerifiedIdentity(user, "pedir un crédito");
      // La llave sale de la verificación Bre-B guardada en el servidor (POST /api/breb/verify)
      return requestLoan(db, user, Number(amount), Number(installments), String(verificationId ?? ""), confirmBeneficiary === true).id;
    });
    // Si el pool tenía capital: re-verifica la llave en el directorio y hace el payout (simulado)
    await processPayouts();
    return withDB((db) => loanView(db, db.loans.find((l) => l.id === id)!));
  });
}
