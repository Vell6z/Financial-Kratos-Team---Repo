// Generador del dataset sintético para entrenar un modelo de riesgo de crédito.
//
// Idea: cada persona tiene rasgos "verdaderos" que no vemos (disciplina, estabilidad, ingreso real,
// si exagera sus respuestas). Con esos rasgos se generan (1) sus respuestas al estudio de /estudio,
// (2) los documentos que sube, (3) datos alternativos y (4) cómo pagó su crédito cuota a cuota.
// El modelo de ML solo ve 1, 2 y 3, y tiene que aprender a predecir 4.
//
// El puntaje de reglas se calcula con el mismo computeStudy de la app, así se puede comparar ML vs. reglas.
//
// Uso:  npm run ml:dataset            (6.000 filas, semilla 42)
//       npm run ml:dataset -- 20000 7 (filas y semilla)
// Explicación de cada columna: ml/README.md

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { INSTALLMENT_DAYS, LEVELS, MIN_LOAN, type Level } from "../src/lib/config";
import { buildSchedule } from "../src/lib/finance";
import { computeStudy, creditLimit, EMPTY_STUDY, LIKERT, readingsFromNames, type DocKey, type Reference, type StudyAnswers } from "../src/lib/scoring";

const ROWS = Number(process.argv[2] ?? 6000);
const SEED = Number(process.argv[3] ?? 42);

// ---------- Aleatoriedad reproducible ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const uniform = (a: number, b: number) => a + (b - a) * rand();
const int = (a: number, b: number) => Math.floor(uniform(a, b + 1));
const chance = (p: number) => rand() < p;
const normal = (mu = 0, sd = 1) => mu + sd * Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const lognormal = (median: number, sigma: number) => median * Math.exp(normal(0, sigma));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const roundTo = (v: number, step: number) => Math.max(0, Math.round(v / step) * step);
function weighted<T>(items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[items.length - 1][0];
}

// ---------- Población: micro-negocios y trabajadores informales en Colombia ----------
interface Sector {
  id: string;
  weight: number;
  /** Ingreso mensual mediano (COP) y dispersión */
  income: number;
  sigma: number;
  variability: [number, number, number]; // parecidos, algo, mucho
  workplace: [number, number, number]; // fijo, ruta, cambia
  /** Riesgo propio del oficio (clima, robos, competencia) en escala logit */
  risk: number;
  /** Le pega la temporada de lluvias */
  weather: boolean;
  savingsGroup: number;
}
const SECTORS: Sector[] = [
  { id: "tienda_barrio", weight: 14, income: 1_800_000, sigma: 0.45, variability: [0.5, 0.4, 0.1], workplace: [0.9, 0.05, 0.05], risk: -0.25, weather: false, savingsGroup: 0.4 },
  { id: "comidas_rapidas", weight: 16, income: 1_400_000, sigma: 0.45, variability: [0.35, 0.45, 0.2], workplace: [0.6, 0.3, 0.1], risk: 0, weather: false, savingsGroup: 0.5 },
  { id: "venta_ambulante", weight: 16, income: 1_000_000, sigma: 0.5, variability: [0.15, 0.45, 0.4], workplace: [0.15, 0.55, 0.3], risk: 0.35, weather: true, savingsGroup: 0.45 },
  { id: "confeccion", weight: 8, income: 1_200_000, sigma: 0.4, variability: [0.35, 0.45, 0.2], workplace: [0.75, 0.1, 0.15], risk: 0, weather: false, savingsGroup: 0.45 },
  { id: "belleza", weight: 9, income: 1_300_000, sigma: 0.45, variability: [0.3, 0.5, 0.2], workplace: [0.6, 0.15, 0.25], risk: 0, weather: false, savingsGroup: 0.5 },
  { id: "transporte_moto", weight: 9, income: 1_500_000, sigma: 0.4, variability: [0.3, 0.5, 0.2], workplace: [0.1, 0.75, 0.15], risk: 0.15, weather: true, savingsGroup: 0.25 },
  { id: "reciclaje", weight: 6, income: 800_000, sigma: 0.45, variability: [0.2, 0.4, 0.4], workplace: [0.1, 0.6, 0.3], risk: 0.3, weather: true, savingsGroup: 0.3 },
  { id: "servicio_domestico", weight: 9, income: 1_100_000, sigma: 0.35, variability: [0.4, 0.4, 0.2], workplace: [0.2, 0.3, 0.5], risk: 0.05, weather: false, savingsGroup: 0.45 },
  { id: "plaza_mercado", weight: 8, income: 1_600_000, sigma: 0.5, variability: [0.3, 0.45, 0.25], workplace: [0.8, 0.1, 0.1], risk: -0.05, weather: false, savingsGroup: 0.5 },
  { id: "artesanias", weight: 5, income: 900_000, sigma: 0.55, variability: [0.1, 0.4, 0.5], workplace: [0.3, 0.3, 0.4], risk: 0.25, weather: true, savingsGroup: 0.35 },
];
const CITIES: [string, number][] = [
  ["Bogotá", 24], ["Medellín", 16], ["Cali", 12], ["Barranquilla", 9], ["Cartagena", 7], ["Bucaramanga", 6],
  ["Cúcuta", 6], ["Pereira", 5], ["Montería", 5], ["Pasto", 4], ["Villavicencio", 3], ["Quibdó", 3],
];
const EDUCATION: [string, number][] = [["primaria", 30], ["bachillerato", 45], ["tecnico", 17], ["universitario", 8]];
const RELATIONS_BY_SECTOR: Record<string, string[]> = {
  default: ["Proveedor", "Cliente frecuente", "Administradora de la natillera", "Arrendador", "Líder comunitario"],
  servicio_domestico: ["Cliente frecuente", "Arrendador", "Líder comunitario", "Administradora de la natillera"],
  reciclaje: ["Proveedor", "Líder comunitario", "Arrendador"],
};
const FIRST = ["María", "Luz", "Carmen", "Ana", "Rosa", "Diana", "Paola", "Juan", "Carlos", "Luis", "Jorge", "Andrés", "Sandra", "Yuli", "Wilson", "Édgar", "Marta", "Fredy"];
const LAST = ["Gómez", "Rodríguez", "Martínez", "López", "Hernández", "Díaz", "Moreno", "Rojas", "Castro", "Ospina", "Zapata", "Mosquera", "Palacios", "Restrepo"];

const pickIdx = (p: number[]) => weighted(p.map((w, i) => [i, w] as [number, number]));

// Fechas de solicitud entre ene-2025 y sep-2026 (permite partir por tiempo: entrenar con lo viejo, probar con lo nuevo)
const START = Date.UTC(2025, 0, 1);
const END = Date.UTC(2026, 8, 30);
/** Efecto de la temporada sobre el riesgo (logit): diciembre vende bien, enero-febrero "cuesta de enero", lluvias abr-may y oct-nov */
function season(month: number, weather: boolean) {
  let s = 0;
  if (month === 11) s -= 0.25;
  if (month === 0 || month === 1) s += 0.3;
  if (weather && [3, 4, 9, 10].includes(month)) s += 0.35;
  return s;
}

// ---------- Una persona ----------
function person(id: number) {
  const sector = weighted(SECTORS.map((s) => [s, s.weight] as [Sector, number]));
  const city = weighted(CITIES);
  const sex = chance(0.58) ? "F" : "M";
  const age = Math.round(clamp(normal(38, 11), 18, 72));
  const education = weighted(EDUCATION);
  const eduLevel = EDUCATION.findIndex(([e]) => e === education);
  const dependents = weighted([[0, 22], [1, 28], [2, 25], [3, 15], [4, 7], [5, 3]] as [number, number][]);
  const stratum = weighted([[1, 40], [2, 42], [3, 16], [4, 2]] as [number, number][]);
  const appliedAt = new Date(START + rand() * (END - START));

  // Rasgos ocultos
  const discipline = normal(); // cumplimiento, autocontrol
  const stability = clamp(0.3 * discipline + 0.035 * (age - 38) + normal(0, 0.85), -3, 3);
  const exaggerates = chance(0.09 + (discipline < -0.8 ? 0.1 : 0)); // infla ingresos y "se pinta" mejor
  const digital = sigmoid(0.6 - 0.05 * (age - 35) + 0.45 * eduLevel + normal(0, 0.8));

  // Plata real del hogar
  const income = roundTo(lognormal(sector.income * (1 + 0.12 * eduLevel), sector.sigma), 10_000);
  const expenseShare = clamp(0.5 + 0.055 * dependents + normal(0, 0.1), 0.3, 0.97);
  const expenses = roundTo(income * expenseShare, 10_000);
  const loanShark = chance(0.1 + (discipline < -0.5 ? 0.12 : 0) + (sector.risk > 0.2 ? 0.06 : 0));
  let debts = chance(0.45) ? income * uniform(0.04, 0.3) : 0;
  if (loanShark) debts += income * uniform(0.1, 0.35);
  debts = roundTo(debts, 10_000);

  // ---------- Respuestas al estudio (lo que la persona DICE) ----------
  const a: StudyAnswers = structuredClone(EMPTY_STUDY);
  a.confirmAdult = true;
  a.consent = true;
  a.sector = sector.id;
  a.dependents = String(dependents);
  a.income = String(roundTo(exaggerates ? income * uniform(1.3, 2.2) : income * uniform(0.9, 1.1), 50_000) || 50_000);
  a.expenses = String(roundTo(exaggerates ? expenses * uniform(0.45, 0.8) : expenses * uniform(0.85, 1.15), 10_000));
  a.debts = String(roundTo(exaggerates ? debts * uniform(0, 0.6) : debts * uniform(0.9, 1.1), 10_000));
  // Mucha gente no admite el gota a gota por vergüenza
  a.loanShark = loanShark && chance(exaggerates ? 0.3 : 0.8) ? "si" : "no";
  a.variability = ["parecidos", "algo", "mucho"][pickIdx(sector.variability)];
  const tenure = stability + 0.04 * (age - 30) + normal(0, 0.6);
  a.activityAge = tenure > 0.6 ? "gt2" : tenure > -0.2 ? "1a2" : tenure > -0.9 ? "6a11" : "lt6";

  // Historial real de pagos del hogar y lo que declara
  const habit = discipline + normal(0, 0.7);
  const trueUtilities = chance(age < 26 ? 0.3 : 0.08) ? "noyo" : habit > 0.6 ? "siempre" : habit > -0.4 ? "1a2" : habit > -1.3 ? "3mas" : "cortaron";
  const brag = (truth: string, best: string) => (exaggerates && chance(0.8)) || chance(0.12) ? best : truth;
  a.utilities = trueUtilities === "noyo" ? "noyo" : brag(trueUtilities, "siempre");
  const ownsHome = chance(0.3 + (age > 50 ? 0.2 : 0));
  const rentHabit = discipline + normal(0, 0.8);
  a.rent = ownsHome ? "propia" : brag(rentHabit > 0.2 ? "siempre" : rentHabit > -0.9 ? "aveces" : "debo", "siempre");
  a.phonePlan = digital + normal(0, 0.25) > 0.75 && income > 1_300_000 ? "plan" : chance(0.6 + 0.2 * discipline) ? "semana" : "veces";
  const inGroup = chance(sector.savingsGroup + (sex === "F" ? 0.1 : -0.05));
  a.savingsGroup = !inGroup ? "no" : brag(discipline + normal(0, 0.7) > -0.3 ? "cumplo" : "atraso", "cumplo");
  const boughtOnCredit = chance(0.62);
  const creditHabit = discipline + normal(0, 0.8);
  a.creditPurchases = !boughtOnCredit ? "nunca" : brag(creditHabit > -0.1 ? "aldia" : creditHabit > -1.1 ? "atrasos" : "mora", "aldia");
  const rootedness = stability + 0.03 * (age - 35) + (ownsHome ? 0.8 : 0) + normal(0, 0.6);
  a.housingAge = rootedness > 0.3 ? "gt2" : rootedness > -0.6 ? "1a2" : "lt1";
  a.workplace = ["fijo", "ruta", "cambia"][pickIdx(sector.workplace)];
  a.phoneOwner = chance(0.82 + 0.1 * digital) ? "si" : "no";

  // Psicométrico: verdad + deseabilidad social (todos se pintan un poco mejor; quien exagera, mucho más)
  const polish = exaggerates ? 1.2 : 0.4;
  a.likert = LIKERT.map((q, i) => {
    const trait = discipline * 0.9 + normal(0, 0.9);
    let v = q.reverse ? 3 - trait - polish : 3 + trait + polish;
    // X5: quien exagera a veces se delata en la última afirmación ("dejo pasar fechas sin avisar")
    if (i === 10 && exaggerates && chance(0.3)) v = 4 + rand();
    return Math.round(clamp(v, 1, 5));
  });
  a.timePref = chance(sigmoid(0.2 + 0.8 * discipline)) ? "mes" : "hoy";

  // Referencias
  const refCount = weighted([[0, 25 - 6 * stability], [1, 35], [2, 40 + 6 * stability]].map(([n, w]) => [n, Math.max(1, w)] as [number, number]));
  const pool = RELATIONS_BY_SECTOR[sector.id] ?? RELATIONS_BY_SECTOR.default;
  const references: Reference[] = [];
  for (let r = 0; r < refCount; r++) {
    let relation = pool[int(0, pool.length - 1)];
    if (relation === "Administradora de la natillera" && !inGroup) relation = "Cliente frecuente";
    if (relation === "Arrendador" && ownsHome) relation = "Líder comunitario";
    const other = chance(0.06);
    references.push({
      name: `${FIRST[int(0, FIRST.length - 1)]} ${LAST[int(0, LAST.length - 1)]}`,
      phone: `3${int(0, 2)}${int(0, 9)}${String(int(0, 9_999_999)).padStart(7, "0")}`,
      relation: other ? "Otro" : relation,
      relationOther: other ? "Vecino del negocio" : "",
      notify: chance(exaggerates ? 0.3 : clamp(0.55 + 0.2 * discipline, 0.1, 0.95)),
    });
  }
  a.references = [...references, ...EMPTY_STUDY.references].slice(0, Math.max(2, references.length));

  // Documentos (lectura simulada con los mismos trucos de nombre que usa la app)
  const docs: Partial<Record<DocKey, string>> = {};
  if (chance(digital * 0.65 * (exaggerates ? 0.35 : 1))) docs.extracto = `extracto_${roundTo(income * uniform(0.85, 1.05), 10_000)}.pdf`;
  if (chance(digital * 0.6)) {
    const owedOnBill = ["3mas", "cortaron"].includes(trueUtilities) || (trueUtilities === "1a2" && chance(0.5));
    docs.factura = owedOnBill ? "factura_mora.pdf" : "factura.pdf";
  }
  if (a.rent !== "propia" && chance(0.3 * digital + 0.1)) docs.arriendo = "recibo_arriendo.jpg";
  if (chance(digital * 0.4)) docs.recargas = "recargas.png";
  if (inGroup && chance(0.45)) docs.libreta = "libreta.jpg";
  if (boughtOnCredit && chance(0.3)) docs.pazysalvo = "pazysalvo.pdf";
  const altered = exaggerates && chance(0.08);
  if (altered) docs.extracto = "extracto_alterado.pdf";

  // Datos alternativos (todavía no se piden en la app: fuentes futuras con autorización)
  const lineMonths = Math.round(clamp(lognormal(30 + 6 * (stability + 1.5) * 4, 0.6), 1, 240));
  const topups = roundTo(clamp(lognormal(income * 0.025, 0.4), 5_000, 300_000), 1_000);
  const walletTx = Math.round(clamp(lognormal(digital * 40 + 1, 0.7) - 2, 0, 400));

  const study = computeStudy(a, { docs: readingsFromNames(docs), hasUnpaidLoan: false });

  // ---------- Crédito ----------
  const freeReal = income - expenses - debts;
  let group: "aprobado" | "piloto" | "rechazado" = study.level ? "aprobado" : "piloto";
  // Por responsabilidad no se presta a quien no le sobra plata ni con documentos alterados
  if (!study.level && (freeReal <= 0 || Number(a.income) - Number(a.expenses) - Number(a.debts) <= 0 || altered)) group = "rechazado";
  if (group === "piloto" && !chance(0.4)) group = "rechazado";

  let loan: { level: Level; amount: number; installments: number; payment: number } | null = null;
  if (group === "aprobado") {
    const level = study.level!;
    const cfg = LEVELS[level];
    const minN = Math.ceil(cfg.minDays / INSTALLMENT_DAYS);
    const maxN = Math.floor(cfg.maxDays / INSTALLMENT_DAYS);
    let n = int(minN, maxN);
    while (n < maxN && creditLimit(level, study.maxInstallment, n) < MIN_LOAN) n++;
    const limit = creditLimit(level, study.maxInstallment, n);
    const amount = Math.max(MIN_LOAN, roundTo(limit * uniform(0.4, 1), 10_000));
    loan = { level, amount: Math.min(amount, limit), installments: n, payment: 0 };
  } else if (group === "piloto") {
    // Piloto de exploración: créditos pequeños a parte de los no aptos para aprender sin sesgo de selección
    loan = { level: 3, amount: roundTo(uniform(MIN_LOAN, 300_000), 10_000), installments: int(2, 4), payment: 0 };
  }
  if (loan) loan.payment = buildSchedule(loan.amount, LEVELS[loan.level].rateEA, loan.installments, 0)[0].payment;

  // ---------- Cómo pagó (la "verdad" que el modelo debe aprender a predecir) ----------
  let outcome: { onTime: number; late: number; maxDaysLate: number; paid: number; defaulted: boolean } | null = null;
  if (loan) {
    const burden = (2 * loan.payment) / Math.max(freeReal, 30_000);
    const base =
      -4.6 -
      1.05 * discipline -
      0.35 * stability +
      1.3 * clamp(burden, 0, 3) +
      0.75 * (loanShark ? 1 : 0) +
      (a.variability === "mucho" ? 0.4 : a.variability === "algo" ? 0.15 : 0) +
      sector.risk +
      0.1 * dependents +
      0.45 * (exaggerates ? 1 : 0) -
      0.3 * references.filter((r) => r.notify).length +
      (a.activityAge === "lt6" ? 0.3 : 0) +
      (age < 25 ? 0.15 : 0) +
      season(appliedAt.getUTCMonth(), sector.weather);
    let onTime = 0;
    let late = 0;
    let maxDaysLate = 0;
    let paid = 0;
    let defaulted = false;
    let hardship = 0;
    for (let k = 0; k < loan.installments; k++) {
      // Choques de la vida: enfermedad, robo, se varó el negocio
      if (chance(0.025)) hardship += uniform(0.8, 2);
      const p = sigmoid(base + hardship + normal(0, 0.3));
      if (!chance(p * 2.2)) {
        onTime++;
        paid += loan.payment;
        continue;
      }
      // Pagó tarde: unos días o una mora seria
      const serious = chance(sigmoid(base + hardship + 1.6));
      const days = serious ? int(30, 120) : int(1, 20);
      maxDaysLate = Math.max(maxDaysLate, days);
      if (serious) {
        defaulted = true;
        // Lo que alcanza a recuperar la cobranza del saldo restante
        paid += loan.payment * (loan.installments - k) * (chance(0.35) ? uniform(0.2, 0.8) : 0);
        late++;
        break;
      }
      late++;
      paid += loan.payment;
    }
    outcome = { onTime, late, maxDaysLate, paid: Math.round(paid), defaulted };
  }

  const total = loan ? loan.payment * loan.installments : 0;
  const declaredFree = Number(a.income) - Number(a.expenses) - Number(a.debts);
  const confirmed = references.filter((r) => r.notify).length;
  const month = appliedAt.toISOString().slice(0, 7);
  const split = appliedAt.getTime() >= Date.UTC(2026, 6, 1) ? "test" : appliedAt.getTime() >= Date.UTC(2026, 3, 1) ? "valid" : "train";

  return {
    id: `K${String(id).padStart(6, "0")}`,
    fecha_solicitud: appliedAt.toISOString().slice(0, 10),
    mes_solicitud: month,
    particion: split,
    // Perfil
    ciudad: city,
    estrato: stratum,
    edad: age,
    sexo: sex,
    escolaridad: education,
    personas_a_cargo: dependents,
    sector: sector.id,
    // Paso 2
    ingreso_declarado: Number(a.income),
    gastos_declarados: Number(a.expenses),
    deudas_declaradas: Number(a.debts),
    disponible_declarado: declaredFree,
    gota_a_gota: a.loanShark,
    variabilidad: a.variability,
    antiguedad_actividad: a.activityAge,
    // Paso 3
    servicios: a.utilities,
    arriendo: a.rent,
    plan_celular: a.phonePlan,
    natillera: a.savingsGroup,
    compras_credito: a.creditPurchases,
    // Paso 4
    antiguedad_vivienda: a.housingAge,
    lugar_trabajo: a.workplace,
    celular_propio: a.phoneOwner,
    // Paso 5
    ...Object.fromEntries(a.likert.map((v, i) => [`likert_${i + 1}`, v])),
    preferencia_tiempo: a.timePref,
    // Paso 6
    referencias: references.length,
    referencias_confirmadas: confirmed,
    referencias_relaciones: references.map((r) => r.relation).join("|"),
    // Documentos
    doc_extracto: docs.extracto ? 1 : 0,
    doc_factura: docs.factura ? 1 : 0,
    doc_arriendo: docs.arriendo ? 1 : 0,
    doc_recargas: docs.recargas ? 1 : 0,
    doc_libreta: docs.libreta ? 1 : 0,
    doc_pazysalvo: docs.pazysalvo ? 1 : 0,
    ingreso_extracto: docs.extracto && !altered ? Number(docs.extracto.match(/\d+/)![0]) : "",
    factura_con_mora: docs.factura === "factura_mora.pdf" ? 1 : 0,
    doc_alterado: altered ? 1 : 0,
    // Datos alternativos
    antiguedad_linea_meses: lineMonths,
    recargas_mes: topups,
    transacciones_billetera_mes: walletTx,
    // Resultado del modelo de reglas actual (src/lib/scoring.ts)
    puntaje_reglas: study.score,
    nivel_reglas: study.riskLevel,
    respaldo_pct: study.backing,
    alertas: study.alerts.length,
    en_revision: study.review ? 1 : 0,
    cuota_max_quincenal: study.maxInstallment,
    // Crédito
    grupo: group,
    nivel_credito: loan?.level ?? "",
    tasa_ea: loan ? LEVELS[loan.level].rateEA : "",
    monto: loan?.amount ?? "",
    cuotas: loan?.installments ?? "",
    plazo_dias: loan ? loan.installments * INSTALLMENT_DAYS : "",
    valor_cuota: loan?.payment ?? "",
    cuota_sobre_disponible: loan && declaredFree > 0 ? Math.round((loan.payment / (declaredFree / 2)) * 1000) / 1000 : "",
    // Resultado (objetivo del modelo). Vacío si no se prestó.
    cuotas_a_tiempo: outcome?.onTime ?? "",
    cuotas_tarde: outcome?.late ?? "",
    dias_mora_max: outcome?.maxDaysLate ?? "",
    total_a_pagar: loan ? total : "",
    total_pagado: outcome?.paid ?? "",
    perdida: outcome ? Math.max(0, loan!.amount - outcome.paid) : "",
    incumplio: outcome ? (outcome.defaulted ? 1 : 0) : "",
  };
}

// ---------- Salida ----------
const rows = Array.from({ length: ROWS }, (_, i) => person(i + 1)).sort((x, y) => x.fecha_solicitud.localeCompare(y.fecha_solicitud));
const header = Object.keys(rows[0]);
const esc = (v: unknown) => {
  const s = String(v);
  return /[",\n|]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [header.join(","), ...rows.map((r) => header.map((h) => esc(r[h as keyof typeof r])).join(","))].join("\n") + "\n";

const out = join(dirname(fileURLToPath(import.meta.url)), "dataset", "creditos_sinteticos.csv");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, csv);

// Resumen para revisar que el dataset sea coherente
const lent = rows.filter((r) => r.incumplio !== "");
const rate = (list: typeof rows) => (list.length ? `${((list.filter((r) => r.incumplio === 1).length / list.length) * 100).toFixed(1)} %` : "-");
console.log(`${rows.length} solicitudes → ${out}`);
console.log(`Con crédito: ${lent.length} · incumplimiento global ${rate(lent)}`);
for (const lvl of [1, 2, 3, 4] as const) {
  const byRules = lent.filter((r) => r.nivel_reglas === lvl);
  console.log(`  nivel de reglas ${lvl}: ${byRules.length} créditos, incumplimiento ${rate(byRules)}`);
}
for (const g of ["aprobado", "piloto", "rechazado"]) console.log(`  ${g}: ${rows.filter((r) => r.grupo === g).length}`);
for (const p of ["train", "valid", "test"]) console.log(`  ${p}: ${rows.filter((r) => r.particion === p).length} filas, incumplimiento ${rate(lent.filter((r) => r.particion === p))}`);
