import "server-only";
import { MAX_WITHDRAWAL_USD } from "./config";

// Tasa de mercado COP ↔ moneda de la bóveda (EUR, USD…).
// La red de prueba de Interledger no tiene pesos colombianos, así que el paso pesos → moneda de la bóveda
// se hace con la tasa de mercado; el cambio entre la moneda del inversionista y la de la bóveda lo hace Interledger.
// Fuente: open.er-api.com (gratis, sin llave, se actualiza una vez al día). Se guarda en memoria una hora.

export interface CopRate {
  /** Pesos por 1 unidad de la moneda */
  copPerUnit: number;
  source: "mercado" | "manual" | "respaldo";
  updatedAt: string | null;
}

const FALLBACK = 4000;
const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; rate: CopRate }>();

export async function copRate(assetCode: string, opts: { ignoreManual?: boolean } = {}): Promise<CopRate> {
  if (assetCode === "COP") return { copPerUnit: 1, source: "mercado", updatedAt: null };
  // Tasa fija de la moneda de la bóveda definida por el equipo (útil si no hay internet en la demo)
  const manual = Number(process.env.OP_COP_PER_UNIT);
  if (manual > 0 && !opts.ignoreManual) return { copPerUnit: manual, source: "manual", updatedAt: null };

  const hit = cache.get(assetCode);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rate;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(assetCode)}`, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    const data = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    const cop = data.rates?.COP;
    if (data.result !== "success" || !(cop && cop > 0)) throw new Error("Sin tasa COP");
    const rate: CopRate = { copPerUnit: cop, source: "mercado", updatedAt: data.time_last_update_utc ?? null };
    cache.set(assetCode, { at: Date.now(), rate });
    return rate;
  } catch {
    // Sin conexión con la fuente: usa la última tasa conocida o una de respaldo
    return hit?.rate ?? { copPerUnit: FALLBACK, source: "respaldo", updatedAt: null };
  }
}

/** Máximo por retiro: US$30.000 pasados a pesos con la tasa de mercado del dólar */
export async function maxWithdrawalCop() {
  const usd = await copRate("USD", { ignoreManual: true });
  return { usd: MAX_WITHDRAWAL_USD, cop: Math.floor(MAX_WITHDRAWAL_USD * usd.copPerUnit), copPerUsd: usd.copPerUnit };
}
