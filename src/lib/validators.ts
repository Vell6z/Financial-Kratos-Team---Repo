// Validaciones de formato compartidas entre el navegador y el servidor.
// Cada función devuelve el mensaje de error o null si el valor es válido.

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

export function validateName(v: string, field = "nombre"): string | null {
  const s = v.trim();
  if (!s) return `Ingresa tu ${field}`;
  if (s.length < 2) return `Tu ${field} es muy corto`;
  if (s.length > 40) return `Tu ${field} es muy largo`;
  if (!/^[\p{L}][\p{L}' .-]*$/u.test(s)) return `Tu ${field} solo puede tener letras`;
  return null;
}

export function validateEmail(v: string): string | null {
  const s = v.trim();
  if (!s) return "Ingresa tu correo";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(s)) return "Revisa el correo: debe verse como nombre@dominio.com";
  return null;
}

/** Cédula colombiana: 6 a 10 dígitos. Extranjeros: 5 a 15 letras o números (pasaporte, DNI, etc.). */
export function validateDocument(v: string, nationality: string): string | null {
  const s = v.trim();
  if (!s) return "Ingresa tu número de documento";
  if (nationality === "Colombiana") {
    if (!/^\d+$/.test(s)) return "La cédula solo lleva números, sin puntos ni espacios";
    if (s.length < 6 || s.length > 10) return "La cédula debe tener entre 6 y 10 dígitos";
    return null;
  }
  if (!/^[A-Za-z0-9-]{5,15}$/.test(s)) return "El documento debe tener entre 5 y 15 letras o números";
  return null;
}

/** Celular colombiano: 10 dígitos que empiezan por 3. Internacional: 7 a 15 dígitos. */
export function validatePhone(v: string, nationality: string): string | null {
  const digits = onlyDigits(v);
  if (!digits) return "Ingresa tu número de celular";
  if (nationality === "Colombiana") {
    const local = digits.startsWith("57") && digits.length === 12 ? digits.slice(2) : digits;
    if (!/^3\d{9}$/.test(local)) return "El celular debe tener 10 dígitos y empezar por 3";
    return null;
  }
  if (digits.length < 7 || digits.length > 15) return "Ingresa un número válido con indicativo del país";
  return null;
}

export function validateAge(v: string): string | null {
  if (!v.trim()) return "Ingresa tu edad";
  const n = Number(v);
  if (!Number.isInteger(n)) return "La edad debe ser un número entero";
  if (n < 18) return "Debes ser mayor de edad para registrarte";
  if (n > 100) return "Revisa tu edad";
  return null;
}

export function validateAddress(v: string): string | null {
  const s = v.trim();
  if (!s) return "Ingresa tu dirección";
  if (s.length < 8) return "Escribe la dirección completa: calle, número y ciudad";
  return null;
}

/** Wallet address de Interledger: "$proveedor/usuario" o "https://proveedor/usuario". */
export function validateWallet(v: string): string | null {
  const s = v.trim();
  if (!s) return "Ingresa tu wallet address de Interledger";
  const url = s.startsWith("$") ? `https://${s.slice(1)}` : s;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    if (!u.hostname.includes(".") || u.pathname.length < 2) throw new Error();
  } catch {
    return "Debe verse como $ilp.interledger-test.dev/tu-nombre";
  }
  return null;
}

/**
 * Llave Bre-B: celular (10 dígitos, empieza por 3), cédula (6 a 10 dígitos),
 * correo, o alfanumérica que empieza por @ (3 a 20 caracteres).
 */
export function validateBrebKey(v: string): string | null {
  const s = v.trim();
  if (!s) return "Ingresa tu llave Bre-B";
  if (/^\d+$/.test(s)) {
    if (/^3\d{9}$/.test(s) || (s.length >= 6 && s.length <= 10)) return null;
    return "Una llave numérica es tu celular (10 dígitos) o tu cédula (6 a 10 dígitos)";
  }
  if (s.includes("@") && !s.startsWith("@")) return validateEmail(s) ? "Revisa el correo de tu llave" : null;
  if (/^@[A-Za-z0-9._-]{3,20}$/.test(s)) return null;
  if (/^[A-Za-z]\d{8}$/.test(s)) return null; // código de comercio
  return "Usa tu celular, cédula, correo o una llave alfanumérica que empiece por @";
}

export function validateMoney(v: string | number, opts: { label?: string; min?: number; max?: number } = {}): string | null {
  const n = typeof v === "number" ? v : Number(v);
  const label = opts.label ?? "el monto";
  if (!v && v !== 0) return `Ingresa ${label}`;
  if (!Number.isFinite(n) || n <= 0) return `Ingresa ${label} mayor a cero`;
  if (!Number.isInteger(n)) return "Usa solo números enteros, sin decimales";
  if (opts.min !== undefined && n < opts.min) return `El mínimo es ${formatThousands(opts.min)}`;
  if (opts.max !== undefined && n > opts.max) return `El máximo es ${formatThousands(opts.max)}`;
  return null;
}

/** Fuerza de la contraseña: 0 a 4 */
export function passwordStrength(p: string) {
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  return score;
}

export function validatePassword(p: string): string | null {
  if (!p) return "Crea una contraseña";
  if (p.length < 8) return "Usa al menos 8 caracteres";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Combina letras y números";
  return null;
}

export const formatThousands = (n: number) => `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n)}`;

/** Muestra una wallet address en formato corto: https://ilp.x/nombre → $ilp.x/nombre */
export const walletLabel = (url: string) => url.replace(/^https?:\/\//, "$");
