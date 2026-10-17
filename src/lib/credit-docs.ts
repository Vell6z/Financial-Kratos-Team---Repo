import "server-only";
import { APP_NAME, APP_SLUG, INSTALLMENT_DAYS, LEVELS } from "./config";
import type { Loan, Tx } from "./db";
import { cop, periodRate } from "./finance";
import { COLORS, longDate, PdfDoc, shortDate } from "./pdf-doc";
import { installmentDue } from "./services";

// Documentos del crédito en PDF: el plan de pagos (con el estado de cada cuota) y el paz y salvo.

const pct = (v: number, decimals = 0) => `${(v * 100).toLocaleString("es-CO", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })} %`;

export const planFileName = (loan: Loan) => `${APP_SLUG}-plan-de-pagos-${loan.id}.pdf`;
export const releaseFileName = (loan: Loan) => `${APP_SLUG}-paz-y-salvo-${loan.id}.pdf`;

/** Plan de pagos. `now`: hora de la demo, para marcar cuotas vencidas */
export function buildPlanPdf(loan: Loan, now: number) {
  const draft = loan.status === "en_espera";
  const doc = new PdfDoc({ title: "Plan de pagos", number: `Crédito N.º ${loan.id}`, date: now }, now);
  const total = loan.schedule.reduce((s, i) => s + i.payment, 0);
  const interest = loan.schedule.reduce((s, i) => s + i.interest, 0);
  const owed = loan.schedule.reduce((s, i) => s + installmentDue(i), 0);
  const status =
    loan.status === "pagado"
      ? { label: "Pagado", color: COLORS.mint }
      : draft
        ? { label: "Por desembolsar", color: COLORS.amber }
        : loan.schedule.some((i) => !i.paidAt && i.dueAt < now)
          ? { label: "Con cuotas vencidas", color: COLORS.red }
          : { label: "Al día", color: COLORS.mint };
  doc.hero("Saldo por pagar", cop(owed), status);

  doc.section("Crédito");
  doc.row("Titular", loan.name);
  doc.row("Monto prestado", cop(loan.amount));
  doc.row("Nivel", `${LEVELS[loan.level].name} · ${LEVELS[loan.level].risk}`);
  doc.row("Tasa", `${pct(loan.rateEA)} efectiva anual · ${pct(periodRate(loan.rateEA, INSTALLMENT_DAYS), 2)} cada 15 días`);
  doc.row("Cuotas", `${loan.installments} cuotas fijas, una cada ${INSTALLMENT_DAYS} días (sistema francés)`);
  doc.row("Desembolso", loan.disbursedAt ? longDate(loan.disbursedAt) : "Pendiente");
  doc.row("Llave Bre-B para recibir", loan.llaveBreb);
  doc.row("Total a pagar", `${cop(total)} (${cop(interest)} de intereses)`, { bold: true });
  if (draft)
    doc.paragraph("Plan estimado: las fechas se cuentan desde el día del desembolso y se fijan cuando recibas el dinero.", { size: 9, color: COLORS.amber });

  doc.section("Cuotas");
  doc.table(
    [
      { label: "#", width: 0.5 },
      { label: "Vence", width: 1.6 },
      { label: "Cuota", width: 1.6, align: "right" },
      { label: "Interés", width: 1.4, align: "right" },
      { label: "Capital", width: 1.6, align: "right" },
      { label: "Saldo", width: 1.6, align: "right" },
      { label: "Estado", width: 2.4, align: "right" },
    ],
    loan.schedule.map((i) => {
      const paidPart = i.paidAmount ?? 0;
      const [label, color] = i.paidAt
        ? i.paidAt <= i.dueAt
          ? [`Pagada · ${shortDate(i.paidAt, false)}`, COLORS.mint]
          : [`Tarde · ${shortDate(i.paidAt, false)}`, COLORS.amber]
        : paidPart > 0
          ? [`Abonado ${cop(paidPart)}`, i.dueAt < now ? COLORS.red : COLORS.amber]
          : !draft && i.dueAt < now
            ? ["Vencida", COLORS.red]
            : ["Pendiente", COLORS.muted];
      return {
        cells: [String(i.n), shortDate(i.dueAt), cop(i.payment), cop(i.interest), cop(i.principal), cop(i.balance), label],
        color: [undefined, undefined, undefined, undefined, undefined, undefined, color],
      };
    }),
  );
  doc.paragraph(
    `Tarde: pagada después de su fecha de vencimiento. Puedes pagar o abonar en cualquier momento por Bre-B a la llave de ${APP_NAME}. Los abonos se aplican primero a la cuota más antigua. ` +
      "Pagar todas las cuotas a tiempo te sube un nivel para tu próximo crédito.",
    { size: 9, color: COLORS.muted, gap: 24 },
  );
  return doc.build(`Plan de pagos ${loan.id} - ${APP_NAME}`);
}

/** Paz y salvo de un crédito pagado. `payments`: los pagos Bre-B de ese crédito */
export function buildReleasePdf(loan: Loan, holder: { name: string; cedula: string }, payments: Tx[], now: number) {
  const lastPaid = Math.max(...loan.schedule.map((i) => i.paidAt ?? 0));
  const onTime = loan.schedule.every((i) => (i.paidAt ?? 0) <= i.dueAt);
  const paid = payments.length ? payments.reduce((s, t) => s + t.amountCop, 0) : loan.schedule.reduce((s, i) => s + i.payment, 0);
  const doc = new PdfDoc({ title: "Paz y salvo", number: `Crédito N.º ${loan.id}`, date: lastPaid || now }, now);

  doc.paragraph("PAZ Y SALVO", { size: 18, bold: true, gap: 4 });
  doc.paragraph(
    `${APP_NAME} certifica que ${holder.name}, identificado(a) con cédula de ciudadanía ${holder.cedula}, pagó la totalidad del crédito ` +
      `N.º ${loan.id} por ${cop(loan.amount)}, desembolsado el ${loan.disbursedAt ? longDate(loan.disbursedAt, false) : "—"}. ` +
      `A la fecha no tiene saldos pendientes por este crédito.`,
    { size: 11, gap: 20 },
  );

  doc.section("Resumen del crédito");
  doc.row("Monto prestado", cop(loan.amount));
  doc.row("Tasa", `${pct(loan.rateEA)} efectiva anual`);
  doc.row("Cuotas", `${loan.installments}, una cada ${INSTALLMENT_DAYS} días`);
  doc.row("Total pagado", cop(paid), { bold: true });
  doc.row("Último pago", lastPaid ? longDate(lastPaid) : "—");
  doc.row("Comportamiento", onTime ? "Todas las cuotas pagadas a tiempo" : "Pagado, con al menos una cuota fuera de plazo", {
    color: onTime ? COLORS.mint : COLORS.amber,
  });

  doc.paragraph(`Se expide a solicitud del titular el ${longDate(now, false)}.`, { size: 10, gap: 28 });
  doc.signature(APP_NAME, "Plataforma de crédito · documento generado automáticamente");
  return doc.build(`Paz y salvo ${loan.id} - ${APP_NAME}`);
}
