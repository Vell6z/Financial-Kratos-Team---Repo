import type { BrebKeyType } from "./breb-keys";

// Lector de QR Bre-B (formato EMVCo TLV). Compartido entre el navegador y el servidor.
//
// Cada campo es [tag: 2 dígitos][longitud: 2 dígitos][valor]. La llave Bre-B vive en la plantilla con
// namespace CO.COM.RBM.LLA (en los QR reales, el tag 26):
//   26.00 = CO.COM.RBM.LLA · 26.01 documento · 26.02 celular · 26.03 correo · 26.04 alias
// Las demás plantillas CO.COM.RBM.* (RED, CU, CA, CANAL, IVA, TRXID, SEC…) son datos de la red y del cobro: no traen la llave.
// El último campo siempre es el CRC: tag 63, longitud 04, 4 caracteres hexadecimales (CRC-16/CCITT-FALSE).
//
// Falla cerrado: si algo no cuadra (estructura, CRC, namespace, llave), el QR se rechaza.
// Un QR válido NO prueba que la llave exista o esté activa: después hay que consultar el directorio Bre-B.

export type BrebQrErrorCode =
  | "EMPTY"
  | "INVALID_TLV"
  | "MISSING_CRC"
  | "INVALID_CRC"
  | "MISSING_BREB_TEMPLATE"
  | "UNSUPPORTED_NAMESPACE"
  | "MISSING_BREB_KEY"
  | "MULTIPLE_BREB_KEYS";

export class BrebQrError extends Error {
  constructor(
    public code: BrebQrErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface TlvField {
  tag: string;
  length: number;
  value: string;
  /** Posición (en caracteres) donde empieza el valor */
  valueStart: number;
}

/** Recorre una cadena TLV. Las longitudes cuentan caracteres (no bytes), como define EMVCo. */
export function parseTlv(payload: string): TlvField[] {
  const chars = Array.from(payload); // por puntos de código, para no partir tildes o emojis
  const fields: TlvField[] = [];
  let i = 0;
  while (i < chars.length) {
    if (i + 4 > chars.length) throw new BrebQrError("INVALID_TLV", "El QR está incompleto o dañado.");
    const tag = chars.slice(i, i + 2).join("");
    const len = chars.slice(i + 2, i + 4).join("");
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(len)) throw new BrebQrError("INVALID_TLV", "El QR no tiene el formato EMVCo de un pago.");
    const length = Number(len);
    const valueStart = i + 4;
    if (valueStart + length > chars.length) throw new BrebQrError("INVALID_TLV", "El QR está incompleto o dañado.");
    fields.push({ tag, length, value: chars.slice(valueStart, valueStart + length).join(""), valueStart });
    i = valueStart + length;
  }
  return fields;
}

/** CRC-16/CCITT-FALSE (polinomio 0x1021, inicio 0xFFFF) sobre los bytes UTF-8 */
export function crc16(value: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const KEY_SUBTAGS: Record<string, BrebKeyType> = {
  "01": "IDENTIFICATION",
  "02": "PHONE",
  "03": "MAIL",
  "04": "ALPHANUMERIC",
};

/** Prefijo de todas las plantillas Bre-B (Redeban) */
export const BREB_NAMESPACE = "CO.COM.RBM";
/** Plantilla que trae la llave. Se acepta también "CO.COM.RBM" a secas, como lo documentan algunas fuentes */
const KEY_NAMESPACES = [`${BREB_NAMESPACE}.LLA`, BREB_NAMESPACE];

export interface BrebQr {
  key: string;
  keyType: BrebKeyType;
  namespace: string;
  /** Solo informativo: el titular que vale es el que devuelve el directorio Bre-B, nunca el del QR */
  merchantName: string | null;
  city: string | null;
  country: string | null;
  /** Monto del QR (si trae). Para un crédito NO se usa: se desembolsa lo aprobado por Kratos */
  amount: number | null;
  /** Todos los campos leídos, para mostrar cómo se interpretó */
  fields: { tag: string; value: string }[];
  /** Plantilla donde se encontró Bre-B (normalmente 26) y sus subcampos */
  brebTag: string;
  breb: { tag: string; value: string }[];
}

/** Lee y valida un QR Bre-B. Lanza BrebQrError con un mensaje para el usuario si no es válido. */
export function parseBrebQr(payload: string): BrebQr {
  const raw = (payload ?? "").trim();
  if (!raw) throw new BrebQrError("EMPTY", "El QR está vacío.");

  const fields = parseTlv(raw);

  // CRC: tiene que ser el ÚLTIMO campo (63, longitud 04) y coincidir con lo calculado sobre todo lo anterior + "6304"
  const crcField = fields.at(-1);
  if (!crcField || crcField.tag !== "63" || crcField.length !== 4 || !/^[0-9A-Fa-f]{4}$/.test(crcField.value))
    throw new BrebQrError("MISSING_CRC", "El QR no trae el código de verificación (CRC): no es un QR de pago válido.");
  const crcInput = Array.from(raw).slice(0, crcField.valueStart).join("");
  if (crc16(crcInput) !== crcField.value.toUpperCase())
    throw new BrebQrError("INVALID_CRC", "El código de verificación del QR no coincide: puede estar dañado, alterado o mal leído. Intenta de nuevo.");

  // Las cuentas del comercio van en las plantillas 26 a 51; la llave Bre-B está en la de namespace CO.COM.RBM.LLA
  const templates = fields
    .filter((f) => Number(f.tag) >= 26 && Number(f.tag) <= 51)
    .map((f) => {
      try {
        const sub = parseTlv(f.value);
        return { tag: f.tag, sub, ns: sub.find((x) => x.tag === "00")?.value ?? "" };
      } catch {
        return null; // plantilla de otro esquema con formato propio: se ignora
      }
    })
    .filter((t): t is { tag: string; sub: TlvField[]; ns: string } => t !== null);
  const keyTemplates = templates.filter((t) => KEY_NAMESPACES.includes(t.ns));
  if (keyTemplates.length === 0)
    throw templates.some((t) => t.ns.startsWith(BREB_NAMESPACE))
      ? new BrebQrError("MISSING_BREB_KEY", "El QR es de Bre-B pero no trae una llave.")
      : templates.length
        ? new BrebQrError("UNSUPPORTED_NAMESPACE", "Este QR es de otro sistema de pagos, no de Bre-B.")
        : new BrebQrError("MISSING_BREB_TEMPLATE", "Este QR no es de Bre-B.");
  if (keyTemplates.length > 1) throw new BrebQrError("MULTIPLE_BREB_KEYS", "El QR trae más de una llave Bre-B: no sabemos a cuál enviar.");
  const brebTemplates = keyTemplates;
  const breb = keyTemplates[0].sub;
  const namespace = keyTemplates[0].ns;

  const keys = breb.filter((f) => KEY_SUBTAGS[f.tag] && f.value.trim());
  if (keys.length === 0) throw new BrebQrError("MISSING_BREB_KEY", "El QR de Bre-B no trae una llave.");
  if (keys.length > 1) throw new BrebQrError("MULTIPLE_BREB_KEYS", "El QR trae más de una llave Bre-B: no sabemos a cuál enviar.");

  const keyType = KEY_SUBTAGS[keys[0].tag];
  let key = keys[0].value.trim();
  // Celular con indicativo: +57 / 57 + 10 dígitos → 10 dígitos
  if (keyType === "PHONE") key = key.replace(/^\+?57(?=3\d{9}$)/, "");

  const get = (tag: string) => fields.find((f) => f.tag === tag)?.value ?? null;
  const amount = get("54");
  return {
    key,
    keyType,
    namespace,
    merchantName: get("59"),
    city: get("60"),
    country: get("58"),
    amount: amount && Number.isFinite(Number(amount)) ? Number(amount) : null,
    fields: fields.map((f) => ({ tag: f.tag, value: f.value })),
    brebTag: brebTemplates[0].tag,
    breb: breb.map((f) => ({ tag: f.tag, value: f.value })),
  };
}

/** Arma un QR Bre-B (para pruebas): útil para comprobar el lector sin un QR físico */
export function buildBrebQr(key: string, keyType: BrebKeyType, opts: { name?: string; city?: string } = {}) {
  const tlv = (tag: string, value: string) => `${tag}${String(Array.from(value).length).padStart(2, "0")}${value}`;
  const subtag = Object.entries(KEY_SUBTAGS).find(([, t]) => t === keyType)?.[0];
  if (!subtag) throw new Error(`Tipo de llave sin subtag Bre-B: ${keyType}`);
  const body =
    tlv("00", "01") +
    tlv("01", "11") +
    tlv("26", tlv("00", `${BREB_NAMESPACE}.LLA`) + tlv(subtag, key)) +
    tlv("52", "0000") +
    tlv("53", "170") +
    tlv("58", "CO") +
    tlv("59", opts.name ?? "PRUEBA") +
    tlv("60", opts.city ?? "BOGOTA") +
    "6304";
  return body + crc16(body);
}
