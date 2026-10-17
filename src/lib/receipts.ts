import "server-only";
import { bankName, BREB_KEY_TYPES, type BrebKeyType } from "./breb-keys";
import { EARLY_WITHDRAWAL_SHARE, LEVELS } from "./config";
import { intervalLabel } from "./recurring-interval";
import type { DB, Loan, Tx } from "./db";
import { cop } from "./finance";
import { COLORS, longDate, PdfDoc } from "./pdf-doc";

// Comprobantes en PDF de cada movimiento:
// - inversión y retiro: monto, cajita, cotización usada y lo que confirmó la wallet que recibió;
// - desembolso: el payout Bre-B (simulado) y la re-verificación de la llave;
// - pago de cuota: la transferencia Bre-B y a qué cuotas se aplicó.

const FX_SOURCE = { mercado: "tasa de mercado", manual: "tasa fija del equipo", respaldo: "tasa de respaldo (sin conexión)" } as const;

const DIRECTORY = {
  production: "directorio Bre-B real (producción, solo lectura)",
  sandbox: "directorio Bre-B de pruebas (sandbox)",
  simulado: "verificación simulada",
} as const;

/** 1234.5678 USD → "1.234,57 USD" */
const money = (a: { value: number; assetCode: string }, decimals = 2) =>
  `${a.value.toLocaleString("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${a.assetCode}`;

const rate = (v: number) => v.toLocaleString("es-CO", { maximumFractionDigits: v >= 100 ? 2 : 6 });

const FILE: Record<Tx["kind"], string> = { deposito_ilp: "inversion", retiro_ilp: "retiro", desembolso_breb: "desembolso", pago_breb: "pago" };

export function receiptFileName(tx: Tx) {
  return `kratos-${FILE[tx.kind]}-${tx.id}.pdf`;
}

/**
 * Crédito de un desembolso o pago. Los movimientos anteriores a este cambio no guardaban el crédito:
 * el desembolso se reconoce por el id del payout y el pago, si la persona tiene un solo crédito de ese nivel.
 */
export function loanForTx(db: DB, tx: Tx): Loan | null {
  if (tx.loanId) return db.loans.find((l) => l.id === tx.loanId) ?? null;
  const mine = db.loans.filter((l) => l.cedula === tx.cedula && l.level === tx.level && l.payout);
  if (tx.kind === "desembolso_breb") return mine.find((l) => tx.detail.includes(l.payout!.id)) ?? null;
  return mine.length === 1 ? mine[0] : null;
}

/** ¿Este movimiento tiene comprobante? */
export const hasReceipt = (db: DB, tx: Tx) => tx.kind === "deposito_ilp" || tx.kind === "retiro_ilp" || Boolean(loanForTx(db, tx));

/** Arma el PDF del comprobante de un movimiento. `now`: hora de la demo, para la fecha de generación */
export function buildReceiptPdf(db: DB, tx: Tx, now: number) {
  if (tx.kind === "desembolso_breb" || tx.kind === "pago_breb") {
    const loan = loanForTx(db, tx);
    if (!loan) throw new Error("Movimiento sin crédito");
    return tx.kind === "desembolso_breb" ? disbursementPdf(tx, loan, now) : paymentPdf(tx, loan, now);
  }
  return investmentPdf(tx, now);
}

function investmentPdf(tx: Tx, now: number) {
  const deposit = tx.kind === "deposito_ilp";
  const r = tx.receipt;
  const q = r?.quote;
  const c = r?.confirmation ?? null;
  const level = LEVELS[tx.level];
  const doc = new PdfDoc({ title: deposit ? "Comprobante de inversión" : "Comprobante de retiro", number: `N.º ${tx.id}`, date: tx.at }, now);

  const status = r?.demo
    ? { label: "Movimiento de demostración", color: COLORS.muted }
    : tx.mode === "simulado"
      ? { label: "Simulado", color: COLORS.muted }
      : !c
        ? { label: "Completado", color: COLORS.mint }
        : c.full
          ? { label: "Confirmado por quien recibe", color: COLORS.mint }
          : c.inProgress
            ? { label: "En curso", color: COLORS.amber }
            : { label: "Llegó una parte", color: COLORS.amber };
  doc.hero(deposit ? "Abonado a tu cajita" : "Retirado de tu cajita", cop(tx.amountCop), status);
  if (r && r.requestedCop !== tx.amountCop)
    doc.paragraph(`Pediste ${cop(r.requestedCop)}; ${deposit ? "se abonó" : "se descontó"} lo que confirmó la wallet que recibe.`, { size: 9, color: COLORS.amber });

  doc.section("Detalle");
  doc.row("Cajita", `${level.name} · ${level.risk} · ${(level.rateEA * 100).toFixed(0)} % EA`);
  doc.row(deposit ? "Desde tu wallet" : "Hacia tu wallet", r?.investorWallet ?? tx.wallet ?? "—", { small: true });
  if (r?.vaultWallet) doc.row(deposit ? "Hacia la bóveda" : "Desde la bóveda", r.vaultWallet, { small: true });
  doc.row("Medio", r?.demo ? "Precargado para la demo (sin Interledger)" : tx.mode === "interledger" ? "Interledger · Open Payments (red de prueba)" : "Simulado (sin Open Payments)");
  if (r?.recurring) doc.row("Inversión recurrente", `Cobro ${r.recurring.run} · ${intervalLabel(r.recurring.interval)}`);
  if (deposit && r?.maturesAt) {
    doc.row("Plazo del aporte", `Hasta el ${longDate(r.maturesAt, false)}`);
    doc.row("Antes del plazo", `Puedes retirar como máximo el ${EARLY_WITHDRAWAL_SHARE * 100} % de este aporte`);
  }
  if (!deposit && tx.lots?.length) {
    const early = tx.lots.filter((l) => l.early).reduce((s, l) => s + l.amount, 0);
    const matured = tx.lots.filter((l) => !l.early).reduce((s, l) => s + l.amount, 0);
    if (matured >= 1) doc.row("De aportes vencidos", cop(matured));
    if (early >= 1) doc.row("De aportes en plazo (retiro anticipado)", cop(early));
  }

  if (q) {
    doc.section("Cotización");
    doc.row("Monto en pesos", cop(q.amountCop));
    doc.row("Tasa usada", `1 ${q.vaultAsset} = ${rate(q.copPerUnit)} COP · ${FX_SOURCE[q.fxSource]}`);
    if (q.fxUpdatedAt) doc.row("Tasa actualizada", longDate(Date.parse(q.fxUpdatedAt)));
    doc.row(deposit ? "Debitado de tu wallet" : "Debitado de la bóveda", money(q.debit));
    doc.row(deposit ? "Recibe la bóveda" : "Recibes en tu wallet", money(q.receive));
    if (q.debit.assetCode !== q.receive.assetCode && q.debit.value > 0)
      doc.row("Tasa de Interledger", `1 ${q.debit.assetCode} = ${rate(q.receive.value / q.debit.value)} ${q.receive.assetCode}`);
    doc.row("Comisión", "Incluida en la cotización");
  }

  if (c) {
    doc.section("Confirmación de Interledger");
    doc.row("Esperado por quien recibe", money(c.expected));
    doc.row("Recibido (confirmado)", money(c.received));
    doc.row("Cobro cerrado", c.closed ? "Sí: ya no acepta más pagos" : c.inProgress ? "No: el pago seguía en curso" : "No");
    doc.row("Incoming payment", c.incomingPaymentId, { small: true });
    doc.row("Outgoing payment", c.outgoingPaymentId, { small: true });
    doc.row("Confirmado el", longDate(c.confirmedAt));
  } else if (tx.mode === "interledger" && !r?.demo) {
    doc.paragraph("Pago anterior a la confirmación del cobro: no tiene datos de la wallet que recibe.", { size: 9, color: COLORS.muted, gap: 20 });
  }
  return doc.build(`Comprobante ${tx.id} - Kratos`);
}

function disbursementPdf(tx: Tx, loan: Loan, now: number) {
  const p = loan.payout;
  const doc = new PdfDoc({ title: "Comprobante de desembolso", number: `N.º ${tx.id}`, date: tx.at }, now);
  doc.hero("Desembolsado a tu llave Bre-B", cop(tx.amountCop), { label: "Payout simulado", color: COLORS.muted });

  doc.section("Crédito");
  doc.row("Titular", loan.name);
  doc.row("Crédito", `N.º ${loan.id} · ${LEVELS[loan.level].name} · ${(loan.rateEA * 100).toFixed(0)} % EA`);
  doc.row("Cuotas", `${loan.installments}, una cada 15 días desde el desembolso`);

  if (p) {
    const code = p.beneficiary.financialEntity.code;
    const bank = bankName(p.beneficiary.financialEntity.name);
    doc.section("Pago por Bre-B");
    doc.row("Llave", `${p.beneficiary.key} · ${BREB_KEY_TYPES[p.beneficiary.keyType as BrebKeyType] ?? p.beneficiary.keyType}`);
    doc.row("Titular de la llave", p.beneficiary.holderName);
    doc.row("Entidad", /^\d+$/.test(code) ? `${bank} (${code})` : bank);
    doc.row("Payout", p.id);
    doc.row("Referencia (evita pagar dos veces)", p.reference);
    doc.row("Llave re-verificada en", DIRECTORY[p.directory]);
    doc.row("Verificada el", longDate(p.checkedAt));
  }
  doc.paragraph(
    "Justo antes de pagar volvimos a consultar tu llave en el directorio Bre-B: seguía activa y con el mismo titular y banco que confirmaste. " +
      "El payout se armó tal como se le enviaría a Wompi, pero no se envió: no se movió dinero real.",
    { size: 9, color: COLORS.muted, gap: 24 },
  );
  return doc.build(`Desembolso ${tx.id} - Kratos`);
}

function paymentPdf(tx: Tx, loan: Loan, now: number) {
  const b = tx.breb;
  const doc = new PdfDoc({ title: "Comprobante de pago", number: b?.reference ?? `N.º ${tx.id}`, date: tx.at }, now);
  const paidOff = b ? b.owedAfter <= 0 : loan.status === "pagado";
  doc.hero("Pagaste por Bre-B", cop(tx.amountCop), paidOff ? { label: "Crédito pagado", color: COLORS.mint } : { label: "Recibido", color: COLORS.mint });

  doc.section("Transferencia");
  doc.row("De tu llave", b?.fromKey ?? loan.llaveBreb);
  if (b) doc.row("Para", `${b.toKey} · bóveda de Kratos`);
  doc.row("Fecha", longDate(tx.at));
  doc.row("Crédito", `N.º ${loan.id} · ${loan.name}`);

  if (b?.applied.length) {
    doc.section("Cómo se aplicó");
    doc.table(
      [
        { label: "Cuota", width: 1 },
        { label: "Vencía", width: 2 },
        { label: "Abonado", width: 2, align: "right" },
        { label: "Estado", width: 2, align: "right" },
      ],
      b.applied.map((a) => {
        const due = loan.schedule.find((i) => i.n === a.n)?.dueAt;
        return {
          cells: [String(a.n), due ? longDate(due, false) : "—", cop(a.amount), a.completed ? "Pagada" : "Abono parcial"],
          color: [undefined, undefined, undefined, a.completed ? COLORS.mint : COLORS.amber],
        };
      }),
    );
    doc.row("Saldo del crédito después de este pago", cop(b.owedAfter), { bold: true });
  }
  doc.paragraph("Transferencia simulada en el sandbox de Bre-B: no se movió dinero real.", { size: 9, color: COLORS.muted, gap: 24 });
  return doc.build(`Pago ${tx.id} - Kratos`);
}
