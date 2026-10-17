import "server-only";
import { CREDIT_PURPOSES, DAY_MS, EARLY_WITHDRAWAL_SHARE, INVESTOR_ECONOMICS, INSTALLMENT_DAYS, investmentTermDays, Level, LEVELS, MIN_INSTALLMENTS, MIN_INVESTMENT, MIN_LOAN, MIN_PAYMENT, VAULT_BREB } from "./config";
import { Applicant, DB, DisbursementState, Loan, Lot, Payout, Position, Tx, TxKind, newId, now } from "./db";
import { accrue, buildSchedule, cop } from "./finance";
import { applicantLevel, closeLoanHistory, currentArrears, daysLate as lateDays, installmentState, levelOutlook, payDeadline } from "./credit-history";
import { assessWithML, mlHint } from "./riesgo-ml";
import { CONFIG, computeStudy, creditLimit, DOCS, type DocKey, type DocReading, type RiskLevel, type StudyAnswers } from "./scoring";
import { validateMoney } from "./validators";

/** Máximo por retiro en pesos (lo calcula la ruta con la tasa del dólar: fx.maxWithdrawalCop) */
type MaxCop = number;

export class BusinessError extends Error {}

function addTx(
  db: DB,
  kind: TxKind,
  level: Level,
  amountCop: number,
  detail: string,
  mode: "interledger" | "simulado",
  owner: { wallet?: string; cedula?: string },
) {
  const id = newId();
  db.txs.unshift({ id, at: now(db), kind, level, amountCop, detail, mode, ...owner });
  return id;
}

// ---------- Inversionistas (cajitas con interés compuesto) ----------

/** Convierte una cajita del formato anterior (un solo plazo) en un aporte, sin perder nada */
function ensureLots(p: Position): Lot[] {
  if (!p.lots) {
    p.lots =
      p.balance >= 0.5
        ? [{ id: newId(), at: p.lastAccrualAt, principal: p.deposited, value: p.balance, maturesAt: p.lockedUntil ?? 0, earlyWithdrawn: p.earlyWithdrawn ?? 0 }]
        : [];
    delete p.lockedUntil;
    delete p.earlyWithdrawn;
  }
  return p.lots;
}

/** Lleva el saldo de la cajita y de cada aporte al momento actual con interés compuesto. */
function accruePosition(db: DB, p: Position) {
  const t = now(db);
  const lots = ensureLots(p);
  // La cajita rinde a la rentabilidad esperada del inversionista (no a la tasa del acreditado)
  const growth = accrue(1, LEVELS[p.level].investorRateEA, t - p.lastAccrualAt);
  for (const l of lots) l.value *= growth;
  p.balance = lots.reduce((s, l) => s + l.value, 0);
  p.lastAccrualAt = t;
}

export function accrueAll(db: DB) {
  db.positions.forEach((p) => accruePosition(db, p));
}

function findOrCreatePosition(db: DB, wallet: string, level: Level): Position {
  let p = db.positions.find((x) => x.wallet === wallet && x.level === level);
  if (!p) {
    p = { id: newId(), wallet, level, balance: 0, deposited: 0, withdrawn: 0, lastAccrualAt: now(db), lots: [] };
    db.positions.push(p);
  }
  return p;
}

/** Cuánto se puede sacar hoy de un aporte: todo si cumplió su plazo; antes, hasta el 50 % (contando lo que ya sacó) */
function lotAllowed(l: Lot, t: number) {
  if (l.maturesAt <= t) return l.value;
  return Math.max(0, EARLY_WITHDRAWAL_SHARE * (l.value + l.earlyWithdrawn) - l.earlyWithdrawn);
}

/**
 * Cuánto puede retirar ahora de una cajita: lo de los aportes que cumplieron su plazo, más hasta el 50 %
 * de los que siguen en plazo. Nunca más del máximo por retiro (US$30.000 en pesos).
 */
export function withdrawable(db: DB, p: Position, maxCop: MaxCop = Infinity) {
  const t = now(db);
  const lots = ensureLots(p).filter((l) => l.value >= 0.5);
  const allowed = lots.reduce((s, l) => s + lotAllowed(l, t), 0);
  const pending = lots.filter((l) => l.maturesAt > t).map((l) => l.maturesAt);
  return {
    matured: pending.length === 0,
    /** Próximo vencimiento entre los aportes que siguen en plazo */
    nextMaturity: pending.length ? Math.min(...pending) : null,
    /** Lo que permiten los plazos, sin el tope por retiro */
    allowed: Math.floor(allowed),
    max: Math.floor(Math.min(allowed, maxCop)),
    lots: lots
      .map((l) => ({ id: l.id, at: l.at, principal: l.principal, value: l.value, maturesAt: l.maturesAt, matured: l.maturesAt <= t, allowed: Math.floor(lotAllowed(l, t)) }))
      .sort((a, b) => a.at - b.at),
  };
}

/**
 * Abona una inversión a la cajita como un aporte nuevo. Devuelve el id del movimiento.
 * `partial`: llegó solo una parte de lo pedido (confirmado por la bóveda); se abona lo que llegó aunque sea menor al mínimo.
 */
export function creditDeposit(db: DB, wallet: string, level: Level, amountCop: number, mode: "interledger" | "simulado", opts: { partial?: boolean } = {}) {
  const amountError = validateMoney(amountCop, { min: opts.partial ? 1 : MIN_INVESTMENT });
  if (amountError) throw new BusinessError(amountError);
  const p = findOrCreatePosition(db, wallet, level);
  accruePosition(db, p);
  // Cada aporte tiene su propio plazo: no se reinicia el de los anteriores
  const t = now(db);
  p.lots = ensureLots(p).filter((l) => l.value >= 0.5);
  const lot: Lot = { id: newId(), at: t, principal: amountCop, value: amountCop, maturesAt: t + investmentTermDays(level) * DAY_MS, earlyWithdrawn: 0 };
  p.lots.push(lot);
  p.balance += amountCop;
  p.deposited += amountCop;
  db.pools[level].liquidity += amountCop;
  const txId = addTx(db, "deposito_ilp", level, amountCop, `Inversión desde ${wallet}`, mode, { wallet });
  db.txs[0].receipt = { investorWallet: wallet, requestedCop: amountCop, lotId: lot.id, maturesAt: lot.maturesAt };
  fundWaitingLoans(db, level);
  return txId;
}

/** Valida que el retiro sea posible (saldo, plazos de los aportes, máximo por retiro y liquidez del pool). */
export function checkWithdraw(db: DB, wallet: string, level: Level, amountCop: number, maxCop: MaxCop = Infinity): Position {
  const p = db.positions.find((x) => x.wallet === wallet && x.level === level);
  if (!p) throw new BusinessError("No tienes inversión en este nivel");
  accruePosition(db, p);
  if (!(amountCop > 0)) throw new BusinessError("Ingresa un monto mayor a cero");
  if (amountCop > p.balance + 1) throw new BusinessError(`Tu saldo disponible es ${cop(p.balance)}`);
  if (amountCop > maxCop) throw new BusinessError(`El máximo por retiro es US$30.000 (${cop(maxCop)} hoy)`);
  const w = withdrawable(db, p);
  if (amountCop > w.allowed + 1) {
    const next = w.nextMaturity ? new Date(w.nextMaturity).toLocaleDateString("es-CO", { day: "numeric", month: "long" }) : null;
    throw new BusinessError(
      `Hoy puedes retirar hasta ${cop(w.allowed)}: todo lo de los aportes que cumplieron su plazo y hasta el ${EARLY_WITHDRAWAL_SHARE * 100} % de los que siguen en plazo.` +
        (next ? ` Tu próximo aporte vence el ${next}.` : ""),
    );
  }
  if (amountCop > db.pools[level].liquidity)
    // No se expone la liquidez interna del pool al usuario
    throw new BusinessError("En este momento no podemos procesar ese monto: parte del capital está prestado. Intenta un monto menor o vuelve más tarde.");
  return p;
}

/**
 * Saca el retiro de los aportes: primero de los que cumplieron su plazo (el más antiguo primero),
 * después de los que siguen en plazo, cada uno hasta su 50 %.
 */
export function debitWithdraw(db: DB, wallet: string, level: Level, amountCop: number, mode: "interledger" | "simulado", maxCop: MaxCop = Infinity) {
  const p = checkWithdraw(db, wallet, level, amountCop, maxCop);
  const t = now(db);
  const lots = ensureLots(p);
  const order = [...lots].sort((a, b) => Number(b.maturesAt <= t) - Number(a.maturesAt <= t) || a.at - b.at);
  let left = amountCop;
  const taken: NonNullable<Tx["lots"]> = [];
  for (const l of order) {
    if (left <= 0) break;
    const take = Math.min(left, lotAllowed(l, t));
    if (take <= 0) continue;
    const early = l.maturesAt > t;
    l.value -= take;
    if (early) l.earlyWithdrawn += take;
    taken.push({ id: l.id, amount: take, early });
    left -= take;
  }
  // Redondeos de centavos: lo que falte sale del aporte con más valor
  if (left > 0 && left <= 1) {
    const big = lots.reduce((a, b) => (b.value > a.value ? b : a));
    big.value -= left;
    taken.push({ id: big.id, amount: left, early: big.maturesAt > t });
  }
  // Los aportes que quedan en cero se conservan hasta el próximo aporte: si el envío falla, se devuelven con su plazo
  p.balance = Math.max(0, lots.reduce((s, l) => s + l.value, 0));
  p.withdrawn += amountCop;
  db.pools[level].liquidity -= amountCop;
  const txId = addTx(db, "retiro_ilp", level, amountCop, `Retiro hacia ${wallet}`, mode, { wallet });
  db.txs[0].lots = taken;
  db.txs[0].receipt = { investorWallet: wallet, requestedCop: amountCop };
  return txId;
}

/**
 * Deshace un retiro reservado cuyo envío por Interledger falló: el saldo vuelve a los aportes de donde salió.
 * `share`: parte que SÍ llegó al inversionista (0 = no llegó nada y se borra el movimiento; 0,4 = se devuelve el 60 %).
 */
export function refundWithdraw(db: DB, wallet: string, level: Level, amountCop: number, txId: string, share = 0) {
  const p = db.positions.find((x) => x.wallet === wallet && x.level === level);
  const tx = db.txs.find((t) => t.id === txId);
  const back = 1 - Math.min(1, Math.max(0, share));
  const refund = share > 0 ? Math.round(amountCop * back) : amountCop;
  if (p) {
    const lots = ensureLots(p);
    for (const x of tx?.lots ?? []) {
      const amount = share > 0 ? x.amount * back : x.amount;
      let l = lots.find((y) => y.id === x.id);
      // Caso raro: el aporte se depuró entre el retiro y la devolución; la plata vuelve como aporte disponible
      if (!l) lots.push((l = { id: x.id, at: now(db), principal: amount, value: 0, maturesAt: 0, earlyWithdrawn: 0 }));
      l.value += amount;
      if (x.early) l.earlyWithdrawn = Math.max(0, l.earlyWithdrawn - amount);
      x.amount -= amount;
    }
    p.balance = lots.reduce((s, l) => s + l.value, 0);
    p.withdrawn -= refund;
  }
  db.pools[level].liquidity += refund;
  if (share > 0 && tx) tx.amountCop = amountCop - refund;
  else db.txs = db.txs.filter((t) => t.id !== txId);
}

// ---------- Estudio de crédito ----------

/** Guarda el estudio de crédito del acreditado y devuelve su resultado. `readings`: lo que se leyó de cada documento. */
export function saveStudy(
  db: DB,
  cedula: string,
  name: string,
  age: number,
  answers: StudyAnswers,
  docs: Partial<Record<DocKey, string>>,
  readings: Partial<Record<DocKey, DocReading>>,
) {
  const prev = db.applicants.find((x) => x.cedula === cedula);
  if (prev?.retryAt && prev.retryAt > now(db))
    throw new BusinessError(`Podrás volver a hacer el estudio desde el ${new Date(prev.retryAt).toLocaleDateString("es-CO", { day: "numeric", month: "long" })}.`);
  const hasUnpaidLoan = db.loans.some((l) => l.cedula === cedula && loanView(db, l).overdue);
  let result;
  try {
    result = computeStudy(answers, { docs: readings, hasUnpaidLoan });
  } catch (err) {
    throw new BusinessError((err as Error).message);
  }

  // El modelo de ML ajusta el nivel de reglas: sube o baja un escalón según la probabilidad de atraso
  const ml = assessWithML(answers, readings, age, result.riskLevel, result.maxInstallment);
  let riskLevel: RiskLevel = result.riskLevel;
  let reasons = result.reasons;
  if (ml?.adjustment === 1) riskLevel = (riskLevel - 1) as RiskLevel;
  if (ml?.adjustment === -1) {
    riskLevel = (riskLevel + 1) as RiskLevel;
    // Con el nivel más bajo, el crédito mínimo también debe caber en su cuota máxima
    if (riskLevel !== 4 && creditLimit(riskLevel, result.maxInstallment, Math.floor(LEVELS[riskLevel].maxDays / INSTALLMENT_DAYS)) < MIN_LOAN)
      riskLevel = 4;
    if (riskLevel === 4)
      reasons = [
        `Nuestro modelo de riesgo estima una probabilidad de atraso del ${(Math.round(ml.probability * 1000) / 10).toLocaleString("es-CO")} % con tu perfil actual.`,
        ...(ml.against.length ? [`Lo que más pesó en contra: ${ml.against.map((g) => g.toLowerCase()).join("; ")}.`] : []),
        mlHint(ml.against),
      ];
  }
  const level = riskLevel === 4 ? null : riskLevel;
  let a = prev;
  if (!a) {
    a = {
      cedula,
      name,
      score: 0,
      scoreLevel: null,
      riskLevel: 4,
      recommendations: [],
      breakdown: [],
      maxInstallment: 0,
      backing: 0,
      alerts: [],
      review: false,
      reasons: [],
      answers,
      docs,
      paidOnTime: 0,
      evaluatedAt: 0,
    };
    db.applicants.push(a);
  }
  Object.assign(a, {
    name,
    answers,
    docs,
    score: result.score,
    scoreLevel: level,
    riskLevel,
    recommendations: level === 1 ? result.recommendations.filter((r) => !r.includes("subes un nivel")) : result.recommendations,
    breakdown: result.breakdown,
    maxInstallment: result.maxInstallment,
    backing: result.backing,
    alerts: result.alerts,
    review: result.review,
    reasons,
    ml,
    docReadings: readings,
    retryAt: riskLevel === 4 ? now(db) + CONFIG.retryDays * DAY_MS : undefined,
    evaluatedAt: now(db),
  });
  return studyView(db, a);
}

/** Lo que el acreditado ve de su estudio (sin rutas de archivos ni respuestas) */
export function studyView(db: DB, a: Applicant) {
  const t = now(db);
  return {
    name: a.name,
    score: a.score,
    // Con historial de pagos manda el historial; bloqueado o en mora de más de 30 días: null
    level: applicantLevel(db, a),
    blockedUntil: a.blockedUntil && a.blockedUntil > t ? a.blockedUntil : null,
    recommendations: a.recommendations,
    breakdown: a.breakdown,
    maxInstallment: a.maxInstallment,
    riskLevel: a.riskLevel,
    backing: a.backing,
    alerts: a.alerts,
    review: a.review,
    reasons: a.reasons,
    ml: a.ml ?? null,
    // Qué se leyó de cada documento (sin el titular ni rutas de archivo)
    docs: (Object.entries(a.docReadings ?? {}) as [DocKey, DocReading][]).map(([key, r]) => ({
      key,
      label: DOCS[key].split(" (")[0],
      valid: r.valid,
      altered: r.altered,
      summary: r.summary,
      reason: r.reason,
      monthlyIncome: r.monthlyIncome,
      hasOverdue: r.hasOverdue,
      issuer: r.issuer,
      source: r.source,
    })),
    retryAt: a.retryAt ?? null,
    canRetake: !a.retryAt || a.retryAt <= t,
    docsCount: Object.keys(a.docs ?? {}).length,
    evaluatedAt: a.evaluatedAt,
  };
}

// ---------- Créditos ----------

/** Avanza el desembolso de un crédito a un nuevo estado y lo deja en el historial */
function advance(db: DB, loan: Loan, state: DisbursementState, at = now(db)) {
  loan.disbursement ??= { state, history: [], reference: loan.id };
  loan.disbursement.state = state;
  loan.disbursement.history.push({ state, at });
}

/**
 * Pide un crédito con una llave Bre-B ya verificada y un beneficiario confirmado por el usuario.
 * La llave sale de la verificación guardada en el servidor, nunca del formulario: así no se puede cambiar después de verificarla.
 */
export function requestLoan(
  db: DB,
  user: { id: string; cedula: string },
  amount: number,
  installments: number,
  verificationId: string,
  confirmedBeneficiary: boolean,
  contract: { purpose: string; termsAccepted: boolean },
): Loan {
  const cedula = user.cedula;
  const a = db.applicants.find((x) => x.cedula === cedula);
  if (!a) throw new BusinessError("Primero debes hacer el estudio de crédito");
  const level = applicantLevel(db, a);
  if (!level)
    throw new BusinessError(
      a.blockedUntil && a.blockedUntil > now(db)
        ? `Podrás volver a solicitar crédito desde el ${new Date(a.blockedUntil).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}.`
        : a.historyLevel || a.scoreLevel
          ? "Tienes cuotas con más de 30 días de atraso. Ponte al día para volver a pedir crédito."
          : "Tu estudio de crédito no fue aprobado todavía",
    );
  if (db.loans.some((l) => l.cedula === cedula && l.status !== "pagado" && l.status !== "cancelado"))
    throw new BusinessError("Ya tienes un crédito vigente o en espera");
  const cfg = LEVELS[level];
  const amountError = validateMoney(amount, { min: MIN_LOAN, max: cfg.maxAmount });
  if (amountError) throw new BusinessError(`${amountError} para ${cfg.name}`);
  const days = installments * INSTALLMENT_DAYS;
  if (!Number.isInteger(installments) || installments < MIN_INSTALLMENTS)
    throw new BusinessError(`El crédito es de mínimo ${MIN_INSTALLMENTS} cuotas (una cada ${INSTALLMENT_DAYS} días)`);
  if (days < cfg.minDays || days > cfg.maxDays)
    throw new BusinessError(`El plazo para ${cfg.name} va de ${cfg.minDays} a ${cfg.maxDays} días`);
  // Cupo según capacidad de pago (el menor entre el techo del nivel y lo que alcanza a pagar en ese plazo)
  const limit = creditLimit(level, a.maxInstallment, installments);
  if (amount > limit) throw new BusinessError(`Con ${installments} cuotas tu cupo es ${cop(limit)}. Elige más cuotas o un monto menor.`);
  // La cuota no puede superar su capacidad de pago calculada en el estudio
  const firstPayment = buildSchedule(amount, cfg.rateEA, installments, now(db))[0].payment;
  if (a.maxInstallment && firstPayment > a.maxInstallment)
    throw new BusinessError(`La cuota (${cop(firstPayment)}) supera lo que puedes pagar cada ${INSTALLMENT_DAYS} días (${cop(a.maxInstallment)}). Elige más cuotas o un monto menor.`);

  // Crédito productivo: destino y aceptación del contrato y el pagaré (simulados)
  if (!CREDIT_PURPOSES.some((p) => p.id === contract.purpose)) throw new BusinessError("Cuéntanos para qué vas a usar el crédito.");
  if (!contract.termsAccepted) throw new BusinessError("Debes aceptar el contrato y el pagaré para solicitar el crédito.");

  // Llave Bre-B: verificada, vigente, del mismo solicitante, sin usar y con el titular confirmado
  const v = db.brebVerifications.find((x) => x.id === verificationId);
  if (!v || v.userId !== user.id) throw new BusinessError("Verifica tu llave Bre-B antes de solicitar el crédito.");
  if (v.status !== "VERIFIED") throw new BusinessError("Esa verificación ya se usó. Verifica tu llave de nuevo.");
  if (v.expiresAt < Date.now()) throw new BusinessError("La verificación de tu llave venció (dura 5 minutos). Verifícala de nuevo.");
  if (!confirmedBeneficiary) throw new BusinessError("Confirma que el titular de la llave eres tú.");
  v.status = "USED";

  const loan: Loan = {
    id: newId(),
    cedula,
    name: a.name,
    llaveBreb: v.key,
    breb: {
      verificationId: v.id,
      keyType: v.keyType,
      holderName: v.holderName,
      financialEntity: v.financialEntity,
      mode: v.mode,
      verifiedAt: v.verifiedAt,
      confirmedAt: Date.now(),
    },
    level,
    rateEA: cfg.rateEA,
    amount,
    installments,
    schedule: buildSchedule(amount, cfg.rateEA, installments, now(db)),
    status: "en_espera",
    createdAt: now(db),
    purpose: contract.purpose,
    termsAcceptedAt: now(db),
  };
  advance(db, loan, "CREDIT_APPROVED", a.evaluatedAt);
  advance(db, loan, "BREB_KEY_VERIFIED");
  advance(db, loan, "USER_CONFIRMED_BENEFICIARY");
  db.loans.push(loan);
  fundWaitingLoans(db, level);
  return loan;
}

/**
 * Reserva el capital del pool para los créditos en espera, por orden de llegada (TREASURY_DEBITED).
 * El payout lo hace después `processPayouts` (src/lib/payouts.ts), que vuelve a verificar la llave Bre-B.
 */
function fundWaitingLoans(db: DB, level: Level) {
  const pool = db.pools[level];
  for (const loan of db.loans) {
    if (loan.level !== level || loan.status !== "en_espera") continue;
    // Sin llave verificada y beneficiario confirmado no se debita la tesorería ni se crea el payout
    if (loan.disbursement?.state !== "USER_CONFIRMED_BENEFICIARY") continue;
    // Encaje: el 15 % del pool (disponible + prestado) no se presta, queda para los retiros. Respeta el orden de la fila
    if (pool.liquidity - loan.amount < INVESTOR_ECONOMICS.reserveRequirement * (pool.liquidity + pool.lent)) break;
    pool.liquidity -= loan.amount;
    pool.lent += loan.amount;
    advance(db, loan, "TREASURY_DEBITED");
  }
}

/** Créditos con el capital reservado esperando el payout */
export const loansAwaitingPayout = (db: DB) => db.loans.filter((l) => l.status === "en_espera" && l.disbursement?.state === "TREASURY_DEBITED" && !l.payout);

/**
 * La llave sigue activa y a nombre del mismo titular: se arma el payout (simulado) y el crédito queda activo.
 * Idempotente: si el crédito ya tiene payout, no hace nada.
 */
export function completeDisbursement(db: DB, loanId: string, check: { directory: Payout["directory"]; holderName: string; financialEntity: { name: string; code: string } }) {
  const loan = db.loans.find((l) => l.id === loanId);
  if (!loan || loan.payout || loan.disbursement?.state !== "TREASURY_DEBITED") return;
  const user = db.users.find((u) => u.cedula === loan.cedula);
  const t = now(db);
  loan.payout = {
    id: `PAYOUT-${loan.id.slice(0, 8).toUpperCase()}`,
    reference: loan.id,
    idempotencyKey: loan.id,
    status: "SIMULATED_APPROVED",
    directory: check.directory,
    checkedAt: Date.now(),
    beneficiary: { key: loan.llaveBreb, keyType: loan.breb?.keyType ?? "", holderName: check.holderName, financialEntity: check.financialEntity },
    amountCop: loan.amount,
    // Wompi espera centavos
    request: { reference: loan.id, transactions: [{ amount: loan.amount * 100, name: loan.name, email: user?.email ?? "", key: loan.llaveBreb }] },
    submittedAt: t,
  };
  advance(db, loan, "PAYOUT_SUBMITTED");
  loan.status = "activo";
  loan.disbursedAt = t;
  loan.schedule = buildSchedule(loan.amount, loan.rateEA, loan.installments, t);
  addTx(db, "desembolso_breb", loan.level, loan.amount, `Desembolso a ${loan.name} · llave ${loan.llaveBreb} · ${check.financialEntity.name} · ${loan.payout.id}`, "simulado", { cedula: loan.cedula });
  db.txs[0].loanId = loan.id;
  advance(db, loan, "DISBURSED");
}

/** La llave ya no sirve: no se paga, el capital vuelve al pool y el crédito se cancela */
export function rejectDisbursement(db: DB, loanId: string, reason: string) {
  const loan = db.loans.find((l) => l.id === loanId);
  if (!loan || loan.payout || loan.disbursement?.state !== "TREASURY_DEBITED") return;
  const pool = db.pools[loan.level];
  pool.liquidity += loan.amount;
  pool.lent = Math.max(0, pool.lent - loan.amount);
  advance(db, loan, "BREB_KEY_REJECTED");
  loan.disbursement!.rejectedReason = reason;
  loan.status = "cancelado";
  fundWaitingLoans(db, loan.level);
}

/** Lo que falta por pagar de una cuota (descuenta los abonos parciales) */
export const installmentDue = (i: { payment: number; paidAmount?: number; paidAt?: number }) => (i.paidAt ? 0 : Math.max(0, i.payment - (i.paidAmount ?? 0)));

/**
 * Transferencia Bre-B simulada del banco del acreditado a la llave de la plataforma (vinculada a la bóveda).
 * El abono se aplica a la cuota más antigua y, si sobra, a las siguientes. La plata entra al pool del nivel.
 */
export function receiveBrebPayment(db: DB, loanId: string, opts: { toKey: string; fromKey: string; amount: number }) {
  if (opts.toKey.trim().toLowerCase() !== VAULT_BREB.key.toLowerCase())
    throw new BusinessError("Esa llave no existe en el directorio Bre-B. Revisa la llave de destino.");
  const loan = db.loans.find((l) => l.id === loanId);
  if (!loan) throw new BusinessError("Crédito no encontrado");
  if (loan.status !== "activo") throw new BusinessError("Este crédito no tiene cuotas por pagar");
  const owed = loan.schedule.reduce((s, i) => s + installmentDue(i), 0);
  const amount = Math.round(opts.amount);
  const amountError = validateMoney(amount, { min: Math.min(MIN_PAYMENT, owed), max: owed, label: "el valor a transferir" });
  if (amountError) throw new BusinessError(amountError);

  const t = now(db);
  const pool = db.pools[loan.level];
  let left = amount;
  const applied: { n: number; amount: number; completed: boolean }[] = [];
  for (const i of loan.schedule) {
    if (left <= 0) break;
    const due = installmentDue(i);
    if (due <= 0) continue;
    const take = Math.min(due, left);
    i.paidAmount = (i.paidAmount ?? 0) + take;
    left -= take;
    // La parte de capital que vuelve al pool, proporcional al abono
    pool.lent = Math.max(0, pool.lent - Math.round((take / i.payment) * i.principal));
    const completed = installmentDue(i) <= 0;
    if (completed) i.paidAt = t;
    applied.push({ n: i.n, amount: take, completed });
  }
  pool.liquidity += amount;
  const what = applied.map((a) => `cuota ${a.n}${a.completed ? "" : " (abono)"}`).join(", ");
  const txId = addTx(db, "pago_breb", loan.level, amount, `Bre-B de ${loan.name} (${opts.fromKey}) a ${VAULT_BREB.key}: ${what}`, "simulado", { cedula: loan.cedula });
  const reference = `BREB-${txId.slice(0, 8).toUpperCase()}`;
  db.txs[0].loanId = loan.id;
  db.txs[0].breb = { reference, fromKey: opts.fromKey, toKey: VAULT_BREB.key, applied, owedAfter: loan.schedule.reduce((s, i) => s + installmentDue(i), 0) };

  if (loan.schedule.every((i) => i.paidAt)) {
    loan.status = "pagado";
    // Nivel del siguiente crédito según el peor atraso de este (docs/reglas-cambio-de-nivel.md)
    closeLoanHistory(db, loan, t);
  }
  fundWaitingLoans(db, loan.level);
  return { loan, receipt: { txId, reference, at: t, amount, applied, toKey: VAULT_BREB.key, fromKey: opts.fromKey } };
}

export function loanView(db: DB, loan: Loan) {
  const t = now(db);
  const active = loan.status === "activo";
  // En mora: alguna cuota sin pagar pasó los 3 días de la solicitud de pago. Atraso contado desde el vencimiento
  const overdue = active && loan.schedule.some((i) => installmentState(i, t) === "EN_MORA");
  const next = loan.schedule.find((i) => !i.paidAt);
  const daysLate = active ? currentArrears(loan, t) : 0;
  // Solicitud de pago (simulada): la cuota impaga más antigua que ya venció, con su plazo de 3 días
  const requested = active ? loan.schedule.find((i) => !i.paidAt && i.dueAt <= t) : undefined;
  const paymentRequest = requested
    ? { n: requested.n, amount: installmentDue(requested), deadline: payDeadline(requested), state: installmentState(requested, t), daysLate: daysLate }
    : null;
  const schedule = loan.schedule.map((i) => ({ ...i, state: installmentState(i, t), daysLate: i.paidAt || i.dueAt <= t ? lateDays(i, t) : 0, deadline: payDeadline(i) }));
  /** Días que faltan para la próxima cuota (negativo si ya venció) */
  const daysToNext = loan.status === "activo" && next ? Math.ceil((next.dueAt - t) / DAY_MS) : null;
  const owed = loan.schedule.reduce((s, i) => s + installmentDue(i), 0);
  // Movimiento del desembolso, para su comprobante en PDF (los anteriores se reconocen por el id del payout)
  const disbursementTxId = db.txs.find((x) => x.kind === "desembolso_breb" && (x.loanId === loan.id || (loan.payout && x.detail.includes(loan.payout.id))))?.id ?? null;
  return {
    ...loan,
    schedule,
    disbursementTxId,
    now: t,
    overdue,
    daysLate,
    daysToNext,
    nextInstallment: next ?? null,
    nextDue: next ? installmentDue(next) : 0,
    owed,
    paymentRequest,
    levelOutlook: loan.status === "activo" || loan.status === "pagado" ? levelOutlook(db, loan) : null,
  };
}
