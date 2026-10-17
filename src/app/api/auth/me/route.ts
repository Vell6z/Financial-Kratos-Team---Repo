import { handle } from "@/lib/api";
import { requireUser, toPublic } from "@/lib/auth";
import { withDB } from "@/lib/db";
import { normalizeWallet } from "@/lib/openpayments";
import { BusinessError } from "@/lib/services";
import { validateWallet } from "@/lib/validators";

export async function GET() {
  return handle(() => withDB(async (db) => toPublic(await requireUser(db))));
}

/** Actualiza la wallet address de Interledger del inversionista. */
export async function PATCH(request: Request) {
  const body = await request.json();
  return handle(() =>
    withDB(async (db) => {
      const user = await requireUser(db);
      if (body.wallet !== undefined && user.role === "inversor") {
        const error = validateWallet(String(body.wallet));
        if (error) throw new BusinessError(error);
        user.wallet = normalizeWallet(String(body.wallet));
      }
      return toPublic(user);
    }),
  );
}
