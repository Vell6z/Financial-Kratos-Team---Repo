import "server-only";
import { SANDBOX_KEYS, type BrebKeyType } from "./breb-keys";

// Verificador de llaves Bre-B: confirma en el directorio Bre-B (vía Wompi) que la llave existe,
// está activa y a nombre de quién está, ANTES de desembolsar.
// Esta operación es solo lectura (GET /breb/keys/resolve): aquí no existe ninguna llamada que mueva dinero.
//
// WOMPI_RESOLVE_ENV (o WOMPI_ENV) = sandbox (por defecto) usa WOMPI_SANDBOX_* (o WOMPI_PAYOUT_*); = production usa WOMPI_PROD_*.
// Las credenciales de producción solo se usan aquí, para resolver llaves reales. Los payouts nunca las usan.
// Sin credenciales, se simula con las mismas llaves de prueba del sandbox.

export type BrebMode = "sandbox" | "production" | "simulado";

export interface BrebHolder {
  holderName: string;
  financialEntity: { name: string; code: string };
  keyType: BrebKeyType;
  keyValue: string;
}

export type BrebResolution =
  | ({ ok: true; mode: BrebMode } & BrebHolder)
  | { ok: false; mode: BrebMode; reason: "not_found" | "invalid" | "inactive" | "unavailable" | "uncertain" | "config"; message: string };

function config() {
  const production = (process.env.WOMPI_RESOLVE_ENV || process.env.WOMPI_ENV) === "production";
  const env = process.env;
  const c = production
    ? { url: env.WOMPI_PROD_API_URL || "https://api.payouts.wompi.co/v2", key: env.WOMPI_PROD_API_KEY, principal: env.WOMPI_PROD_USER_PRINCIPAL_ID }
    : {
        url: env.WOMPI_SANDBOX_API_URL || env.WOMPI_PAYOUT_API_URL || "https://api.sandbox.payouts.wompi.co/v2",
        key: env.WOMPI_SANDBOX_API_KEY || env.WOMPI_PAYOUT_API_KEY,
        principal: env.WOMPI_SANDBOX_USER_PRINCIPAL_ID || env.WOMPI_PAYOUT_USER_PRINCIPAL_ID,
      };
  const mode: BrebMode = !c.key || !c.principal ? "simulado" : production ? "production" : "sandbox";
  return { ...c, url: c.url.replace(/\/$/, ""), mode };
}

export const brebMode = () => config().mode;

const fail = (mode: BrebMode, reason: Extract<BrebResolution, { ok: false }>["reason"], message: string): BrebResolution => ({ ok: false, mode, reason, message });

/** Respuestas del sandbox para las llaves de prueba (modo simulado) */
function simulate(key: string, keyType: BrebKeyType): BrebResolution {
  if (SANDBOX_KEYS[keyType].toLowerCase() !== key.toLowerCase())
    return fail("simulado", "not_found", "Esa llave no existe en el directorio Bre-B.");
  return {
    ok: true,
    mode: "simulado",
    holderName: "Eli*** Can*** Mor***",
    financialEntity: { name: "BANCO DAVIVIENDA", code: "051" },
    keyType,
    keyValue: key.toUpperCase(),
  };
}

/** Consulta el directorio Bre-B. Nunca lanza: los errores vuelven como `ok: false` con un mensaje para el usuario. */
export async function resolveBrebKey(key: string, keyType: BrebKeyType): Promise<BrebResolution> {
  const c = config();
  if (c.mode === "simulado") return simulate(key, keyType);

  let res: Response;
  try {
    res = await fetch(`${c.url}/breb/keys/resolve/${encodeURIComponent(key)}?keyType=${encodeURIComponent(keyType)}`, {
      method: "GET", // Solo lectura
      headers: { "x-api-key": c.key!, "user-principal-id": c.principal!, "business-application-id": "WOMPI_PAYOUTS" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (err) {
    const timeout = (err as Error).name === "TimeoutError";
    return timeout
      ? fail(c.mode, "uncertain", "El directorio Bre-B no respondió a tiempo. No desembolsamos con un resultado incierto: intenta de nuevo.")
      : fail(c.mode, "unavailable", "No pudimos conectarnos con el directorio Bre-B. Intenta de nuevo en unos minutos.");
  }
  const text = await res.text().catch(() => "");
  let body: { code?: string; message?: string; data?: Partial<BrebHolder> } | null = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // El sandbox responde algunos errores en texto plano
  }
  const code = body?.code;

  if (res.ok && body?.data?.holderName)
    return {
      ok: true,
      mode: c.mode,
      holderName: body.data.holderName,
      financialEntity: { name: body.data.financialEntity?.name ?? "", code: body.data.financialEntity?.code ?? "" },
      keyType: (body.data.keyType as BrebKeyType) ?? keyType,
      keyValue: body.data.keyValue ?? key,
    };
  // 404 / EXC_034 según la documentación; el sandbox responde 400 "… does not exist!" en texto plano
  if (res.status === 404 || code === "EXC_034" || /does not exist/i.test(text)) return fail(c.mode, "not_found", "Esa llave no existe en el directorio Bre-B. Revisa la llave y el tipo.");
  if (code === "EXC_035") return fail(c.mode, "inactive", "Esa llave está inactiva. Usa otra llave o actívala en tu banco.");
  if (code === "EXC_033" || res.status === 400) return fail(c.mode, "invalid", "El formato de la llave no corresponde al tipo elegido.");
  if (code === "EXC_037") return fail(c.mode, "uncertain", "El directorio Bre-B no respondió a tiempo. No desembolsamos con un resultado incierto: intenta de nuevo.");
  if (code === "EXC_036" || res.status === 503) return fail(c.mode, "unavailable", "El directorio Bre-B no está disponible. Intenta de nuevo en unos minutos.");
  // 401 / 403 / otros: problema de configuración nuestro, no del usuario
  console.error(`Bre-B resolve ${res.status} ${code ?? ""}`);
  return fail(c.mode, "config", "No pudimos verificar tu llave por un problema nuestro. Ya lo estamos revisando.");
}

/**
 * ¿El titular enmascarado ("Eli*** Can*** Mor***") puede ser esta persona?
 * Compara las letras visibles de cada palabra con alguna palabra del nombre registrado.
 */
export function holderMatches(masked: string, fullName: string) {
  const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const names = plain(fullName).split(/\s+/).filter(Boolean);
  const parts = plain(masked)
    .split(/\s+/)
    .map((w) => w.replace(/\*+$/, ""))
    .filter(Boolean);
  if (!parts.length) return false;
  const hits = parts.filter((p) => names.some((n) => n.startsWith(p))).length;
  return hits >= Math.min(2, parts.length);
}
