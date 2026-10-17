import { audit, ownerActor, SYSTEM, type AuditEvent } from "./audit";
import "server-only";
import { LEVELS, type Level } from "./config";
import { type DB, newId, now, type RecurringInvestment, type TxReceipt, withDB } from "./db";
import { cop } from "./finance";
import { chargeRecurring, PaymentError, RecurringGrantError, revokeRecurringGrant, vaultUrl } from "./openpayments";
import { addDuration, intervalLabel } from "./recurring-interval";
import { BusinessError, creditDeposit } from "./services";

// Inversiones recurrentes: la misma inversión en la misma cajita cada intervalo (por defecto, cada mes).
// - Interledger: el inversionista aprobó un permiso con intervalo; aquí se cobra con ese permiso en hora real
//   (el servidor de autorización de la wallet controla el intervalo, así que adelantar el reloj de la demo no cobra antes).
// - Simulado: se repite el monto en pesos según el reloj de la demo (adelantarlo genera los cobros).
// Los cobros vencidos se procesan cuando alguien abre /invertir o /boveda (no hay un proceso de fondo).

/** Margen después del inicio de cada intervalo, por diferencias de reloj con el servidor de la wallet */
const SAFETY_MS = 60_000;
/** Tras un fallo temporal (por ejemplo, sin saldo), cuándo se vuelve a intentar */
const RETRY_MS = 30 * 60_000;
/** Si un cobro quedó marcado "en curso" más de esto, se considera abandonado */
const STALE_RUN_MS = 5 * 60_000;
/** Modo simulado: máximo de cobros atrasados que se ponen al día de una vez (al adelantar el reloj un año, 12) */
const MAX_CATCH_UP = 24;

const subs = (db: DB) => (db.recurring ??= []);
const clockOf = (db: DB, s: RecurringInvestment) => (s.mode === "interledger" ? Date.now() : now(db));

/** Fecha del cobro número `run + 1` (el primero, run = 0, fue al invertir) */
const nextRun = (s: Pick<RecurringInvestment, "start" | "interval" | "mode">, runs: number) =>
  addDuration(s.start, s.interval, runs) + (s.mode === "interledger" ? SAFETY_MS : 0);

/** Crea la suscripción después del primer aporte. Devuelve su id */
export function createRecurring(
  db: DB,
  opts: Pick<RecurringInvestment, "wallet" | "level" | "mode" | "amountCop" | "interval" | "debitAmount" | "grant"> & { start: number },
) {
  const sub: RecurringInvestment = {
    id: newId(),
    ...opts,
    status: "activa",
    runs: 1,
    nextRunAt: 0,
    createdAt: now(db),
    lastRunAt: opts.mode === "interledger" ? Date.now() : now(db),
  };
  sub.nextRunAt = nextRun(sub, 1);
  subs(db).push(sub);
  audit(db, {
    category: "inversion",
    action: "recurrente_creada",
    actor: ownerActor(db, { wallet: opts.wallet }),
    entity: { type: "recurrente", id: sub.id },
    summary: `Activó una inversión recurrente de ${opts.debitAmount ? `${Number(opts.debitAmount.value) / 10 ** opts.debitAmount.assetScale} ${opts.debitAmount.assetCode}` : cop(opts.amountCop)} ${intervalLabel(opts.interval)} en ${LEVELS[opts.level].name}`,
    data: { nivel: opts.level, modo: opts.mode, intervalo: opts.interval },
  });
  return sub.id;
}

/** Datos del cobro para el comprobante del aporte */
export const recurringReceipt = (s: RecurringInvestment, run: number): TxReceipt["recurring"] => ({ id: s.id, run, interval: s.interval });

/** Lo que ve el inversionista (sin tokens) */
export function recurringView(db: DB, wallet: string) {
  return subs(db)
    .filter((s) => s.wallet === wallet && s.status !== "cancelada")
    .map((s) => ({
      id: s.id,
      level: s.level,
      mode: s.mode,
      amountCop: s.amountCop,
      debit: s.debitAmount ? { value: Number(s.debitAmount.value) / 10 ** s.debitAmount.assetScale, assetCode: s.debitAmount.assetCode } : null,
      interval: s.interval,
      intervalLabel: intervalLabel(s.interval),
      status: s.status,
      runs: s.runs,
      /** En la hora de la demo, para mostrarla igual que el resto de fechas */
      nextRunAt: s.status === "activa" ? s.nextRunAt - (s.mode === "interledger" ? Date.now() - now(db) : 0) : null,
      lastError: s.lastError ?? null,
    }));
}

/** El inversionista cancela: se revoca el permiso en su wallet y no se cobra más */
export async function cancelRecurring(wallet: string | null, id: string, actor?: AuditEvent["actor"], reason?: string) {
  const sub = await withDB((db) => {
    // wallet null: la cancela el operador (cualquier inversionista)
    const s = subs(db).find((x) => x.id === id && (wallet === null || x.wallet === wallet) && x.status !== "cancelada");
    if (!s) throw new BusinessError("No encontramos esa inversión recurrente");
    s.status = "cancelada";
    s.canceledAt = now(db);
    audit(db, {
      category: "inversion",
      action: wallet === null ? "recurrente_cancelada_por_operador" : "recurrente_cancelada",
      actor: actor ?? ownerActor(db, { wallet: s.wallet }),
      entity: { type: "recurrente", id: s.id },
      summary: `Canceló la inversión recurrente en ${LEVELS[s.level].name} y se revocó el permiso${reason ? ` · motivo: ${reason}` : ""}`,
      data: { cobrosHechos: s.runs },
    });
    const copy = { ...s };
    delete s.grant; // el token ya no se necesita
    return copy;
  });
  if (sub.mode === "interledger") await revokeRecurringGrant(sub);
}

let running = false;

/** Cobra las inversiones recurrentes vencidas. Seguro de llamar seguido: solo actúa sobre las que tocan */
export async function processRecurring() {
  if (running) return;
  running = true;
  try {
    // Simulado: todo dentro de la base, según el reloj de la demo
    await withDB((db) => {
      for (const s of subs(db)) {
        if (s.status !== "activa" || s.mode !== "simulado") continue;
        for (let i = 0; i < MAX_CATCH_UP && s.nextRunAt <= now(db); i++) {
          const txId = creditDeposit(db, s.wallet, s.level, s.amountCop, "simulado");
          const tx = db.txs.find((t) => t.id === txId);
          s.runs += 1;
          if (tx?.receipt) tx.receipt.recurring = recurringReceipt(s, s.runs);
          s.lastRunAt = s.nextRunAt;
          s.nextRunAt = nextRun(s, s.runs);
        }
      }
    });

    // Interledger: se marcan "en curso" antes de cobrar, para no cobrar dos veces
    const due = await withDB((db) =>
      subs(db)
        .filter(
          (s) =>
            s.status === "activa" &&
            s.mode === "interledger" &&
            s.nextRunAt <= clockOf(db, s) &&
            (!s.retryAt || s.retryAt <= Date.now()) &&
            (!s.runningSince || s.runningSince < Date.now() - STALE_RUN_MS),
        )
        .map((s) => {
          s.runningSince = Date.now();
          return { ...s };
        }),
    );
    for (const s of due) await chargeOne(s);
  } finally {
    running = false;
  }
}

async function chargeOne(s: RecurringInvestment) {
  try {
    const charged = await chargeRecurring(s);
    await withDB((db) => {
      const sub = subs(db).find((x) => x.id === s.id);
      if (!sub) return;
      sub.grant = charged.grant;
      delete sub.runningSince;
      delete sub.retryAt;
      delete sub.lastError;
      sub.runs += 1;
      sub.lastRunAt = Date.now();
      sub.nextRunAt = nextRun(sub, sub.runs);
      if (charged.amountCop < 1) return;
      const txId = creditDeposit(db, sub.wallet, sub.level, charged.amountCop, "interledger", { partial: true });
      const tx = db.txs.find((t) => t.id === txId);
      if (tx?.receipt)
        Object.assign(tx.receipt, {
          vaultWallet: vaultUrl(),
          requestedCop: charged.amountCop,
          quote: charged.quote,
          confirmation: charged.confirmation,
          recurring: recurringReceipt(sub, sub.runs),
        });
    });
  } catch (err) {
    const message = err instanceof PaymentError ? err.message : "No pudimos hacer el cobro de este periodo. Lo intentaremos de nuevo.";
    if (!(err instanceof PaymentError)) console.error("Cobro recurrente", s.id, err);
    await withDB((db) => {
      const sub = subs(db).find((x) => x.id === s.id);
      if (!sub) return;
      delete sub.runningSince;
      sub.lastError = message;
      // Sin permiso válido no tiene sentido reintentar: queda pausada hasta que el inversionista la active de nuevo
      if (err instanceof RecurringGrantError) sub.status = "pausada";
      else sub.retryAt = Date.now() + RETRY_MS;
      audit(db, {
        category: "inversion",
        action: err instanceof RecurringGrantError ? "recurrente_pausada" : "cobro_recurrente_fallido",
        actor: SYSTEM,
        entity: { type: "recurrente", id: sub.id },
        summary: `Cobro recurrente no realizado: ${message}`,
      });
    });
  }
}

/** Texto para notificaciones: "$ 1.000.000 cada mes en Nivel 2" */
export const recurringSummary = (s: { amountCop: number; interval: string; level: Level }) =>
  `${cop(s.amountCop)} ${intervalLabel(s.interval)} en ${LEVELS[s.level].name}`;
