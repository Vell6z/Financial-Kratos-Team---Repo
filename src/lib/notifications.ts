import "server-only";
import { DAY_MS, DELINQUENCY, LEVELS } from "./config";
import { DB, User, now } from "./db";
import { cop } from "./finance";
import { applicantLevel } from "./credit-history";
import { installmentDue, loanView } from "./services";

export interface Notification {
  id: string;
  tone: "info" | "success" | "warning" | "error";
  title: string;
  body: string;
  /** Momento del evento según el reloj de la demo */
  at: number;
  href?: string;
}

const dayMonth = (ms: number) => new Date(ms).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" });

/** Notificaciones del usuario, derivadas del estado actual (más recientes primero). */
export function notificationsFor(db: DB, user: User): Notification[] {
  const t = now(db);
  const list: Notification[] = [];

  if (user.faceVerification === "pendiente")
    list.push({
      id: "face",
      tone: "info",
      title: "Verificación de identidad en revisión",
      body: "Nuestro equipo está revisando tu verificación facial. Mientras tanto puedes usar la app, pero no pedir crédito ni invertir.",
      at: user.createdAt,
    });

  if (user.role === "acreditado") {
    const applicant = db.applicants.find((a) => a.cedula === user.cedula);
    if (!applicant)
      list.push({ id: "no-study", tone: "info", title: "Haz tu estudio de crédito", body: "Toma unos minutos y no necesitas historial bancario.", at: user.createdAt, href: "/estudio" });
    else if (!applicantLevel(db, applicant) && !db.loans.some((l) => l.cedula === user.cedula && l.status === "activo"))
      list.push({
        id: "rejected",
        tone: "warning",
        title: "Aún no eres apto para un crédito",
        body: applicant.retryAt
          ? `Podrás volver a solicitar desde el ${new Date(applicant.retryAt).toLocaleDateString("es-CO", { day: "numeric", month: "long" })}.`
          : "Revisa tu estudio para ver qué puede cambiar.",
        at: applicant.evaluatedAt,
        href: "/estudio",
      });

    for (const loan of db.loans.filter((l) => l.cedula === user.cedula).map((l) => loanView(db, l))) {
      if (loan.status === "en_espera")
        list.push({ id: `wait-${loan.id}`, tone: "info", title: "Crédito en espera de fondeo", body: `Tu crédito de ${cop(loan.amount)} se desembolsará cuando haya capital.`, at: loan.createdAt, href: "/mi-credito" });
      if (loan.disbursedAt)
        list.push({ id: `disb-${loan.id}`, tone: "success", title: "Crédito desembolsado", body: `Enviamos ${cop(loan.amount)} a tu llave Bre-B ${loan.llaveBreb}.`, at: loan.disbursedAt, href: "/mi-credito" });
      if (loan.status === "cancelado")
        list.push({
          id: `rej-${loan.id}`,
          tone: "error",
          title: "No pudimos desembolsar tu crédito",
          body: loan.disbursement?.rejectedReason ?? "Tu llave Bre-B no pasó la verificación.",
          at: loan.disbursement?.history.at(-1)?.at ?? loan.createdAt,
          href: "/mi-credito",
        });
      // Cuotas pagadas
      for (const i of loan.schedule.filter((x) => x.paidAt))
        list.push({
          id: `paid-${loan.id}-${i.n}`,
          tone: i.state === "PAGADA" ? "success" : "warning",
          title: i.state === "PAGADA" ? `Cuota ${i.n} pagada a tiempo` : `Cuota ${i.n} pagada con ${i.daysLate} días de atraso`,
          body: `Recibimos ${cop(i.payment)} por Bre-B.`,
          at: i.paidAt!,
          href: "/mi-credito",
        });
      // Solicitud de pago y mora de cada cuota sin pagar (área financiera, 17-oct-2026)
      for (const i of loan.schedule.filter((x) => !x.paidAt)) {
        const due = cop(installmentDue(i));
        const ddmm = dayMonth(i.dueAt);
        const day = (n: number) => i.dueAt + n * DAY_MS;
        const steps: Omit<Notification, "id">[] = [
          { tone: "info", title: `Tu cuota ${i.n} vence pronto`, body: `Tu cuota de ${due} vence el ${ddmm}.`, at: day(-2) },
          { tone: "warning", title: "Ya puedes pagar tu cuota", body: `Ya puedes pagar tu cuota de ${due}. Tienes hasta el ${dayMonth(i.deadline)}.`, at: day(0) },
          { tone: "warning", title: "Mañana es el último día", body: "Mañana es el último día para pagar tu cuota sin entrar en mora.", at: day(DELINQUENCY.daysToPay - 1) },
          { tone: "error", title: "Tu cuota está en mora", body: "Tu cuota está en mora. Págala lo antes posible para no bajar de nivel.", at: day(DELINQUENCY.daysToPay + 1) },
          ...DELINQUENCY.reminderDays.map((d) => ({
            tone: "error" as const,
            title: `Cuota con ${d} días de atraso`,
            body: `Tienes ${due} en mora de la cuota ${i.n}. Ponte al día para no bajar de nivel.`,
            at: day(d),
          })),
        ];
        steps.forEach((n, k) => list.push({ ...n, id: `inst-${loan.id}-${i.n}-${k}`, href: "/mi-credito" }));
      }
      // Aviso previo y reporte simulado a centrales de riesgo
      const r = loan.creditReport;
      if (r)
        list.push({
          id: `report-notice-${loan.id}`,
          tone: "error",
          title: "Aviso: reporte a centrales de riesgo",
          body: `Tienes una cuota con ${DELINQUENCY.reportNoticeDays} días de atraso. Si no te pones al día en los próximos ${DELINQUENCY.reportDays - DELINQUENCY.reportNoticeDays} días, tu deuda será reportada a las centrales de riesgo.`,
          at: r.noticeAt,
          href: "/mi-credito",
        });
      if (r?.reportedAt)
        list.push({
          id: `report-${loan.id}`,
          tone: "error",
          title: "Reporte a centrales de riesgo (simulado)",
          body:
            r.status === "pagada"
              ? "Tu reporte se actualizó a obligación pagada. El bloqueo de 12 meses se mantiene."
              : "Tu deuda fue reportada como en mora. Si pagas, el reporte se actualiza a obligación pagada.",
          at: r.paidAt ?? r.reportedAt,
          href: "/mi-credito",
        });
    }
  }

  if (user.role === "inversor" && user.wallet) {
    const positions = db.positions.filter((p) => p.wallet === user.wallet);
    if (positions.length === 0)
      list.push({ id: "no-invest", tone: "info", title: "Haz tu primera inversión", body: "Elige un nivel de riesgo y empieza a rentar.", at: user.createdAt, href: "/invertir" });
    for (const tx of db.txs.filter((x) => x.wallet === user.wallet)) {
      if (tx.kind === "deposito_ilp")
        list.push({
          id: `tx-${tx.id}`,
          tone: "success",
          title: (tx.receipt?.recurring?.run ?? 1) > 1 ? `Inversión recurrente: cobro ${tx.receipt!.recurring!.run}` : "Inversión recibida",
          body: `${cop(tx.amountCop)} en ${LEVELS[tx.level].name} por Interledger.`,
          at: tx.at,
          href: "/invertir",
        });
      if (tx.kind === "retiro_ilp")
        list.push({ id: `tx-${tx.id}`, tone: "success", title: "Retiro enviado", body: `${cop(tx.amountCop)} hacia tu wallet por Interledger.`, at: tx.at, href: "/invertir" });
    }
    for (const s of (db.recurring ?? []).filter((x) => x.wallet === user.wallet && x.status === "pausada"))
      list.push({
        id: `rec-paused-${s.id}`,
        tone: "warning",
        title: "Inversión recurrente pausada",
        body: s.lastError ?? "No pudimos cobrar con el permiso de tu wallet.",
        at: Math.min(t, s.lastRunAt ?? s.createdAt),
        href: "/invertir",
      });
    for (const p of positions) {
      const late = db.loans.filter((l) => l.level === p.level).map((l) => loanView(db, l)).filter((l) => l.overdue);
      if (late.length)
        list.push({
          id: `pool-late-${p.level}-${late.length}`,
          tone: "warning",
          title: `Mora en el pool ${LEVELS[p.level].name}`,
          body: "Hay créditos con cuotas vencidas en el nivel donde inviertes. El rendimiento real puede ser menor.",
          at: Math.min(...late.map((l) => l.nextInstallment?.dueAt ?? t)),
          href: "/invertir",
        });
    }
  }

  return list.filter((n) => n.at <= t).sort((a, b) => b.at - a.at).slice(0, 20);
}
