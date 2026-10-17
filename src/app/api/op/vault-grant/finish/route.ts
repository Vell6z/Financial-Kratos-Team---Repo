import type { NextRequest } from "next/server";
import { withDB } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { finishVaultGrant, revokeVaultGrant, verifyInteractHash } from "@/lib/openpayments";

/** Vuelta desde la wallet de la bóveda: el operador aprobó (o rechazó) el permiso de retiros automáticos */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const back = (status: string, message?: string) => {
    const url = new URL("/boveda", publicOrigin(request));
    url.searchParams.set("permiso", status);
    if (message) url.searchParams.set("msg", message);
    return Response.redirect(url, 303);
  };

  const pending = await withDB((db) => {
    const p = db.pendingVaultGrant;
    db.pendingVaultGrant = null;
    return p;
  });
  if (!pending) return back("error", "La autorización ya fue procesada o expiró");

  const interactRef = q.get("interact_ref");
  if (q.get("result") === "grant_rejected" || !interactRef) return back("rechazado");
  if (!verifyInteractHash(pending, interactRef, q.get("hash"))) return back("error", "No pudimos verificar la aprobación");

  try {
    const grant = await finishVaultGrant(pending, interactRef);
    const previous = await withDB((db) => {
      const old = db.vaultGrant;
      db.vaultGrant = grant;
      return old;
    });
    // Al renovar, el permiso anterior se revoca
    if (previous) await revokeVaultGrant(previous);
    return back("ok");
  } catch (err) {
    console.error(err);
    return back("error", err instanceof Error ? err.message : "Error guardando el permiso");
  }
}
