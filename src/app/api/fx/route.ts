import { handle } from "@/lib/api";
import { isInterledgerEnabled, vaultFx } from "@/lib/openpayments";

/** Moneda de la bóveda y cuántos pesos vale una unidad (tasa de mercado), para la vista previa de /invertir */
export async function GET() {
  return handle(async () => (isInterledgerEnabled() ? await vaultFx() : null));
}
