import { DAY_MS, INSTALLMENT_DAYS, LEVELS, MIN_LOAN, VAULT_BREB, type Level } from "./config";
import { closeLoanHistory } from "./credit-history";
import type { Applicant, DB, DisbursementState, Loan, Tx } from "./db";
import { buildSchedule } from "./finance";
import { assessWithML } from "./riesgo-ml";
import { computeStudy, creditLimit, type RiskLevel, type StudyAnswers } from "./scoring";

// Datos precargados para la cuenta demo de acreditado, para el pitch:
// - el estudio de crédito ya hecho (Nivel 2 por reglas, el ML no lo mueve);
// - un crédito ya pagado a tiempo, con su paz y salvo, que lo subió de nivel;
// - un crédito activo en el nivel nuevo, con una cuota "por pagar" (venció ayer, aún dentro de los 3 días).
// Las fechas se calculan desde el reloj de la demo al momento de sembrar. Para volver a dejar la cuota
// "por pagar" el día del pitch, usen "Reiniciar demo" en /boveda (vuelve a sembrar con la fecha de ese día).
// Se crea una vez por versión (db.demoBorrowerSeeded) y solo si la cuenta demo no tiene estudio ni créditos propios.
// No importa services.ts: lo usa db.ts al cargar la base.

const DEMO_BORROWER_ID = "demo-acr";

/** Súbanla si cambian los datos de abajo: la demo anterior se reemplaza al cargar la base */
const SEED_VERSION = 1;

/** Respuestas del estudio: tendera de barrio, ingresos algo variables, paga sus cuentas a tiempo, una referencia confirmada */
const ANSWERS: StudyAnswers = {
  confirmAdult: true,
  consent: true,
  sector: "tienda_barrio",
  dependents: "2",
  income: "1400000",
  expenses: "700000",
  debts: "100000",
  loanShark: "no",
  variability: "algo",
  activityAge: "gt2",
  utilities: "siempre",
  rent: "siempre",
  phonePlan: "semana",
  savingsGroup: "cumplo",
  creditPurchases: "aldia",
  housingAge: "gt2",
  workplace: "fijo",
  phoneOwner: "si",
  likert: [4, 5, 2, 3, 1, 4, 3, 4, 2, 4, 2],
  timePref: "mes",
  references: [
    { name: "Marta Gómez", phone: "3104567890", relation: "Proveedor", relationOther: "", notify: true },
    { name: "", phone: "", relation: "", relationOther: "", notify: false },
  ],
};

/** Línea de tiempo, en días antes de hoy */
const STUDY_DAYS_AGO = 130;
const PAID_LOAN = { daysAgo: 125, amount: 700_000, installments: 6, purpose: "capital_trabajo" };
/** Desembolsado hace 31 días: la cuota 1 venció hace 16 (pagada) y la 2 venció ayer (por pagar) */
const ACTIVE_LOAN = { daysAgo: 31, amount: 1_000_000, installments: 8, paid: 1, purpose: "herramientas" };

const BREB_HOLDER = { keyType: "PHONE" as const, holderName: "And*** Acr***", financialEntity: { name: "NEQUI", code: "507" } };

const id = () => crypto.randomUUID().slice(0, 8);

/** Quita la demo de una versión anterior. Devuelve false si la cuenta demo tiene estudio o créditos propios (no se toca nada) */
function removePreviousSeed(db: DB, cedula: string) {
  const applicant = db.applicants.find((a) => a.cedula === cedula);
  const loans = db.loans.filter((l) => l.cedula === cedula);
  if ((applicant && !applicant.demo) || loans.some((l) => !l.demo)) return false;
  const loanIds = new Set(loans.map((l) => l.id));
  const txs = db.txs.filter((x) => x.loanId && loanIds.has(x.loanId));
  // Devuelve a los pools lo que movieron los créditos de demostración
  for (const loan of loans) {
    const paid = txs.filter((x) => x.kind === "pago_breb" && x.loanId === loan.id).reduce((s, x) => s + x.amountCop, 0);
    const pool = db.pools[loan.level];
    pool.liquidity += loan.amount - paid;
    pool.lent = Math.max(0, pool.lent - loan.schedule.filter((i) => !i.paidAt).reduce((s, i) => s + i.principal, 0));
  }
  db.loans = db.loans.filter((l) => !loanIds.has(l.id));
  db.txs = db.txs.filter((x) => !txs.includes(x));
  db.applicants = db.applicants.filter((a) => a.cedula !== cedula);
  return true;
}

/** Precarga el estudio y los créditos de la cuenta demo de acreditado. `t`: la hora actual de la demo (now(db)) */
export function seedDemoBorrower(db: DB, t: number) {
  if (db.demoBorrowerSeeded === SEED_VERSION) return;
  db.demoBorrowerSeeded = SEED_VERSION;
  const user = db.users.find((u) => u.id === DEMO_BORROWER_ID);
  // Si la cuenta demo ya hizo su estudio o pidió créditos de verdad, no se le agrega ni se le quita nada
  if (!user || !removePreviousSeed(db, user.cedula)) return;

  // ---------- Estudio (mismo cálculo y ajuste de ML que saveStudy) ----------
  const result = computeStudy(ANSWERS, { docs: {}, hasUnpaidLoan: false });
  const ml = assessWithML(ANSWERS, {}, user.age, result.riskLevel, result.maxInstallment);
  let riskLevel: RiskLevel = result.riskLevel;
  if (ml?.adjustment === 1 && riskLevel > 1) riskLevel = (riskLevel - 1) as RiskLevel;
  if (ml?.adjustment === -1 && riskLevel < 4) riskLevel = (riskLevel + 1) as RiskLevel;
  const level = riskLevel === 4 ? null : riskLevel;
  const applicant: Applicant = {
    cedula: user.cedula,
    name: user.name,
    score: result.score,
    scoreLevel: level,
    riskLevel,
    recommendations: level === 1 ? result.recommendations.filter((r) => !r.includes("subes un nivel")) : result.recommendations,
    breakdown: result.breakdown,
    maxInstallment: result.maxInstallment,
    backing: result.backing,
    alerts: result.alerts,
    review: result.review,
    reasons: result.reasons,
    ml,
    docReadings: {},
    answers: ANSWERS,
    docs: {},
    paidOnTime: 0,
    evaluatedAt: t - STUDY_DAYS_AGO * DAY_MS,
    demo: true,
  };
  db.applicants.push(applicant);
  // Si algún día el modelo lo deja en nivel 4, la demo queda solo con el estudio
  if (!level) return;

  const txs: Tx[] = [];
  const llave = user.borrowerProfile?.llaveBreb ?? "3000000000";

  /** Crea un crédito desembolsado hace `daysAgo` días con sus primeras `paid` cuotas pagadas a tiempo (un día antes) */
  const createLoan = (loanLevel: Level, opts: { daysAgo: number; amount: number; installments: number; paid: number; purpose: string }) => {
    const cfg = LEVELS[loanLevel];
    const installments = Math.min(opts.installments, Math.floor(cfg.maxDays / INSTALLMENT_DAYS));
    // El monto respeta el cupo por capacidad de pago, igual que requestLoan
    const amount = Math.min(opts.amount, creditLimit(loanLevel, applicant.maxInstallment, installments));
    if (amount < MIN_LOAN) return null;
    const at = t - opts.daysAgo * DAY_MS;
    const loanId = id();
    const payoutId = `PAYOUT-${loanId.toUpperCase()}`;
    const schedule = buildSchedule(amount, cfg.rateEA, installments, at);
    const states: DisbursementState[] = ["CREDIT_APPROVED", "BREB_KEY_VERIFIED", "USER_CONFIRMED_BENEFICIARY", "TREASURY_DEBITED", "PAYOUT_SUBMITTED", "DISBURSED"];
    const loan: Loan = {
      id: loanId,
      cedula: user.cedula,
      name: user.name,
      llaveBreb: llave,
      breb: { verificationId: `demo-${loanId}`, ...BREB_HOLDER, mode: "simulado", verifiedAt: at, confirmedAt: at },
      disbursement: { state: "DISBURSED", history: states.map((state) => ({ state, at })), reference: loanId },
      payout: {
        id: payoutId,
        reference: loanId,
        idempotencyKey: loanId,
        status: "SIMULATED_APPROVED",
        directory: "simulado",
        checkedAt: at,
        beneficiary: { key: llave, keyType: BREB_HOLDER.keyType, holderName: BREB_HOLDER.holderName, financialEntity: BREB_HOLDER.financialEntity },
        amountCop: amount,
        request: { reference: loanId, transactions: [{ amount: amount * 100, name: user.name, email: user.email, key: llave }] },
        submittedAt: at,
      },
      level: loanLevel,
      rateEA: cfg.rateEA,
      amount,
      installments,
      schedule,
      status: "activo",
      createdAt: at,
      disbursedAt: at,
      purpose: opts.purpose,
      termsAcceptedAt: at,
      demo: true,
    };
    txs.push({
      id: id(),
      at,
      kind: "desembolso_breb",
      level: loanLevel,
      amountCop: amount,
      detail: `Desembolso a ${user.name} · llave ${llave} · ${BREB_HOLDER.financialEntity.name} · ${payoutId}`,
      mode: "simulado",
      cedula: user.cedula,
      loanId,
    });
    const pool = db.pools[loanLevel];
    pool.liquidity -= amount;
    pool.lent += amount;

    let owed = schedule.reduce((s, i) => s + i.payment, 0);
    for (const inst of schedule.slice(0, opts.paid)) {
      const paidAt = inst.dueAt - DAY_MS;
      inst.paidAmount = inst.payment;
      inst.paidAt = paidAt;
      owed -= inst.payment;
      pool.liquidity += inst.payment;
      pool.lent = Math.max(0, pool.lent - inst.principal);
      const txId = id();
      txs.push({
        id: txId,
        at: paidAt,
        kind: "pago_breb",
        level: loanLevel,
        amountCop: inst.payment,
        detail: `Bre-B de ${user.name} (${llave}) a ${VAULT_BREB.key}: cuota ${inst.n}`,
        mode: "simulado",
        cedula: user.cedula,
        loanId,
        breb: {
          reference: `BREB-${txId.toUpperCase()}`,
          fromKey: llave,
          toKey: VAULT_BREB.key,
          applied: [{ n: inst.n, amount: inst.payment, completed: true }],
          owedAfter: owed,
        },
      });
    }
    db.loans.push(loan);
    return loan;
  };

  // ---------- Crédito ya pagado a tiempo: al cerrarlo, la regla de cambio de nivel lo sube ----------
  const paidLoan = createLoan(level, { ...PAID_LOAN, paid: PAID_LOAN.installments });
  if (paidLoan) {
    paidLoan.status = "pagado";
    closeLoanHistory(db, paidLoan, Math.max(...paidLoan.schedule.map((i) => i.paidAt ?? 0)));
  }

  // ---------- Crédito activo en el nivel que le dio su historial, con la cuota 2 por pagar ----------
  createLoan(applicant.historyLevel ?? level, ACTIVE_LOAN);

  db.txs = [...db.txs, ...txs].sort((a, b) => b.at - a.at);
}
