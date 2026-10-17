// Reglas de negocio del MVP. Todo lo que el equipo todavía está definiendo vive aquí.

export const APP_NAME = "La Bodeguita";
/** Para nombres de archivo (PDF): sin espacios ni tildes */
export const APP_SLUG = "labodeguita";

export type Level = 1 | 2 | 3;
export const LEVEL_IDS: Level[] = [1, 2, 3];

export interface LevelConfig {
  name: string;
  risk: string;
  /** Tasa efectiva anual que paga el acreditado */
  rateEA: number;
  /**
   * Rentabilidad ESPERADA del inversionista (efectiva anual), no garantizada:
   * 85 % prestado × (tasa del acreditado − reserva para impagos − comisión de la plataforma). Ver INVESTOR_ECONOMICS.
   */
  investorRateEA: number;
  maxAmount: number;
  minDays: number;
  maxDays: number;
  /** Parte del capital semilla asignada a este pool (supuesto) */
  seed: number;
}

export const LEVELS: Record<Level, LevelConfig> = {
  1: { name: "Nivel 1", risk: "Riesgo bajo", rateEA: 0.24, investorRateEA: 0.153, maxAmount: 5_000_000, minDays: 30, maxDays: 365, seed: 20_000_000 },
  2: { name: "Nivel 2", risk: "Riesgo medio", rateEA: 0.3, investorRateEA: 0.179, maxAmount: 3_000_000, minDays: 30, maxDays: 150, seed: 17_000_000 },
  3: { name: "Nivel 3", risk: "Riesgo alto", rateEA: 0.36, investorRateEA: 0.196, maxAmount: 1_000_000, minDays: 30, maxDays: 90, seed: 13_000_000 },
};

/**
 * Economía de cada pool (área financiera, 17-oct-2026). La reserva y el reparto de pérdidas aún no se
 * aplican en el código (se explican en el pitch); el encaje sí: el capital se presta solo hasta el 85 % del pool.
 */
export const INVESTOR_ECONOMICS = {
  /** Encaje: parte del pool que no se presta y queda para retiros */
  reserveRequirement: 0.15,
  /** Comisión de la plataforma: puntos de la tasa del acreditado, sobre lo prestado (sale de los intereses) */
  platformFeePoints: 0.03,
  /** Reserva para impagos por nivel: puntos de la tasa del acreditado (pérdida esperada, supuesto a recalibrar) */
  defaultReservePoints: { 1: 0.03, 2: 0.06, 3: 0.1 } as Record<Level, number>,
};

/** "17,9 %": rentabilidad con un decimal si lo tiene */
export const fmtRate = (r: number) => `${(r * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;

/** Aviso obligatorio junto a la rentabilidad: no es garantizada */
export const EXPECTED_RETURN_NOTE = "Rentabilidad esperada, no garantizada: puede ser menor si los impagos superan la reserva del nivel.";

/** Capital semilla total (supuesto: 50 millones COP repartidos entre los pools) */
export const SEED_CAPITAL = LEVEL_IDS.reduce((sum, l) => sum + LEVELS[l].seed, 0);

/** Montos mínimos (supuestos para la demo) */
export const MIN_INVESTMENT = 100_000;
export const MIN_LOAN = 100_000;

/**
 * Retiros de las cajitas:
 * - Cada aporte dura un año, contado desde ese aporte, en cualquier nivel. Es independiente del plazo
 *   máximo de los créditos (LEVELS.maxDays): cambiar uno no cambia el otro.
 * - Antes del plazo solo se puede sacar este porcentaje del aporte (capital + rendimiento).
 * - Máximo por retiro en dólares; se pasa a pesos con la tasa de mercado (src/lib/fx.ts).
 */
export const INVESTMENT_TERM_DAYS: Record<Level, number> = { 1: 365, 2: 365, 3: 365 };
export const investmentTermDays = (level: Level) => INVESTMENT_TERM_DAYS[level];
/** "1 año" o "N días", para mostrar el plazo de un aporte */
export const investmentTermLabel = (level: Level) => (INVESTMENT_TERM_DAYS[level] === 365 ? "1 año" : `${INVESTMENT_TERM_DAYS[level]} días`);
export const EARLY_WITHDRAWAL_SHARE = 0.5;
export const MAX_WITHDRAWAL_USD = 30_000;

/**
 * Llave Bre-B de la plataforma, vinculada a la bóveda: los acreditados le transfieren aquí sus cuotas (simulado en el sandbox).
 * El titular se muestra enmascarado como lo hace el directorio Bre-B.
 */
export const VAULT_BREB = {
  key: "@labodeguita",
  holderName: "LA* BOD*** S.A.S.",
  bank: "Bóveda La Bodeguita (sandbox)",
};
/**
 * Destino del crédito: para el negocio o el trabajo (crédito productivo) o para la persona y su hogar (consumo).
 * El tipo sale del destino y se muestra en el contrato y en el reporte a centrales.
 * Ojo: el tope de usura de consumo es más bajo que el de microcrédito productivo; verificar las tasas antes del pitch.
 */
export const CREDIT_PURPOSES = [
  { id: "capital_trabajo", kind: "productivo", title: "Capital de trabajo", sub: "Mercancía, insumos o materia prima" },
  { id: "herramientas", kind: "productivo", title: "Herramientas o equipo", sub: "Para trabajar o producir más" },
  { id: "local", kind: "productivo", title: "Mejorar el local o puesto", sub: "Adecuaciones, estantes, vitrina" },
  { id: "otro_productivo", kind: "productivo", title: "Otro gasto del negocio", sub: "Transporte, permisos, publicidad" },
  { id: "hogar", kind: "consumo", title: "Gastos del hogar", sub: "Mercado, servicios o arriendo" },
  { id: "salud", kind: "consumo", title: "Salud", sub: "Medicamentos, citas o exámenes" },
  { id: "educacion", kind: "consumo", title: "Educación", sub: "Matrícula, útiles o uniformes" },
  { id: "vivienda", kind: "consumo", title: "Arreglos de la vivienda", sub: "Reparaciones o mejoras de la casa" },
  { id: "emergencia", kind: "consumo", title: "Una emergencia", sub: "Un imprevisto o una calamidad" },
  { id: "deuda", kind: "consumo", title: "Pagar una deuda cara", sub: "Por ejemplo, salir del gota a gota" },
] as const;
export type CreditPurpose = (typeof CREDIT_PURPOSES)[number]["id"];
export type CreditKind = (typeof CREDIT_PURPOSES)[number]["kind"];

/** Tipo de obligación según el destino (contrato, reporte a centrales) */
export const creditTypeLabel = (purpose: string | null | undefined) =>
  CREDIT_PURPOSES.find((p) => p.id === purpose)?.kind === "consumo" ? "Crédito de consumo" : "Microcrédito productivo";

/** Abono mínimo por Bre-B, en pesos */
export const MIN_PAYMENT = 1_000;

/** Mínimo de cuotas por crédito */
export const MIN_INSTALLMENTS = 2;

/** Las cuotas se pagan cada 15 días, contados desde el desembolso (no por quincenas del calendario) */
export const INSTALLMENT_DAYS = 15;

/**
 * Cuotas y mora (área financiera, 17-oct-2026). Sin interés de mora en el MVP.
 * Los días de atraso se cuentan desde la fecha de vencimiento de la cuota.
 */
export const DELINQUENCY = {
  /** Desde el vencimiento hay una solicitud de pago; si no se paga completa en estos días, la cuota pasa a mora */
  daysToPay: 3,
  /** Recordatorios de saldo en mora (días de atraso) */
  reminderDays: [7, 15],
  /** Aviso previo al reporte a centrales de riesgo (20 días antes, Ley 1266 de 2008) */
  reportNoticeDays: 70,
  /** Reporte negativo (simulado) y castigo del crédito */
  reportDays: 90,
};

/**
 * Cambio de nivel para el siguiente crédito según el peor atraso del último crédito
 * (docs/reglas-cambio-de-nivel.md, área financiera, 17-oct-2026). Número más bajo = mejor nivel.
 */
export const LEVEL_CHANGE = {
  /** Hasta estos días de atraso cuenta como a tiempo: sube un nivel */
  graceDays: 3,
  /** Hasta aquí se mantiene */
  keepUpTo: 15,
  /** Hasta aquí baja un nivel; más que esto es nivel 4 mientras deba (al ponerse al día, nivel 3) */
  downUpTo: 30,
  /** Desde aquí: nivel 4 y bloqueado `blockMonths` meses, aunque pague */
  defaultDays: 90,
  blockMonths: 12,
};

/** Puntaje mínimo para cada nivel (0-100) */
export const SCORE_THRESHOLDS: { min: number; level: Level }[] = [
  { min: 70, level: 1 },
  { min: 50, level: 2 },
  { min: 35, level: 3 },
];

export const DAY_MS = 24 * 60 * 60 * 1000;
export const YEAR_DAYS = 365;
