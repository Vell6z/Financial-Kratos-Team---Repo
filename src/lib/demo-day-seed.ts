import "server-only";
import { actorOf, audit, withSimulatedAuditClock } from "./audit";
import { DAY_MS, INSTALLMENT_DAYS, LEVELS, MIN_LOAN, VAULT_BREB, type Level } from "./config";
import { applicantLevel } from "./credit-history";
import type { BrebVerification, DB, User } from "./db";
import { newPasswordHash } from "./password";
import { DEFAULT_RECURRING_INTERVAL, addDuration } from "./recurring-interval";
import { createRecurring, recurringReceipt } from "./recurring";
import type { StudyAnswers } from "./scoring";
import { creditLimit } from "./scoring";
import { completeDisbursement, creditDeposit, debitWithdraw, installmentDue, receiveBrebPayment, requestLoan, saveStudy } from "./services";

// "Un día promedio" en La Bodeguita, para el pitch: inversionistas de varios países y acreditados en las
// situaciones típicas (al día, cuota por pagar hoy, mora corta, mora larga con aviso de reporte, crédito
// que se termina de pagar hoy, crédito nuevo desembolsado hoy y un estudio recién hecho).
// Todo pasa por los servicios reales (pools, comprobantes, mora, nivel y bitácora quedan coherentes):
// el reloj de la demo se mueve a cada momento de la historia y al final vuelve a hoy.
// Personas FICTICIAS (correos @demo.labodeguita.test): no son datos de personas reales.
// Se carga desde /boveda ("Cargar un día de demo") y al reiniciar la demo. Una sola vez por versión (db.demoDaySeeded).

export const DEMO_DAY_VERSION = 1;
const ID_PREFIX = "dia-";
const H = 3_600_000;

/** Respuestas base del estudio; cada acreditado cambia lo suyo */
const BASE: StudyAnswers = {
  confirmAdult: true,
  consent: true,
  sector: "tienda_barrio",
  dependents: "1",
  income: "1600000",
  expenses: "750000",
  debts: "100000",
  loanShark: "no",
  variability: "algo",
  activityAge: "gt2",
  utilities: "siempre",
  rent: "siempre",
  phonePlan: "semana",
  savingsGroup: "cumplo",
  creditPurchases: "aldia",
  housingAge: "gt2",
  workplace: "fijo",
  phoneOwner: "si",
  likert: [4, 5, 2, 3, 1, 4, 3, 4, 2, 4, 2],
  timePref: "mes",
  references: [
    { name: "Proveedor del barrio", phone: "3104567890", relation: "Proveedor", relationOther: "", notify: true },
    { name: "", phone: "", relation: "", relationOther: "", notify: false },
  ],
};

interface InvestorSpec {
  key: string;
  first: string;
  last: string;
  nationality: string;
  address: string;
  currency: string;
  daysAgo: number;
}
const INVESTORS: InvestorSpec[] = [
  { key: "lukas", first: "Lukas", last: "Schmidt", nationality: "Alemana", address: "Berlín, Alemania", currency: "EUR", daysAgo: 240 },
  { key: "sarah", first: "Sarah", last: "Johnson", nationality: "Estadounidense", address: "Denver, Colorado, EE. UU.", currency: "USD", daysAgo: 95 },
  { key: "valentina", first: "Valentina", last: "Gómez", nationality: "Colombiana (vive en España)", address: "Madrid, España", currency: "EUR", daysAgo: 150 },
  { key: "hiroshi", first: "Hiroshi", last: "Tanaka", nationality: "Japonesa", address: "Osaka, Japón", currency: "USD", daysAgo: 16 },
];

interface BorrowerSpec {
  key: string;
  first: string;
  last: string;
  cedula: string;
  age: number;
  sex: string;
  city: string;
  daysAgo: number;
  answers: Partial<StudyAnswers>;
  key_breb: { key: string; keyType: BrebVerification["keyType"]; bank: string };
}
const BORROWERS: BorrowerSpec[] = [
  { key: "marta", first: "Marta Lucía", last: "Rojas", cedula: "9000000101", age: 46, sex: "Femenino", city: "Medellín", daysAgo: 210, answers: { sector: "tienda_barrio", income: "1900000", expenses: "800000" }, key_breb: { key: "3009000101", keyType: "PHONE", bank: "NEQUI" } },
  { key: "jhon", first: "Jhon Fredy", last: "Castaño", cedula: "9000000102", age: 34, sex: "Masculino", city: "Bogotá", daysAgo: 45, answers: { sector: "venta_ambulante", income: "1500000", expenses: "700000", variability: "mucho" }, key_breb: { key: "@jhonfredyc", keyType: "ALPHANUMERIC", bank: "DAVIPLATA" } },
  { key: "yeimi", first: "Yeimi Andrea", last: "Mosquera", cedula: "9000000103", age: 29, sex: "Femenino", city: "Cali", daysAgo: 40, answers: { sector: "belleza", income: "1700000", expenses: "820000", dependents: "2" }, key_breb: { key: "3009000103", keyType: "PHONE", bank: "NEQUI" } },
  { key: "luis", first: "Luis Alberto", last: "Pérez", cedula: "9000000104", age: 38, sex: "Masculino", city: "Barranquilla", daysAgo: 80, answers: { sector: "transporte_moto", income: "1800000", expenses: "900000", debts: "150000" }, key_breb: { key: "9000000104", keyType: "IDENTIFICATION", bank: "BANCOLOMBIA" } },
  { key: "diego", first: "Diego Armando", last: "Ruiz", cedula: "9000000105", age: 41, sex: "Masculino", city: "Bucaramanga", daysAgo: 100, answers: { sector: "plaza_mercado", income: "1600000", expenses: "760000" }, key_breb: { key: "3009000105", keyType: "PHONE", bank: "NEQUI" } },
  { key: "rosa", first: "Rosa Amelia", last: "Quintero", cedula: "9000000106", age: 52, sex: "Femenino", city: "Pereira", daysAgo: 40, answers: { sector: "confeccion", income: "1500000", expenses: "650000" }, key_breb: { key: "@rosaquintero", keyType: "ALPHANUMERIC", bank: "DAVIPLATA" } },
  { key: "carmen", first: "Carmen Elena", last: "Díaz", cedula: "9000000107", age: 57, sex: "Femenino", city: "Cartagena", daysAgo: 0, answers: { sector: "comidas_rapidas", income: "1700000", expenses: "780000" }, key_breb: { key: "3009000107", keyType: "PHONE", bank: "NEQUI" } },
  { key: "wilson", first: "Wilson Andrés", last: "Ospina", cedula: "9000000108", age: 24, sex: "Masculino", city: "Manizales", daysAgo: 0, answers: { sector: "reciclaje", income: "1100000", expenses: "620000", activityAge: "1a2", savingsGroup: "no" }, key_breb: { key: "3009000108", keyType: "PHONE", bank: "NEQUI" } },
];

/** ¿Ya está cargado el día de demo? */
export const demoDayLoaded = (db: DB) => db.demoDaySeeded === DEMO_DAY_VERSION;

/**
 * Carga el día de demostración. `today`: la hora actual de la demo (now(db)).
 * Devuelve un resumen de lo creado. No hace nada si ya está cargado.
 */
export function seedDemoDay(db: DB): { investors: number; borrowers: number; loans: number } {
  if (demoDayLoaded(db)) return { investors: 0, borrowers: 0, loans: 0 };
  const realOffset = db.clockOffsetMs;
  const today = Date.now() + realOffset;
  // Las horas de "hoy" se reparten en las últimas 9 horas, en el orden de la historia
  const at = (daysAgo: number, hoursAgo = 0) => today - daysAgo * DAY_MS - hoursAgo * H;
  const moveTo = (t: number) => (db.clockOffsetMs = t - Date.now());

  const steps: { t: number; run: () => void }[] = [];
  const step = (t: number, run: () => void) => steps.push({ t, run });
  const users = new Map<string, User>();
  const loanOf = new Map<string, string>();

  const ensureUser = (u: User) => {
    const existing = db.users.find((x) => x.id === u.id);
    if (existing) return existing;
    db.users.push(u);
    audit(db, {
      category: "identidad",
      action: "cuenta_registrada",
      actor: actorOf(u),
      entity: { type: "usuario", id: u.id },
      summary: `Se registró como ${u.role === "inversor" ? "inversionista" : "acreditado"} · verificación facial aprobada`,
      data: { rol: u.role, verificacionFacial: "aprobada" },
    });
    return u;
  };
  const baseUser = (id: string, first: string, last: string, extra: Partial<User>): User => ({
    ...newPasswordHash(crypto.randomUUID()), // nadie inicia sesión con estas cuentas
    id,
    role: "acreditado",
    firstName: first,
    lastName: last,
    name: `${first} ${last}`,
    email: `${id.replace(ID_PREFIX, "")}@demo.labodeguita.test`,
    cedula: "",
    phone: "3000000000",
    nationality: "Colombiana",
    age: 35,
    sex: "Prefiero no decir",
    address: "",
    documents: { idFront: "(demo)", idBack: "(demo)" },
    faceVerification: "aprobada",
    createdAt: Date.now() + db.clockOffsetMs,
    ...extra,
  });

  // ---------- Inversionistas ----------
  for (const inv of INVESTORS) {
    const id = `${ID_PREFIX}${inv.key}`;
    const wallet = `https://ilp.interledger-test.dev/demo-${inv.key}`;
    step(at(inv.daysAgo, 2), () => {
      users.set(
        inv.key,
        ensureUser(
          baseUser(id, inv.first, inv.last, {
            role: "inversor",
            cedula: `PAS-${inv.key.toUpperCase()}`,
            nationality: inv.nationality,
            address: inv.address,
            wallet,
            investorProfile: { monthlyIncome: 5000, currency: inv.currency, incomeSource: "Salario", employment: "asalariado" },
          }),
        ),
      );
    });
  }
  const deposit = (key: string, level: Level, amount: number) => creditDeposit(db, `https://ilp.interledger-test.dev/demo-${key}`, level, amount, "simulado");
  // Lukas: aporte grande hace 8 meses y otro hoy
  step(at(240, 1), () => deposit("lukas", 1, 4_000_000));
  step(at(0, 7.5), () => deposit("lukas", 1, 2_000_000));
  // Sarah: inversión recurrente mensual en el nivel 2 (en modo simulado); el cobro del mes cae en la historia
  step(at(92), () => {
    const wallet = "https://ilp.interledger-test.dev/demo-sarah";
    const txId = deposit("sarah", 2, 1_000_000);
    const subId = createRecurring(db, { wallet, level: 2, mode: "simulado", amountCop: 1_000_000, interval: DEFAULT_RECURRING_INTERVAL, start: Date.now() + db.clockOffsetMs });
    const sub = db.recurring!.find((s) => s.id === subId)!;
    const tx = db.txs.find((x) => x.id === txId);
    if (tx?.receipt) tx.receipt.recurring = recurringReceipt(sub, 1);
    // Cobros de los meses siguientes, hasta hoy
    for (let run = 1; addDuration(sub.start, sub.interval, run) <= today; run++) {
      const due = addDuration(sub.start, sub.interval, run);
      step(due, () => {
        const id2 = deposit("sarah", 2, 1_000_000);
        sub.runs += 1;
        const t2 = db.txs.find((x) => x.id === id2);
        if (t2?.receipt) t2.receipt.recurring = recurringReceipt(sub, sub.runs);
        sub.lastRunAt = due;
        sub.nextRunAt = addDuration(sub.start, sub.interval, sub.runs);
      });
    }
  });
  // Valentina: nivel 3 hace 5 meses; hoy hace un retiro anticipado (máximo el 50 %)
  step(at(150, 1), () => deposit("valentina", 3, 2_500_000));
  step(at(0, 3), () => debitWithdraw(db, "https://ilp.interledger-test.dev/demo-valentina", 3, 600_000, "simulado"));
  // Hiroshi: llegó hace dos semanas y hoy diversifica
  step(at(16, 1), () => deposit("hiroshi", 1, 1_500_000));
  step(at(0, 6), () => deposit("hiroshi", 2, 800_000));

  // ---------- Acreditados ----------
  const study = (b: BorrowerSpec) => {
    const user = users.get(b.key)!;
    saveStudy(db, b.cedula, user.name, b.age, { ...BASE, ...b.answers } as StudyAnswers, {}, {});
    const a = db.applicants.find((x) => x.cedula === b.cedula)!;
    audit(db, {
      category: "estudio",
      action: "estudio_realizado",
      actor: actorOf(user),
      entity: { type: "usuario", id: user.id },
      summary: `Estudio de crédito: puntaje ${a.score}/100 · ${a.riskLevel === 4 ? "no apto por ahora" : `nivel ${a.scoreLevel}`}`,
      data: { puntaje: a.score, nivel: a.riskLevel },
    });
  };
  /** Pide un crédito por la llave verificada y lo desembolsa (payout simulado). Devuelve el id o null si no aplica */
  const loan = (b: BorrowerSpec, target: number, installments: number, purpose: string) => {
    const user = users.get(b.key)!;
    const a = db.applicants.find((x) => x.cedula === b.cedula);
    const level = a && applicantLevel(db, a);
    if (!a || !level) return null;
    const n = Math.min(installments, Math.floor(LEVELS[level].maxDays / INSTALLMENT_DAYS));
    const limit = creditLimit(level, a.maxInstallment, n);
    const amount = Math.max(MIN_LOAN, Math.min(target, Math.floor((limit * 0.9) / 10_000) * 10_000));
    if (amount > limit) return null;
    const t = Date.now() + db.clockOffsetMs;
    const v: BrebVerification = {
      id: crypto.randomUUID().slice(0, 8),
      userId: user.id,
      key: b.key_breb.key,
      keyType: b.key_breb.keyType,
      holderName: `${b.first.slice(0, 3).toUpperCase()}*** ${b.last.slice(0, 3).toUpperCase()}***`,
      financialEntity: { name: b.key_breb.bank, code: "0000" },
      nameMatches: true,
      mode: "simulado",
      status: "VERIFIED",
      verifiedAt: t,
      expiresAt: Date.now() + 5 * 60_000,
    };
    db.brebVerifications.push(v);
    const l = requestLoan(db, user, amount, n, v.id, true, { purpose, termsAccepted: true });
    completeDisbursement(db, l.id, { directory: "simulado", holderName: v.holderName, financialEntity: v.financialEntity });
    loanOf.set(b.key, l.id);
    return l.id;
  };
  /** Paga por Bre-B la cuota impaga más antigua (o `amount`) */
  const pay = (key: string, amount?: number) => {
    const id = loanOf.get(key);
    const l = id && db.loans.find((x) => x.id === id);
    if (!l || l.status !== "activo") return;
    const due = l.schedule.find((i) => !i.paidAt);
    if (!due) return;
    receiveBrebPayment(db, l.id, { toKey: VAULT_BREB.key, fromKey: l.llaveBreb, amount: Math.round(amount ?? installmentDue(due)) });
  };
  /** Paga la cuota número `n` del crédito el día de su vencimiento + `late` días */
  const payOn = (key: string, startDaysAgo: number, n: number, late = 0, hoursAgo?: number) =>
    step(at(startDaysAgo - n * INSTALLMENT_DAYS - late, hoursAgo ?? 0), () => pay(key));

  for (const b of BORROWERS) {
    const id = `${ID_PREFIX}${b.key}`;
    step(at(b.daysAgo, b.daysAgo === 0 ? (b.key === "carmen" ? 8 : 1.5) : 3), () => {
      users.set(
        b.key,
        ensureUser(baseUser(id, b.first, b.last, { cedula: b.cedula, age: b.age, sex: b.sex, address: b.city, borrowerProfile: { incomeSource: "Negocio propio", monthlyIncomeCop: Number(b.answers.income ?? BASE.income), llaveBreb: b.key_breb.key } })),
      );
      study(b);
    });
  }

  // Marta: un crédito pagado a tiempo hace meses y uno vigente; hoy paga la cuota que venció hace 2 días (a tiempo)
  step(at(205), () => loan(BORROWERS[0], 600_000, 4, "capital_trabajo"));
  for (let n = 1; n <= 4; n++) payOn("marta", 205, n);
  step(at(47), () => loan(BORROWERS[0], 1_500_000, 8, "herramientas"));
  for (let n = 1; n <= 2; n++) payOn("marta", 47, n);
  step(at(0, 5), () => pay("marta"));
  // Jhon: pagó la cuota 1; la 2 vence hoy (solicitud de pago "por pagar")
  step(at(30), () => loan(BORROWERS[1], 800_000, 6, "capital_trabajo"));
  payOn("jhon", 30, 1);
  // Yeimi: la cuota 1 venció hace 9 días; abonó una parte hace 3 (en mora)
  step(at(24), () => loan(BORROWERS[2], 900_000, 6, "local"));
  step(at(3), () => pay("yeimi", 50_000));
  // Luis: pagó la cuota 1; la 2 lleva 40 días vencida (nivel 4 hasta ponerse al día)
  step(at(70), () => loan(BORROWERS[3], 1_200_000, 6, "herramientas"));
  payOn("luis", 70, 1);
  // Diego: 75 días de mora (ya tiene el aviso previo del reporte a centrales)
  step(at(90), () => loan(BORROWERS[4], 700_000, 6, "capital_trabajo"));
  // Rosa (consumo: gastos del hogar): pagó la cuota 1 y hoy paga la última: termina el crédito y sube de nivel
  step(at(30), () => loan(BORROWERS[5], 500_000, 2, "hogar"));
  payOn("rosa", 30, 1);
  step(at(0, 4), () => pay("rosa"));
  // Carmen (consumo: salud): hace el estudio esta mañana y recibe su crédito
  step(at(0, 7), () => loan(BORROWERS[6], 600_000, 4, "salud"));
  // Wilson: hizo el estudio hace un rato; todavía no pide crédito

  // Se ejecuta en orden de tiempo (los pasos agregados durante la ejecución también entran en su lugar)
  withSimulatedAuditClock(realOffset, () => {
    const done = new Set<(typeof steps)[number]>();
    for (;;) {
      const next = steps.filter((s) => !done.has(s) && s.t <= today).sort((x, y) => x.t - y.t)[0];
      if (!next) break;
      done.add(next);
      moveTo(next.t);
      next.run();
    }
  });
  db.clockOffsetMs = realOffset;
  db.demoDaySeeded = DEMO_DAY_VERSION;
  return { investors: INVESTORS.length, borrowers: BORROWERS.length, loans: loanOf.size };
}
