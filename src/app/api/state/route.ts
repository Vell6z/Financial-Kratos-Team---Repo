import { faceReviewRequired } from "@/lib/faceverify";
import { handle } from "@/lib/api";
import { verifyAuditChain } from "@/lib/audit";
import { requireAdmin, requireUser } from "@/lib/auth";
import { applicantLevel, creditScore } from "@/lib/credit-history";
import { now, withDB } from "@/lib/db";
import { demoDayLoaded } from "@/lib/demo-day-seed";
import { isInterledgerEnabled } from "@/lib/openpayments";
import { processPayouts } from "@/lib/payouts";
import { processRecurring, recurringView } from "@/lib/recurring";
import { hasReceipt } from "@/lib/receipts";
import { LEVELS } from "@/lib/config";
import { accrue } from "@/lib/finance";
import { loanView, withdrawable } from "@/lib/services";

/** Todo lo que ve el operador en /boveda. Nunca incluye contraseñas, tokens, descriptores faciales ni documentos */
export async function GET() {
  return handle(async () => {
    // Desembolsos pendientes y cobros recurrentes en segundo plano: no hacen esperar al panel
    void processPayouts().catch(() => {});
    void processRecurring();
    return withDB(async (db) => {
      requireAdmin(await requireUser(db));
      // Solo lectura: el interés de las cajitas se calcula al vuelo, sin reescribir la base en cada consulta
      // (con Supabase cada escritura viaja completa por la red)
      const t = now(db);
      const balance = (p: (typeof db.positions)[number]) => p.balance * accrue(1, LEVELS[p.level].investorRateEA, t - p.lastAccrualAt);
      const loans = db.loans.map((l) => loanView(db, l));
      const active = loans.filter((l) => l.status === "activo");
      const owed = (ls: typeof loans) => Math.round(ls.reduce((s, l) => s + l.owed, 0));
      const sum = (kind: string) => db.txs.filter((x) => x.kind === kind).reduce((s, x) => s + x.amountCop, 0);
      const audit = db.audit ?? [];

      return {
        now: t,
        clockOffsetDays: Math.round(db.clockOffsetMs / 86_400_000),
        demoDayLoaded: demoDayLoaded(db),
        interledger: isInterledgerEnabled(),
        // Permiso de retiros automáticos (sin el token)
        vaultGrant: db.vaultGrant
          ? {
              grantedAt: db.vaultGrant.grantedAt,
              assetCode: db.vaultGrant.limit.assetCode,
              limit: Number(db.vaultGrant.limit.value) / 10 ** db.vaultGrant.limit.assetScale,
              spent: Number(db.vaultGrant.spent) / 10 ** db.vaultGrant.limit.assetScale,
            }
          : null,
        pools: db.pools,
        investorBalance: db.positions.reduce((s, p) => s + balance(p), 0),
        // Indicadores de la cartera (en pesos)
        kpis: {
          portfolio: owed(active),
          overdue: owed(active.filter((l) => l.overdue)),
          par30: owed(active.filter((l) => l.daysLate > 30)),
          chargedOff: owed(active.filter((l) => l.chargedOffAt)),
          disbursed: sum("desembolso_breb"),
          collected: sum("pago_breb"),
          invested: sum("deposito_ilp"),
          withdrawn: sum("retiro_ilp"),
        },
        loans: loans.map((l) => ({
          id: l.id,
          name: l.name,
          cedula: l.cedula,
          level: l.level,
          amount: l.amount,
          installments: l.installments,
          status: l.status,
          purpose: l.purpose ?? null,
          createdAt: l.createdAt,
          disbursedAt: l.disbursedAt ?? null,
          owed: Math.round(l.owed),
          overdue: l.overdue,
          daysLate: l.daysLate,
          chargedOffAt: l.chargedOffAt ?? null,
          paidCount: l.schedule.filter((i) => i.paidAt).length,
          schedule: l.schedule.map((i) => ({ n: i.n, dueAt: i.dueAt, payment: i.payment, state: i.state, daysLate: i.daysLate, paidAt: i.paidAt ?? null })),
          disbursement: l.disbursement ? { state: l.disbursement.state, history: l.disbursement.history, rejectedReason: l.disbursement.rejectedReason ?? null } : null,
          payout: l.payout ? { id: l.payout.id, directory: l.payout.directory, bank: l.payout.beneficiary.financialEntity.name, key: l.payout.beneficiary.key } : null,
          creditReport: l.creditReport ?? null,
          disbursementTxId: l.disbursementTxId,
        })),
        // Usuarios (sin contraseñas, sesiones ni biometría)
        users: db.users.map((u) => {
          const a = db.applicants.find((x) => x.cedula === u.cedula);
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            cedula: u.cedula,
            role: u.role,
            createdAt: u.createdAt,
            faceVerification: u.faceVerification,
            suspended: u.suspended ?? null,
            wallet: u.wallet ?? null,
            study: a ? { score: a.score, level: applicantLevel(db, a), blockedUntil: a.blockedUntil ?? null, creditScore: creditScore(db, a, t).score } : null,
            loans: db.loans.filter((l) => l.cedula === u.cedula && u.role === "acreditado").length,
            balance: u.wallet ? Math.round(db.positions.filter((p) => p.wallet === u.wallet).reduce((s, p) => s + balance(p), 0)) : 0,
          };
        }),
        // Cajitas por inversionista y nivel
        positions: db.positions
          .filter((p) => p.balance >= 1)
          .map((p) => {
            const w = withdrawable(db, p);
            return {
              id: p.id,
              wallet: p.wallet,
              owner: db.users.find((u) => u.wallet === p.wallet)?.name ?? null,
              level: p.level,
              balance: Math.round(balance(p)),
              deposited: p.deposited,
              withdrawn: p.withdrawn,
              lots: w.lots.length,
              nextMaturity: w.nextMaturity,
            };
          }),
        recurring: [...new Set((db.recurring ?? []).map((s) => s.wallet))].flatMap((wallet) =>
          recurringView(db, wallet).map((r) => ({ ...r, wallet, owner: db.users.find((u) => u.wallet === wallet)?.name ?? null })),
        ),
        txs: db.txs.map((x) => ({ id: x.id, at: x.at, kind: x.kind, level: x.level, amountCop: x.amountCop, detail: x.detail, mode: x.mode, hasReceipt: hasReceipt(db, x) })),
        // Avisos y reportes SIMULADOS a centrales de riesgo (solo datos de la obligación)
        creditReports: db.loans
          .filter((l) => l.creditReport && l.creditReport.status !== "al_dia")
          .map((l) => ({ loanId: l.id, name: l.name, level: l.level, chargedOffAt: l.chargedOffAt ?? null, ...l.creditReport! })),
        // Cola de revisión de verificaciones faciales en zona gris (sin el descriptor biométrico)
        faceReviews: db.users
          .filter((u) => faceReviewRequired() && u.faceVerification === "pendiente" && u.faceCheck)
          .map((u) => ({
            id: u.id,
            name: u.name,
            cedula: u.cedula,
            at: u.faceCheck!.at,
            dedupDistance: u.faceCheck!.dedupDistance,
            dedupMatchCedula: u.faceCheck!.dedupMatchCedula ?? null,
            yawRange: u.faceCheck!.yawRange,
            mode: u.faceCheck!.mode,
            reason: u.faceCheck!.reviewReason ?? (u.faceCheck!.dedupDistance !== null ? "parecido" : "sin_camara"),
          })),
        // Bitácora: integridad de la cadena y últimos eventos (la lista completa en /api/admin/audit)
        audit: { total: audit.length, broken: verifyAuditChain(audit), latest: [...audit].sort((x, y) => y.at - x.at || y.seq - x.seq).slice(0, 8) },
      };
    });
  });
}
