import { DAY_MS, DELINQUENCY, LEVEL_CHANGE, type Level } from "./config";
import type { Applicant, DB, Loan } from "./db";
import type { Installment } from "./finance";
import { addDuration } from "./recurring-interval";

// Historial de pagos del acreditado (área financiera, 17-oct-2026; Reglas_cambio_de_nivel.md):
// - cada cuota tiene una solicitud de pago desde su vencimiento y 3 días para pagarla sin entrar en mora;
// - el peor atraso del último crédito decide el nivel del siguiente;
// - a los 70 días de mora hay un aviso previo y a los 90 un reporte SIMULADO a centrales de riesgo y el castigo.
// Todo se calcula con el reloj de la demo. Sin interés de mora en el MVP.
// No importa services.ts: lo usa db.ts al cargar la base (updateDelinquency).

export type InstallmentState = "PENDIENTE" | "POR_PAGAR" | "PAGADA" | "EN_MORA" | "PAGADA_CON_MORA";

type Inst = Pick<Installment, "dueAt" | "paidAt" | "payment" | "paidAmount" | "principal">;

/** Días de atraso de una cuota, contados desde su vencimiento (hasta que quedó pagada completa, o hasta hoy) */
export function daysLate(i: Inst, t: number) {
  const end = i.paidAt ?? t;
  return end <= i.dueAt ? 0 : Math.floor((end - i.dueAt) / DAY_MS);
}

/** Hasta cuándo se puede pagar sin entrar en mora (fin del día 3 después del vencimiento) */
export const payDeadline = (i: Pick<Installment, "dueAt">) => i.dueAt + (DELINQUENCY.daysToPay + 1) * DAY_MS - 1;

export function installmentState(i: Inst, t: number): InstallmentState {
  if (i.paidAt) return daysLate(i, t) <= DELINQUENCY.daysToPay ? "PAGADA" : "PAGADA_CON_MORA";
  if (t < i.dueAt) return "PENDIENTE";
  return daysLate(i, t) <= DELINQUENCY.daysToPay ? "POR_PAGAR" : "EN_MORA";
}

/** Atraso actual: días de la cuota impaga más antigua ya vencida (0 si está al día) */
export function currentArrears(loan: Pick<Loan, "schedule">, t: number) {
  const oldest = loan.schedule.find((i) => !i.paidAt && i.dueAt <= t);
  return oldest ? daysLate(oldest, t) : 0;
}

/** Peor atraso del crédito: el mayor entre las cuotas pagadas y las vencidas sin pagar */
export function worstDelay(loan: Pick<Loan, "schedule">, t: number) {
  return Math.max(0, ...loan.schedule.filter((i) => i.paidAt || i.dueAt <= t).map((i) => daysLate(i, t)));
}

/** Nivel del siguiente crédito según cómo pagó el último (función de referencia del área financiera) */
export function nextLevel(current: Level, worst: number): { level: Level | 4; blockMonths: number } {
  const r = LEVEL_CHANGE;
  if (worst >= r.defaultDays) return { level: 4, blockMonths: r.blockMonths };
  if (worst > r.downUpTo) return { level: 4, blockMonths: 0 }; // hasta ponerse al día; luego nivel 3
  if (worst > r.keepUpTo) return { level: Math.min(current + 1, 3) as Level, blockMonths: 0 }; // baja (nivel 3 se queda en 3)
  if (worst > r.graceDays) return { level: current, blockMonths: 0 }; // se mantiene
  return { level: Math.max(current - 1, 1) as Level, blockMonths: 0 }; // sube (nivel 1 se queda en 1)
}

/**
 * Nivel con el que puede pedir crédito hoy, o null (nivel 4): bloqueado por 90 días de mora,
 * con un crédito en más de 30 días de mora, o sin estudio aprobado. Con historial, manda el historial.
 */
export function applicantLevel(db: DB, a: Applicant): Level | null {
  const t = Date.now() + db.clockOffsetMs;
  if (a.blockedUntil && a.blockedUntil > t) return null;
  const open = db.loans.filter((l) => l.cedula === a.cedula && l.status === "activo");
  if (open.some((l) => currentArrears(l, t) > LEVEL_CHANGE.downUpTo)) return null;
  return a.historyLevel ?? a.scoreLevel;
}

/** Qué le pasará al nivel si sigue pagando como hasta hoy (para mostrarlo mientras paga y al terminar) */
export function levelOutlook(db: DB, loan: Loan) {
  const t = Date.now() + db.clockOffsetMs;
  const a = db.applicants.find((x) => x.cedula === loan.cedula);
  if (loan.status === "pagado" && a?.lastLoanResult?.loanId === loan.id) {
    const r = a.lastLoanResult;
    return { worstDelay: r.worstDelay, from: r.from, to: r.to, blockedUntil: a.blockedUntil ?? null, closed: true };
  }
  const worst = worstDelay(loan, t);
  const next = nextLevel(loan.level, worst);
  return { worstDelay: worst, from: loan.level, to: next.level, blockedUntil: a?.blockedUntil ?? null, closed: false };
}

/** Al terminar de pagar: aplica la regla de cambio de nivel para el siguiente crédito */
export function closeLoanHistory(db: DB, loan: Loan, t: number) {
  const a = db.applicants.find((x) => x.cedula === loan.cedula);
  if (!a) return;
  const worst = worstDelay(loan, t);
  const next = nextLevel(loan.level, worst);
  // Nivel 4 sin bloqueo (31 a 89 días): ya se puso al día, el siguiente crédito empieza en nivel 3.
  // Con 90 días o más el bloqueo de 12 meses ya se puso al reportar; al terminar, también vuelve en nivel 3
  a.historyLevel = next.level === 4 ? 3 : next.level;
  if (next.blockMonths && !(a.blockedUntil && a.blockedUntil > t)) a.blockedUntil = addDuration(t, `P${next.blockMonths}M`);
  if (worst <= LEVEL_CHANGE.graceDays) a.paidOnTime += 1;
  a.lastLoanResult = { loanId: loan.id, worstDelay: worst, from: loan.level, to: next.level, closedAt: t };
  if (loan.creditReport?.status === "en_mora") Object.assign(loan.creditReport, { status: "pagada", paidAt: t });
  else if (loan.creditReport?.status === "aviso") loan.creditReport.status = "al_dia";
}

/** Capital pendiente de las cuotas vencidas */
const overdueBalance = (loan: Loan, t: number) =>
  Math.round(
    loan.schedule.filter((i) => !i.paidAt && i.dueAt <= t).reduce((s, i) => s + i.principal * (1 - (i.paidAmount ?? 0) / i.payment), 0),
  );

/**
 * Aviso del día 70 y reporte simulado del día 90 (castigo y bloqueo de 12 meses).
 * Las fechas son las del día en que se cumplió el plazo (aunque el reloj de la demo se haya adelantado de golpe).
 */
export function updateDelinquency(db: DB, t: number) {
  for (const loan of db.loans) {
    if (loan.status !== "activo") continue;
    const oldest = loan.schedule.find((i) => !i.paidAt && i.dueAt <= t);
    const arrears = oldest ? daysLate(oldest, t) : 0;
    const r = loan.creditReport;
    if (!oldest) {
      if (r?.status === "aviso") r.status = "al_dia";
      continue;
    }
    if (arrears >= DELINQUENCY.reportNoticeDays && (!r || r.status === "al_dia"))
      loan.creditReport = { noticeAt: oldest.dueAt + DELINQUENCY.reportNoticeDays * DAY_MS, status: "aviso" };
    const report = loan.creditReport;
    if (arrears >= DELINQUENCY.reportDays && report && report.status === "aviso") {
      const reportedAt = oldest.dueAt + DELINQUENCY.reportDays * DAY_MS;
      const user = db.users.find((u) => u.cedula === loan.cedula);
      Object.assign(report, {
        status: "en_mora",
        reportedAt,
        snapshot: {
          holderName: user?.name ?? loan.name,
          documentType: "CC",
          documentNumber: loan.cedula,
          obligationId: loan.id,
          obligationType: "Microcrédito productivo",
          disbursedAt: loan.disbursedAt ?? loan.createdAt,
          amount: loan.amount,
          overdueBalance: overdueBalance(loan, reportedAt),
          daysLate: DELINQUENCY.reportDays,
        },
      });
      // Castigo: el crédito se da por perdido (sigue recibiendo pagos) y la persona queda bloqueada 12 meses
      loan.chargedOffAt = reportedAt;
      const a = db.applicants.find((x) => x.cedula === loan.cedula);
      if (a) a.blockedUntil = addDuration(reportedAt, `P${LEVEL_CHANGE.blockMonths}M`);
    }
  }
}
