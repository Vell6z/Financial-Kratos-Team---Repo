import { DAY_MS, INSTALLMENT_DAYS, YEAR_DAYS } from "./config";

/** Convierte una tasa EA en la tasa equivalente para un periodo de `days` días. */
export function periodRate(rateEA: number, days: number): number {
  return Math.pow(1 + rateEA, days / YEAR_DAYS) - 1;
}

/** Interés compuesto: saldo después de `ms` milisegundos a una tasa EA. */
export function accrue(balance: number, rateEA: number, ms: number): number {
  if (ms <= 0) return balance;
  return balance * Math.pow(1 + rateEA, ms / DAY_MS / YEAR_DAYS);
}

export interface Installment {
  n: number;
  dueAt: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
  /** Fecha en que quedó pagada completa */
  paidAt?: number;
  /** Lo abonado hasta ahora (pagos parciales) */
  paidAmount?: number;
}

/** Tabla de amortización con cuota fija (sistema francés), una cuota cada 15 días. */
export function buildSchedule(amount: number, rateEA: number, installments: number, startAt: number): Installment[] {
  const i = periodRate(rateEA, INSTALLMENT_DAYS);
  const payment = i === 0 ? amount / installments : (amount * i) / (1 - Math.pow(1 + i, -installments));
  const rows: Installment[] = [];
  let balance = amount;
  for (let n = 1; n <= installments; n++) {
    const interest = balance * i;
    let principal = payment - interest;
    if (n === installments) principal = balance; // cierra centavos
    balance = Math.max(0, balance - principal);
    rows.push({
      n,
      dueAt: startAt + n * INSTALLMENT_DAYS * DAY_MS,
      payment: Math.round(principal + interest),
      interest: Math.round(interest),
      principal: Math.round(principal),
      balance: Math.round(balance),
    });
  }
  return rows;
}

export const cop = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);

export const pct = (value: number) => `${(value * 100).toFixed(0)}%`;
