// Formulario de registro por pasos. Opciones y validaciones compartidas entre el navegador y el servidor.

import {
  validateAddress,
  validateAge,
  validateBrebKey,
  validateDocument,
  validateEmail,
  validateMoney,
  validateName,
  validatePassword,
  validatePhone,
  validateWallet,
} from "./validators";

export type Role = "inversor" | "acreditado";
/** Roles de cuenta: los del registro más el operador de la plataforma (no se registra, solo existe la cuenta demo). */
export type AccountRole = Role | "admin";

export const SEX_OPTIONS = ["Femenino", "Masculino", "Otro", "Prefiero no decir"];
export const NATIONALITIES = [
  "Colombiana",
  "Venezolana",
  "Ecuatoriana",
  "Peruana",
  "Mexicana",
  "Argentina",
  "Chilena",
  "Brasileña",
  "Estadounidense",
  "Canadiense",
  "Española",
  "Sudafricana",
  "Otra",
];
export const CURRENCIES = ["COP", "USD", "EUR", "MXN", "ZAR", "GBP"];
export const INVESTOR_INCOME_SOURCES = ["Salario", "Negocio propio", "Inversiones", "Pensión", "Rentas / arriendos", "Otro"];
export const BORROWER_INCOME_SOURCES = [
  "Empleo formal",
  "Empleo informal",
  "Negocio propio / emprendimiento",
  "Ventas o comercio",
  "Remesas",
  "Subsidios",
  "Otro",
];

export interface RegistrationData {
  firstName: string;
  lastName: string;
  email: string;
  cedula: string;
  phone: string;
  nationality: string;
  age: string;
  sex: string;
  address: string;
  role: Role | "";
  // Inversionista
  wallet: string;
  investorIncome: string;
  investorCurrency: string;
  investorIncomeSource: string;
  employment: "independiente" | "asalariado" | "";
  // Acreditado
  borrowerIncomeSource: string;
  borrowerIncome: string;
  acceptsBreb: "si" | "no" | "";
  llaveBreb: string;
  // Seguridad
  password: string;
  password2: string;
  /** Autorización de tratamiento de datos personales (Ley 1581 de 2012) */
  acceptsTerms: "si" | "";
}

export const EMPTY_REGISTRATION: RegistrationData = {
  firstName: "",
  lastName: "",
  email: "",
  cedula: "",
  phone: "",
  nationality: "",
  age: "",
  sex: "",
  address: "",
  role: "",
  wallet: "",
  investorIncome: "",
  investorCurrency: "USD",
  investorIncomeSource: "",
  employment: "",
  borrowerIncomeSource: "",
  borrowerIncome: "",
  acceptsBreb: "",
  llaveBreb: "",
  password: "",
  password2: "",
  acceptsTerms: "",
};

export const STEPS = ["Datos personales", "Perfil", "Documentos", "Seguridad"] as const;

export const NO_BREB_MESSAGE =
  "Para recibir el crédito y pagar tus cuotas necesitas una llave Bre-B. Créala gratis en la app de tu banco o billetera (con tu celular, cédula o correo) y vuelve para continuar.";

export type FieldErrors = Partial<Record<keyof RegistrationData, string>>;

/** Errores por campo de un paso del formulario (vacío si todo está bien). */
export function fieldErrors(step: number, d: RegistrationData): FieldErrors {
  const e: FieldErrors = {};
  const put = (k: keyof RegistrationData, msg: string | null) => {
    if (msg) e[k] = msg;
  };
  if (step === 0) {
    put("firstName", validateName(d.firstName, "nombre"));
    put("lastName", validateName(d.lastName, "apellido"));
    put("email", validateEmail(d.email));
    put("nationality", d.nationality ? null : "Selecciona tu nacionalidad");
    put("cedula", validateDocument(d.cedula, d.nationality));
    put("phone", validatePhone(d.phone, d.nationality));
    put("age", validateAge(d.age));
    put("sex", d.sex ? null : "Selecciona una opción");
    put("address", validateAddress(d.address));
    put("role", d.role ? null : "Elige cómo vas a usar la plataforma");
  }
  if (step === 1 && d.role === "inversor") {
    put("wallet", validateWallet(d.wallet));
    put("investorIncome", validateMoney(d.investorIncome, { label: "tu ingreso mensual" }));
    put("investorCurrency", d.investorCurrency ? null : "Elige la moneda");
    put("investorIncomeSource", d.investorIncomeSource ? null : "Indica de dónde vienen tus ingresos");
    put("employment", d.employment ? null : "Indica si eres independiente o asalariado");
  }
  if (step === 1 && d.role === "acreditado") {
    put("borrowerIncomeSource", d.borrowerIncomeSource ? null : "Indica tu fuente de ingresos");
    put("borrowerIncome", validateMoney(d.borrowerIncome, { label: "tu ingreso mensual", min: 50_000, max: 100_000_000 }));
    if (d.acceptsBreb === "no") put("acceptsBreb", NO_BREB_MESSAGE);
    else if (d.acceptsBreb !== "si") put("acceptsBreb", "Indica si puedes recibir y hacer pagos por Bre-B");
    else put("llaveBreb", validateBrebKey(d.llaveBreb));
  }
  if (step === 3) {
    put("password", validatePassword(d.password));
    put("password2", !d.password2 ? "Repite tu contraseña" : d.password !== d.password2 ? "Las contraseñas no coinciden" : null);
    put("acceptsTerms", d.acceptsTerms === "si" ? null : "Debes autorizar el tratamiento de tus datos para continuar");
  }
  return e;
}

/** Primer error de un paso, o null. */
export function validateStep(step: number, d: RegistrationData): string | null {
  return Object.values(fieldErrors(step, d))[0] ?? null;
}

/** Documentos de identidad */
export const ID_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const ID_FILE_MAX_BYTES = 5 * 1024 * 1024;

export function validateIdFile(file: { type: string; size: number } | null | undefined, side: string): string | null {
  if (!file || file.size === 0) return `Adjunta la copia de tu documento (${side})`;
  if (!ID_FILE_TYPES.includes(file.type)) return `El documento (${side}) debe ser JPG, PNG, WEBP o PDF`;
  if (file.size > ID_FILE_MAX_BYTES) return `El documento (${side}) pesa más de 5 MB`;
  return null;
}
