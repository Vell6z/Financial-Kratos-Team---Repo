import { handle } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { withDB } from "@/lib/db";
import { cancelRecurring } from "@/lib/recurring";
import { BusinessError } from "@/lib/services";

/** Cancela una inversión recurrente del inversionista de la sesión y revoca el permiso en su wallet */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    const wallet = await withDB(async (db) => {
      const user = await requireUser(db);
      requireRole(user, "inversor");
      if (!user.wallet) throw new BusinessError("No tienes una wallet registrada");
      return user.wallet;
    });
    await cancelRecurring(wallet, id);
    return { ok: true };
  });
}
