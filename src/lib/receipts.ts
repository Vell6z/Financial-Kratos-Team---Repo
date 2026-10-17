import "server-only";
import { EARLY_WITHDRAWAL_SHARE, LEVELS } from "./config";
import type { Tx } from "./db";
import { cop } from "./finance";
import { A4, buildPdf, hex, PdfPage, wrap } from "./pdf";

// Comprobante en PDF de una inversión o un retiro: monto, cajita, cotización usada
// y lo que confirmó por Interledger la wallet que recibió.

const BRAND = hex("#80409d");
const MINT = hex("#1e9c80");
const AMBER = hex("#b7791f");
const MUTED = hex("#6b6478");
const LINE = hex("#e4dcea");
const WHITE = hex("#ffffff");

const FX_SOURCE = { mercado: "tasa de mercado", manual: "tasa fija del equipo", respaldo: "tasa de respaldo (sin conexión)" } as const;

const date = (ms: number, withTime = true) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(ms);

/** 1234.5678 USD → "1.234,57 USD" */
const money = (a: { value: number; assetCode: string }, decimals = 2) =>
  `${a.value.toLocaleString("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${a.assetCode}`;

const rate = (v: number) => v.toLocaleString("es-CO", { maximumFractionDigits: v >= 100 ? 2 : 6 });

export function receiptFileName(tx: Tx) {
  return `kratos-${tx.kind === "deposito_ilp" ? "inversion" : "retiro"}-${tx.id}.pdf`;
}

/** Arma el PDF del comprobante. `now`: hora de la demo, para la fecha de generación */
export function buildReceiptPdf(tx: Tx, now: number) {
  const deposit = tx.kind === "deposito_ilp";
  const r = tx.receipt;
  const q = r?.quote;
  const c = r?.confirmation ?? null;
  const level = LEVELS[tx.level];
  const page = new PdfPage();
  const M = 48;
  const W = A4.width - 2 * M;

  // Encabezado
  page.rect(0, 0, A4.width, 96, BRAND);
  page.text(M, 44, "Kratos", { size: 22, bold: true, color: WHITE });
  page.text(M, 66, deposit ? "Comprobante de inversión" : "Comprobante de retiro", { size: 12, color: WHITE });
  page.text(A4.width - M, 44, `N.º ${tx.id}`, { size: 10, bold: true, color: WHITE, align: "right" });
  page.text(A4.width - M, 62, date(tx.at), { size: 9, color: WHITE, align: "right" });
  let y = 140;

  // Monto principal
  page.text(M, y, deposit ? "Abonado a tu cajita" : "Retirado de tu cajita", { size: 10, color: MUTED });
  y += 30;
  page.text(M, y, cop(tx.amountCop), { size: 26, bold: true });
  const status = r?.demo
    ? { label: "Movimiento de demostración", color: MUTED }
    : tx.mode === "simulado"
      ? { label: "Simulado", color: MUTED }
      : !c
        ? { label: "Completado", color: MINT }
        : c.full
          ? { label: "Confirmado por quien recibe", color: MINT }
          : c.inProgress
            ? { label: "En curso", color: AMBER }
            : { label: "Llegó una parte", color: AMBER };
  page.text(A4.width - M, y - 8, status.label, { size: 10, bold: true, color: status.color, align: "right" });
  y += 14;
  if (r && r.requestedCop !== tx.amountCop)
    page.text(M, (y += 12), `Pediste ${cop(r.requestedCop)}; ${deposit ? "se abonó" : "se descontó"} lo que confirmó la wallet que recibe.`, { size: 9, color: AMBER });
  y += 18;

  const section = (title: string) => {
    y += 30;
    page.text(M, y, title.toUpperCase(), { size: 8, bold: true, color: BRAND });
    y += 8;
    page.line(M, y, M + W, y, LINE);
    y += 4;
  };
  const row = (label: string, value: string, opts: { small?: boolean } = {}) => {
    const size = opts.small ? 7.5 : 10;
    const lines = wrap(value, W * 0.62, size);
    y += 16;
    page.text(M, y, label, { size: 9, color: MUTED });
    lines.forEach((l, i) => page.text(M + W, y + i * (size + 3), l, { size, align: "right" }));
    y += (lines.length - 1) * (size + 3);
  };

  section("Detalle");
  row("Cajita", `${level.name} · ${level.risk} · ${(level.rateEA * 100).toFixed(0)} % EA`);
  row(deposit ? "Desde tu wallet" : "Hacia tu wallet", r?.investorWallet ?? tx.wallet ?? "—", { small: true });
  if (r?.vaultWallet) row(deposit ? "Hacia la bóveda" : "Desde la bóveda", r.vaultWallet, { small: true });
  row("Medio", r?.demo ? "Precargado para la demo (sin Interledger)" : tx.mode === "interledger" ? "Interledger · Open Payments (red de prueba)" : "Simulado (sin Open Payments)");
  if (deposit && r?.maturesAt) {
    row("Plazo del aporte", `Hasta el ${date(r.maturesAt, false)}`);
    row("Antes del plazo", `Puedes retirar hasta el ${EARLY_WITHDRAWAL_SHARE * 100} % de este aporte`);
  }
  if (!deposit && tx.lots?.length) {
    const early = tx.lots.filter((l) => l.early).reduce((s, l) => s + l.amount, 0);
    const matured = tx.lots.filter((l) => !l.early).reduce((s, l) => s + l.amount, 0);
    if (matured >= 1) row("De aportes vencidos", cop(matured));
    if (early >= 1) row("De aportes en plazo (retiro anticipado)", cop(early));
  }

  if (q) {
    section("Cotización");
    row("Monto en pesos", cop(q.amountCop));
    row("Tasa usada", `1 ${q.vaultAsset} = ${rate(q.copPerUnit)} COP · ${FX_SOURCE[q.fxSource]}`);
    if (q.fxUpdatedAt) row("Tasa actualizada", date(Date.parse(q.fxUpdatedAt)));
    row(deposit ? "Debitado de tu wallet" : "Debitado de la bóveda", money(q.debit));
    row(deposit ? "Recibe la bóveda" : "Recibes en tu wallet", money(q.receive));
    if (q.debit.assetCode !== q.receive.assetCode && q.debit.value > 0)
      row("Tasa de Interledger", `1 ${q.debit.assetCode} = ${rate(q.receive.value / q.debit.value)} ${q.receive.assetCode}`);
    row("Comisión", "Incluida en la cotización");
  }

  if (c) {
    section("Confirmación de Interledger");
    row("Esperado por quien recibe", money(c.expected));
    row("Recibido (confirmado)", money(c.received));
    row("Cobro cerrado", c.closed ? "Sí: ya no acepta más pagos" : c.inProgress ? "No: el pago seguía en curso" : "No");
    row("Incoming payment", c.incomingPaymentId, { small: true });
    row("Outgoing payment", c.outgoingPaymentId, { small: true });
    row("Confirmado el", date(c.confirmedAt));
  } else if (tx.mode === "interledger" && !r?.demo) {
    y += 16;
    page.text(M, y, "Pago anterior a la confirmación del cobro: no tiene datos de la wallet que recibe.", { size: 9, color: MUTED });
  }

  // Pie
  const foot = A4.height - 60;
  page.line(M, foot, M + W, foot, LINE);
  wrap(
    "Kratos es un MVP de hackathon: todo corre en la red de prueba de Interledger y no representa dinero real. " +
      `Comprobante generado el ${date(now)}`,
    W,
    8,
  ).forEach((l, i) => page.text(M, foot + 16 + i * 11, l, { size: 8, color: MUTED }));

  return buildPdf([page], { title: `Comprobante ${tx.id} - Kratos` });
}
