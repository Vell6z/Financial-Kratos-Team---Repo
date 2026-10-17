// Reglas de negocio del MVP. Todo lo que el equipo todavía está definiendo vive aquí.

export const APP_NAME = "Kratos"; // Nombre provisional

export type Level = 1 | 2 | 3;
export const LEVEL_IDS: Level[] = [1, 2, 3];

export interface LevelConfig {
  name: string;
  risk: string;
  /** Tasa efectiva anual que paga el deudor y que renta la cajita del inversionista */
  rateEA: number;
  maxAmount: number;
  minDays: number;
  maxDays: number;
  /** Parte del capital semilla asignada a este pool (supuesto) */
  seed: number;
}

export const LEVELS: Record<Level, LevelConfig> = {
  1: { name: "Nivel 1", risk: "Riesgo bajo", rateEA: 0.24, maxAmount: 5_000_000, minDays: 30, maxDays: 365, seed: 20_000_000 },
  2: { name: "Nivel 2", risk: "Riesgo medio", rateEA: 0.3, maxAmount: 3_000_000, minDays: 30, maxDays: 150, seed: 17_000_000 },
  3: { name: "Nivel 3", risk: "Riesgo alto", rateEA: 0.36, maxAmount: 1_000_000, minDays: 30, maxDays: 90, seed: 13_000_000 },
};

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
  key: "@kratosboveda",
  holderName: "KRA*** BOV*** S.A.S.",
  bank: "Bóveda Kratos (sandbox)",
};
/** Abono mínimo por Bre-B, en pesos */
export const MIN_PAYMENT = 1_000;

/** Mínimo de cuotas por crédito */
export const MIN_INSTALLMENTS = 2;

/** Las cuotas se pagan cada 15 días, contados desde el desembolso (no por quincenas del calendario) */
export const INSTALLMENT_DAYS = 15;

/** Pendientes de definir por el equipo: comisión operativa, seguro contra impago y reserva. */
export const FEES = {
  platformCommission: 0,
  insurance: 0,
  reserve: 0,
};

/** Puntaje mínimo para cada nivel (0-100) */
export const SCORE_THRESHOLDS: { min: number; level: Level }[] = [
  { min: 70, level: 1 },
  { min: 50, level: 2 },
  { min: 35, level: 3 },
];

export const DAY_MS = 24 * 60 * 60 * 1000;
export const YEAR_DAYS = 365;
