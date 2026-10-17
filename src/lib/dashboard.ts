import "server-only";
import { requireUser } from "./auth";
import { LEVELS } from "./config";
import { withDB } from "./db";
import { applicantLevel } from "./credit-history";
import { accrueAll, loanView } from "./services";

/** Resumen de la pantalla de inicio según el rol de la sesión. */
export function getDashboard() {
  return withDB(async (db) => {
    const user = await requireUser(db);
    accrueAll(db);
    if (user.role === "inversor") {
      const positions = db.positions.filter((p) => p.wallet === user.wallet);
      const balance = positions.reduce((s, p) => s + p.balance, 0);
      const gains = positions.reduce((s, p) => s + p.balance - p.deposited + p.withdrawn, 0);
      return {
        role: "inversor" as const,
        firstName: user.firstName,
        wallet: user.wallet ?? null,
        balance,
        gains,
        positions: positions.map((p) => ({ level: p.level, balance: p.balance, rate: LEVELS[p.level].investorRateEA })),
      };
    }
    const applicant = db.applicants.find((a) => a.cedula === user.cedula);
    const loans = db.loans.filter((l) => l.cedula === user.cedula).map((l) => loanView(db, l));
    return {
      role: "acreditado" as const,
      firstName: user.firstName,
      llaveBreb: user.borrowerProfile?.llaveBreb ?? null,
      level: applicant ? applicantLevel(db, applicant) : null,
      evaluated: Boolean(applicant),
      score: applicant?.score ?? null,
      paidOnTime: applicant?.paidOnTime ?? 0,
      activeLoan: loans.find((l) => l.status !== "pagado" && l.status !== "cancelado") ?? null,
      paidLoans: loans.filter((l) => l.status === "pagado").length,
    };
  });
}
