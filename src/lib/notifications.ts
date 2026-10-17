import "server-only";
import { DAY_MS, LEVELS } from "./config";
import { DB, User, now } from "./db";
import { cop } from "./finance";
import { effectiveLevel, loanView } from "./services";

export interface Notification {
  id: string;
  tone: "info" | "success" | "warning" | "error";
  title: string;
  body: string;
  /** Momento del evento según el reloj de la demo */
  at: number;
  href?: string;
}

/** Notificaciones del usuario, derivadas del estado actual (más recientes primero). */
export function notificationsFor(db: DB, user: User): Notification[] {
  const t = now(db);
  const list: Notification[] = [];

  if (user.faceVerification === "pendiente")
    list.push({
      id: "face",
      tone: "info",
      title: "Verificación facial pendiente",
      body: "Pronto te pediremos una selfie para completar tu verificación de identidad.",
      at: user.createdAt,
    });

  if (user.role === "acreditado") {
    const applicant = db.applicants.find((a) => a.cedula === user.cedula);
    if (!applicant)
      list.push({ id: "no-study", tone: "info", title: "Haz tu estudio de crédito", body: "Toma unos minutos y no necesitas historial bancario.", at: user.createdAt, href: "/estudio" });
    else if (!effectiveLevel(applicant.scoreLevel, applicant.paidOnTime))
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
      for (const i of loan.schedule.filter((x) => x.paidAt))
        list.push({ id: `paid-${loan.id}-${i.n}`, tone: "success", title: `Cuota ${i.n} pagada`, body: `Recibimos ${cop(i.payment)} por Bre-B.`, at: i.paidAt!, href: "/mi-credito" });
      const next = loan.nextInstallment;
      if (loan.overdue && next)
        list.push({
          id: `late-${loan.id}-${next.n}`,
          tone: "error",
          title: `Cuota vencida hace ${loan.daysLate} ${loan.daysLate === 1 ? "día" : "días"}`,
          body: `Paga ${cop(loan.nextDue ?? next.payment)} cuanto antes para no afectar tu nivel.`,
          at: next.dueAt,
          href: "/mi-credito",
        });
      else if (next && loan.daysToNext !== null && loan.daysToNext <= 3)
        list.push({
          id: `soon-${loan.id}-${next.n}`,
          tone: "warning",
          title: loan.daysToNext <= 0 ? "Tu cuota vence hoy" : `Tu cuota vence en ${loan.daysToNext} ${loan.daysToNext === 1 ? "día" : "días"}`,
          body: `${cop(loan.nextDue ?? next.payment)} de la cuota ${next.n}.`,
          at: next.dueAt - 3 * DAY_MS,
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
        list.push({ id: `tx-${tx.id}`, tone: "success", title: "Inversión recibida", body: `${cop(tx.amountCop)} en ${LEVELS[tx.level].name} por Interledger.`, at: tx.at, href: "/invertir" });
      if (tx.kind === "retiro_ilp")
        list.push({ id: `tx-${tx.id}`, tone: "success", title: "Retiro enviado", body: `${cop(tx.amountCop)} hacia tu wallet por Interledger.`, at: tx.at, href: "/invertir" });
    }
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
