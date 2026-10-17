import { handle } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { withDB } from "@/lib/db";
import { processPayouts } from "@/lib/payouts";
import { BusinessError, loanView, receiveBrebPayment } from "@/lib/services";

/**
 * Simulador Bre-B: el acreditado transfiere desde su banco a la llave de la plataforma, vinculada a la bóveda.
 * Puede abonar parcialmente; el dinero se aplica a la cuota más antigua y entra al pool.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return handle(async () => {
    const result = await withDB(async (db) => {
      const user = await requireUser(db);
      requireRole(user, "acreditado");
      const loan = db.loans.find((l) => l.id === id && l.cedula === user.cedula);
      if (!loan) throw new BusinessError("Crédito no encontrado");
      const { receipt } = receiveBrebPayment(db, id, {
        toKey: String(body.toKey ?? ""),
        // Sale de la llave verificada del propio acreditado
        fromKey: loan.llaveBreb,
        amount: Number(body.amount),
      });
      return { loan: loanView(db, loan), receipt };
    });
    // El pago entró al pool: puede liberar créditos que esperaban fondeo
    void processPayouts();
    return result;
  });
}
