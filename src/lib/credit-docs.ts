import "server-only";
import { APP_NAME, APP_SLUG, INSTALLMENT_DAYS, LEVELS } from "./config";
import { applicantLevel, creditScore, currentArrears, SCORE_BANDS, SCORE_MAX, SCORE_MIN, worstDelay } from "./credit-history";
import type { DB, Loan, Tx } from "./db";
import { cop, periodRate } from "./finance";
import { hex, type PdfPage } from "./pdf";
import { COLORS, longDate, PdfDoc, shortDate } from "./pdf-doc";
import { installmentDue } from "./services";

// Documentos del crédito en PDF: el plan de pagos (con el estado de cada cuota), el paz y salvo
// y el certificado de historial crediticio (lo solicita el titular desde /mi-credito).

const pct = (v: number, decimals = 0) => `${(v * 100).toLocaleString("es-CO", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })} %`;

export const planFileName = (loan: Loan) => `${APP_SLUG}-plan-de-pagos-${loan.id}.pdf`;
export const releaseFileName = (loan: Loan) => `${APP_SLUG}-paz-y-salvo-${loan.id}.pdf`;
export const historyFileName = (cedula: string) => `${APP_SLUG}-certificado-historial-${cedula}.pdf`;

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

const LOAN_STATUS: Record<Loan["status"], string> = { en_espera: "Por desembolsar", activo: "Vigente", pagado: "Pagado", cancelado: "No desembolsado" };

/**
 * Certificado de historial crediticio: nivel actual y de dónde sale (estudio o historial de pagos),
 * créditos con su comportamiento de pago y reportes (simulados) a centrales de riesgo.
 * Solo datos de las obligaciones del titular: sin referencias, documentos ni respuestas del estudio.
 */
export function buildHistoryCertificatePdf(db: DB, cedula: string, now: number) {
  const a = db.applicants.find((x) => x.cedula === cedula);
  if (!a) throw new Error("Sin estudio de crédito");
  const user = db.users.find((u) => u.cedula === cedula);
  const loans = db.loans.filter((l) => l.cedula === cedula && l.status !== "cancelado").sort((x, y) => x.createdAt - y.createdAt);
  const level = applicantLevel(db, a);
  const active = loans.find((l) => l.status === "activo");
  const arrears = active ? currentArrears(active, now) : 0;
  const blocked = a.blockedUntil && a.blockedUntil > now ? a.blockedUntil : null;
  const reports = loans.filter((l) => l.creditReport?.reportedAt);

  const doc = new PdfDoc({ title: "Certificado de historial crediticio", number: `CC ${cedula}`, date: now }, now);
  const result = creditScore(db, a, now);

  // Velocímetro del puntaje (300 a 850), como el de las centrales de riesgo
  doc.draw(250, (page, top, left, width) => drawScoreGauge(page, left + width / 2, top + 150, result.score));
  doc.paragraph(
    `${APP_NAME} certifica el historial de ${user?.name ?? a.name}, identificado(a) con cédula de ciudadanía ${cedula}, ` +
      `en los créditos otorgados por la plataforma, con corte al ${longDate(now, false)}. Su puntaje es ${result.score} de ${SCORE_MAX}: ${result.band.label.toLowerCase()}.`,
    { size: 10, gap: 4 },
  );
  if (result.capped)
    doc.paragraph(
      result.capped === "reporte"
        ? "Con un reporte en mora, el puntaje queda como máximo en 579 hasta que se pague la obligación."
        : "Mientras dure el bloqueo de 12 meses por mora de 90 días o más, el puntaje no sale del rango Malo.",
      { size: 9, color: COLORS.red },
    );

  doc.section("Cómo se calcula tu puntaje");
  doc.table(
    [
      { label: "Factor", width: 2 },
      { label: "Peso", width: 0.8, align: "right" },
      { label: "Qué se tuvo en cuenta", width: 4.2 },
      { label: "Puntos", width: 1, align: "right" },
    ],
    result.factors.map((f) => ({
      cells: [f.label, `${Math.round(f.weight * 100)} %`, f.detail, `+${f.points}`],
      color: [undefined, undefined, undefined, f.value >= 0.8 ? COLORS.mint : f.value >= 0.5 ? COLORS.amber : COLORS.red],
    })),
  );
  doc.paragraph(`Puntaje = ${SCORE_MIN} + puntos de los factores (máximo ${SCORE_MAX - SCORE_MIN}). Rangos: ${SCORE_BANDS.map((b) => `${b.label} ${b.min}–${b.max}`).join(" · ")}.`, {
    size: 8,
    color: COLORS.muted,
  });
  const tips = result.factors.filter((f) => f.tip);
  if (tips.length) {
    doc.section("Qué puedes hacer para subir tu puntaje");
    for (const f of tips) doc.paragraph(`• ${f.label}: ${f.tip}`, { size: 10, gap: 14 });
  }

  const status = blocked
    ? { label: "Bloqueado", color: COLORS.red }
    : !level
      ? { label: arrears > 30 ? "En mora" : "No apto por ahora", color: COLORS.red }
      : arrears > 3
        ? { label: "Con atraso", color: COLORS.amber }
        : { label: "Al día", color: COLORS.mint };
  doc.section("Calificación");
  doc.row("Nivel actual", level ? `${LEVELS[level].name} · ${LEVELS[level].risk} · tasa ${pct(LEVELS[level].rateEA)} E.A.` : "Nivel 4: no puede pedir crédito por ahora", {
    color: status.color,
  });
  doc.row("Estado", status.label, { color: status.color });
  doc.row("De dónde sale", a.historyLevel ? "Historial de pagos del último crédito" : "Estudio de crédito (aún no tiene créditos pagados)");
  doc.row("Puntaje del estudio", `${a.score}/100 · ${longDate(a.evaluatedAt, false)}`);
  if (a.lastLoanResult)
    doc.row(
      "Último crédito pagado",
      `Peor atraso ${a.lastLoanResult.worstDelay} ${a.lastLoanResult.worstDelay === 1 ? "día" : "días"} · pasó de ${LEVELS[a.lastLoanResult.from].name} a ${a.lastLoanResult.to === 4 ? "nivel 4" : LEVELS[a.lastLoanResult.to].name}`,
    );
  doc.row("Créditos pagados a tiempo", String(a.paidOnTime));
  if (blocked) doc.row("Bloqueado hasta", longDate(blocked, false), { color: COLORS.red });
  if (active) doc.row("Crédito vigente", arrears > 3 ? `Con ${arrears} días de atraso` : "Al día", { color: arrears > 3 ? COLORS.red : COLORS.mint });

  doc.section("Créditos");
  if (loans.length === 0) doc.paragraph("Todavía no tiene créditos con la plataforma.", { size: 9, color: COLORS.muted });
  else
    doc.table(
      [
        { label: "Crédito", width: 1.3 },
        { label: "Desembolso", width: 1.5 },
        { label: "Monto", width: 1.5, align: "right" },
        { label: "Cuotas", width: 0.9, align: "right" },
        { label: "Estado", width: 1.6, align: "right" },
        { label: "Peor atraso", width: 1.4, align: "right" },
      ],
      loans.map((l) => {
        const worst = l.disbursedAt ? worstDelay(l, now) : 0;
        const st = l.creditReport?.reportedAt ? "Castigado" : LOAN_STATUS[l.status];
        return {
          cells: [l.id, l.disbursedAt ? shortDate(l.disbursedAt) : "—", cop(l.amount), String(l.installments), st, l.disbursedAt ? `${worst} d` : "—"],
          color: [undefined, undefined, undefined, undefined, undefined, worst > 30 ? COLORS.red : worst > 3 ? COLORS.amber : COLORS.mint],
        };
      }),
    );

  doc.section("Reportes a centrales de riesgo");
  if (reports.length === 0) doc.paragraph("No tiene reportes negativos.", { size: 10, color: COLORS.mint });
  else
    for (const l of reports)
      doc.row(
        `Crédito ${l.id}`,
        `Reportado el ${longDate(l.creditReport!.reportedAt!, false)} · ${l.creditReport!.status === "pagada" ? "obligación pagada" : "en mora"} (simulado)`,
        { color: COLORS.red },
      );

  doc.paragraph(
    `El puntaje es interno de ${APP_NAME}, en la misma escala de 300 a 850 de las centrales para que se entienda fácil; no decide el nivel, lo explica. ` +
      `Este certificado refleja solo el comportamiento de pago con ${APP_NAME}; no es un reporte de una central de riesgo. ` +
      "Los reportes a centrales son simulados en esta demo: no se envía nada a ninguna central. " +
      `Se expide a solicitud del titular el ${longDate(now, false)}.`,
    { size: 9, color: COLORS.muted, gap: 24 },
  );
  doc.signature(APP_NAME, "Plataforma de crédito · documento generado automáticamente");
  return doc.build(`Certificado de historial ${cedula} - ${APP_NAME}`);
}

/**
 * Velocímetro del puntaje: cuatro rangos del mismo tamaño (Malo, Regular, Bueno, Excelente) y una aguja.
 * (cx, cy) es el centro del semicírculo, medido desde arriba de la página.
 */
function drawScoreGauge(page: PdfPage, cx: number, cy: number, score: number) {
  const outer = 128;
  const inner = 72;
  const per = 180 / SCORE_BANDS.length;
  const gap = 1.2; // grados de separación entre rangos
  const point = (r: number, deg: number): [number, number] => [cx + r * Math.cos((deg * Math.PI) / 180), cy - r * Math.sin((deg * Math.PI) / 180)];
  SCORE_BANDS.forEach((b, i) => {
    const from = 180 - i * per - (i === 0 ? 0 : gap / 2);
    const to = 180 - (i + 1) * per + (i === SCORE_BANDS.length - 1 ? 0 : gap / 2);
    const steps = 24;
    const arc = (r: number, a: number, z: number) => Array.from({ length: steps + 1 }, (_, k) => point(r, a + ((z - a) * k) / steps));
    page.polygon([...arc(outer, from, to), ...arc(inner, to, from)], hex(b.color));
    // Nombre y rango, tangentes al arco (como en el velocímetro de las centrales)
    const mid = (from + to) / 2;
    const r = (outer + inner) / 2;
    page.textRotated(...point(r + 9, mid), b.label, mid - 90, { size: 12, bold: true, color: COLORS.white });
    page.textRotated(...point(r - 9, mid), `${b.min} - ${b.max}`, mid - 90, { size: 11, bold: true, color: COLORS.white });
  });

  // Aguja: cada rango ocupa lo mismo, así que el ángulo se interpola dentro del rango del puntaje
  const i = Math.max(0, SCORE_BANDS.findIndex((b) => score <= b.max));
  const b = SCORE_BANDS[i];
  const frac = Math.min(1, Math.max(0, (score - b.min) / (b.max - b.min)));
  const angle = 180 - (i + frac) * per;
  const gray = hex("#6f6f74");
  const side = (deg: number) => point(10, deg);
  page.polygon([side(angle + 90), point(inner - 10, angle), side(angle - 90), point(6, angle + 180)], gray);
  page.circle(cx, cy, 14, gray);
  page.circle(cx, cy, 6, COLORS.white);

  // Puntaje debajo del centro
  const band = SCORE_BANDS[i];
  page.text(cx, cy + 46, String(score), { size: 30, bold: true, align: "center" });
  page.text(cx, cy + 64, `${band.label} · de ${SCORE_MAX}`, { size: 11, bold: true, align: "center", color: hex(band.color) });
}
