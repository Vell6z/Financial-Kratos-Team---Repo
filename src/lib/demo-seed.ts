import { DAY_MS, investmentTermDays, LEVELS, type Level } from "./config";
import type { DB, Lot, Position, Tx } from "./db";
import { accrue } from "./finance";

// Inversiones precargadas para la cuenta demo de inversionista: aportes de distintas fechas para que
// en el pitch se vea el interés acumulado, aportes ya vencidos y otros todavía en plazo.
// Se crean una vez por versión (db.demoSeeded) y solo si la cuenta demo no tiene inversiones propias.
// Cada aporte dura un año (INVESTMENT_TERM_DAYS en config.ts).

const DEMO_INVESTOR_ID = "demo-inv";

/** Súbanla si cambian los aportes de abajo: la demo anterior se reemplaza al cargar la base */
const SEED_VERSION = 2;

const DEMO_LOTS: { level: Level; daysAgo: number; amount: number }[] = [
  { level: 1, daysAgo: 420, amount: 4_000_000 }, // vencido
  { level: 1, daysAgo: 60, amount: 2_500_000 }, // en plazo
  { level: 2, daysAgo: 385, amount: 3_000_000 }, // vencido
  { level: 2, daysAgo: 12, amount: 1_000_000 }, // en plazo
  { level: 3, daysAgo: 150, amount: 1_500_000 }, // en plazo, con un retiro anticipado
];

/** Retiros ya hechos: de qué aporte (índice en DEMO_LOTS), hace cuántos días y cuánto */
const DEMO_WITHDRAWALS: { lot: number; daysAgo: number; amount: number }[] = [{ lot: 4, daysAgo: 10, amount: 400_000 }];

const id = () => crypto.randomUUID().slice(0, 8);

/** Quita la demo de una versión anterior. Devuelve false si la cuenta demo tiene inversiones propias (no se toca nada) */
function removePreviousSeed(db: DB, wallet: string) {
  const demoTxs = db.txs.filter((x) => x.wallet === wallet && x.receipt?.demo);
  const demoLots = new Set(demoTxs.map((x) => x.receipt?.lotId).filter(Boolean));
  const positions = db.positions.filter((p) => p.wallet === wallet);
  const realTxs = db.txs.some((x) => x.wallet === wallet && (x.kind === "deposito_ilp" || x.kind === "retiro_ilp") && !x.receipt?.demo);
  if (realTxs || positions.some((p) => (p.lots ?? []).some((l) => !demoLots.has(l.id)))) return false;
  for (const x of demoTxs) db.pools[x.level].liquidity += x.kind === "deposito_ilp" ? -x.amountCop : x.amountCop;
  db.positions = db.positions.filter((p) => p.wallet !== wallet);
  db.txs = db.txs.filter((x) => !demoTxs.includes(x));
  return true;
}

/** Precarga las cajitas de la cuenta demo. `t`: la hora actual de la demo (now(db)) */
export function seedDemoInvestments(db: DB, t: number) {
  if (db.demoSeeded === SEED_VERSION) return;
  db.demoSeeded = SEED_VERSION;
  const wallet = db.users.find((u) => u.id === DEMO_INVESTOR_ID)?.wallet;
  // Si la cuenta demo ya invirtió de verdad, no se le agrega ni se le quita nada
  if (!wallet || !removePreviousSeed(db, wallet)) return;

  const txs: Tx[] = [];
  const lots = DEMO_LOTS.map(({ level, daysAgo, amount }) => {
    const at = t - daysAgo * DAY_MS;
    const lot: Lot = { id: id(), at, principal: amount, value: accrue(amount, LEVELS[level].investorRateEA, t - at), maturesAt: at + investmentTermDays(level) * DAY_MS, earlyWithdrawn: 0 };
    txs.push({
      id: id(),
      at,
      kind: "deposito_ilp",
      level,
      amountCop: amount,
      detail: `Aporte de demostración desde ${wallet}`,
      mode: "simulado",
      wallet,
      receipt: { investorWallet: wallet, requestedCop: amount, lotId: lot.id, maturesAt: lot.maturesAt, demo: true },
    });
    db.pools[level].liquidity += amount;
    return { level, lot };
  });

  const withdrawn: Partial<Record<Level, number>> = {};
  for (const w of DEMO_WITHDRAWALS) {
    const { level, lot } = lots[w.lot];
    const at = t - w.daysAgo * DAY_MS;
    const early = lot.maturesAt > at;
    // Lo retirado habría seguido rentando hasta hoy: se descuenta con su rendimiento
    lot.value -= accrue(w.amount, LEVELS[level].investorRateEA, t - at);
    if (early) lot.earlyWithdrawn += w.amount;
    withdrawn[level] = (withdrawn[level] ?? 0) + w.amount;
    db.pools[level].liquidity -= w.amount;
    txs.push({
      id: id(),
      at,
      kind: "retiro_ilp",
      level,
      amountCop: w.amount,
      detail: `Retiro de demostración hacia ${wallet}`,
      mode: "simulado",
      wallet,
      lots: [{ id: lot.id, amount: w.amount, early }],
      receipt: { investorWallet: wallet, requestedCop: w.amount, demo: true },
    });
  }

  for (const level of [...new Set(lots.map((l) => l.level))]) {
    const mine = lots.filter((l) => l.level === level).map((l) => l.lot);
    const position: Position = {
      id: id(),
      wallet,
      level,
      balance: mine.reduce((s, l) => s + l.value, 0),
      deposited: mine.reduce((s, l) => s + l.principal, 0),
      withdrawn: withdrawn[level] ?? 0,
      lastAccrualAt: t,
      lots: mine,
    };
    db.positions.push(position);
  }
  db.txs = [...db.txs, ...txs].sort((a, b) => b.at - a.at);
}
