// Tipos de llave Bre-B y su validación de formato. Compartido entre el navegador y el servidor.
// El formato correcto NO prueba que la llave exista: eso lo confirma el directorio Bre-B (src/lib/breb.ts).

export const BREB_KEY_TYPES = {
  IDENTIFICATION: "Cédula",
  PHONE: "Celular",
  MAIL: "Correo",
  ALPHANUMERIC: "Alias (@)",
  ESTABLISHMENT_CODE: "Código de comercio",
} as const;
export type BrebKeyType = keyof typeof BREB_KEY_TYPES;
export const BREB_KEY_TYPE_IDS = Object.keys(BREB_KEY_TYPES) as BrebKeyType[];

/** Llaves que reconoce el sandbox de Wompi (las demás aparecen como inexistentes) */
export const SANDBOX_KEYS: Record<BrebKeyType, string> = {
  ALPHANUMERIC: "@elias123",
  IDENTIFICATION: "1020304050",
  PHONE: "3001234567",
  MAIL: "ecolon@wompi.com",
  ESTABLISHMENT_CODE: "B00012345",
};

/** La llave se conserva como texto (una cédula puede tener ceros a la izquierda) */
export const normalizeBrebKey = (input: string) => String(input).trim();

/** Sugerencia de tipo. Es ambigua (celular y cédula pueden tener 10 dígitos): el usuario la puede cambiar. */
export function detectBrebKeyType(key: string): BrebKeyType {
  if (key.startsWith("@")) return "ALPHANUMERIC";
  if (key.includes("@")) return "MAIL";
  if (/^3\d{9}$/.test(key)) return "PHONE";
  if (/^[A-Za-z]?\d{8}$/.test(key)) return "ESTABLISHMENT_CODE";
  return "IDENTIFICATION";
}

/** Error de formato para el tipo elegido, o null */
export function brebKeyFormatError(key: string, type: BrebKeyType): string | null {
  if (!key) return "Ingresa tu llave Bre-B";
  switch (type) {
    case "IDENTIFICATION":
      return /^\d{5,15}$/.test(key) ? null : "La cédula solo lleva números, sin puntos ni espacios";
    case "PHONE":
      return /^3\d{9}$/.test(key) ? null : "El celular debe tener 10 dígitos y empezar por 3";
    case "MAIL":
      return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(key) ? null : "Revisa el correo: debe verse como nombre@dominio.com";
    case "ALPHANUMERIC":
      return /^@[A-Za-z0-9._-]{3,20}$/.test(key) ? null : "El alias empieza por @ y tiene de 3 a 20 letras o números";
    case "ESTABLISHMENT_CODE":
      return /^[A-Za-z]?\d{8}$/.test(key) ? null : "El código de comercio tiene 8 dígitos (puede empezar por una letra)";
  }
}

/** "BANCOLOMBIA S.A." → "Bancolombia S.A." (el directorio devuelve el nombre en mayúsculas) */
export const bankName = (name: string) =>
  name
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase())
    .replace(/\bS\.a\.(s\.)?/gi, (m) => m.toUpperCase());
