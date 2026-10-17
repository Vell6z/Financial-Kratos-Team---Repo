import { INSTALLMENT_DAYS, LEVELS, MIN_LOAN, SCORE_THRESHOLDS, type Level } from "./config";
import { buildSchedule, periodRate } from "./finance";
import { validateName, validatePhone } from "./validators";

// Modelo de perfil de riesgo (estudio de crédito en 6 pasos).
// Compartido entre el navegador (preguntas y validación) y el servidor (puntaje: solo se calcula en el servidor).
// Explicación completa para el equipo: docs/modelo-de-riesgo.md. Si cambian la lógica, actualicen ese documento.

// ======================================================================
// CONFIG: el único lugar donde se cambian los parámetros del modelo
// ======================================================================
export const CONFIG = {
  /** Cuánto vale una respuesta según su respaldo */
  factors: { declarado: 0.5, documento: 0.8, confirmado: 1 },
  /** Umbrales de nivel: ≥70 nivel 1, ≥50 nivel 2, ≥35 nivel 3, debajo nivel 4 */
  thresholds: SCORE_THRESHOLDS,
  /** Parte del dinero libre que puede irse en la cuota */
  maxInstallmentShare: 0.5,
  /** Si las cuotas actuales superan este % del ingreso, el nivel máximo es 3 */
  debtLoadLimit: 0.6,
  /** Días para volver a solicitar si queda en nivel 4 */
  retryDays: 60,
  /** X2: si el ingreso declarado supera el del extracto en este factor, se usa el del extracto */
  incomeMismatch: 1.5,
  /** X4: gastos + cuotas por debajo de este % del ingreso, sin extracto, es un presupuesto poco creíble */
  implausibleBudget: 0.3,
} as const;

export type Backing = keyof typeof CONFIG.factors;
export type RiskLevel = Level | 4;

export interface Option<T extends string = string> {
  id: T;
  label: string;
  points: number;
  /** Respuesta neutra: no se multiplica por el factor (no castiga a quien no tiene esa obligación) */
  neutral?: boolean;
}

const opts = <T extends string>(...list: [T, string, number, boolean?][]): Option<T>[] =>
  list.map(([id, label, points, neutral]) => ({ id, label, points, ...(neutral ? { neutral } : {}) }));

// ---------- Paso 2: ingresos y gastos (capacidad de pago, 30 pts) ----------
/** Oficio: no suma puntos en las reglas, lo usa el modelo de ML (src/lib/riesgo-ml.ts) */
export const SECTORS = [
  { id: "tienda_barrio", label: "Tienda de barrio o miscelánea" },
  { id: "comidas_rapidas", label: "Venta de comidas (arepas, empanadas, almuerzos)" },
  { id: "venta_ambulante", label: "Venta ambulante o en la calle" },
  { id: "plaza_mercado", label: "Puesto en plaza de mercado" },
  { id: "confeccion", label: "Confección o modistería" },
  { id: "belleza", label: "Belleza (peluquería, uñas)" },
  { id: "transporte_moto", label: "Transporte o domicilios en moto" },
  { id: "servicio_domestico", label: "Servicio doméstico o aseo por días" },
  { id: "reciclaje", label: "Reciclaje" },
  { id: "artesanias", label: "Artesanías" },
  { id: "otro", label: "Otro" },
];
export const VARIABILITY = opts(["parecidos", "Son muy parecidos", 6], ["algo", "Varían algo", 3], ["mucho", "Varían mucho", 0]);
export const ACTIVITY_AGE = opts(["lt6", "Menos de 6 meses", 0], ["6a11", "6 a 11 meses", 2], ["1a2", "1 a 2 años", 3], ["gt2", "2 años o más", 4]);
export const YES_NO = opts(["si", "Sí", 0], ["no", "No", 0]);

// ---------- Paso 3: pagos del hogar (historial, 30 pts) ----------
export const UTILITIES = opts(
  ["siempre", "Siempre a tiempo", 10],
  ["1a2", "1 o 2 retrasos", 6],
  ["3mas", "3 o más retrasos", 2],
  ["cortaron", "Me cortaron el servicio", 0],
  ["noyo", "No los pago yo", 4, true],
);
export const RENT = opts(["siempre", "Siempre a tiempo", 6], ["aveces", "A veces tarde", 3], ["debo", "Muchas veces tarde o debo", 0], ["propia", "Vivienda propia o familiar", 4, true]);
export const PHONE_PLAN = opts(["plan", "Plan al día", 4], ["semana", "Recargo cada semana", 3], ["veces", "Recargo de vez en cuando", 1]);
export const SAVINGS_GROUP = opts(["cumplo", "Participo y siempre cumplo", 6], ["atraso", "Participo y a veces me atraso", 3], ["no", "No participo", 2, true]);
export const CREDIT_PURCHASES = opts(["aldia", "Pagadas o al día", 4], ["atrasos", "Pagadas con atrasos", 2], ["mora", "En mora", 0], ["nunca", "Nunca he comprado a crédito", 2, true]);

// ---------- Paso 4: estabilidad (10 pts) ----------
export const HOUSING_AGE = opts(["lt1", "Menos de 1 año", 1], ["1a2", "1 a 2 años", 3], ["gt2", "Más de 2 años", 4]);
export const WORKPLACE = opts(["fijo", "Local o puesto fijo", 3], ["ruta", "Ruta o zona fija", 2], ["cambia", "Cambia mucho", 1]);
export const PHONE_OWNER = opts(["si", "Sí", 3], ["no", "No", 1]);

// ---------- Paso 5: cómo manejas la plata (20 pts). 1 = nada de acuerdo, 5 = totalmente de acuerdo ----------
/** `reverse`: redactada al revés, puntúa como 6 − respuesta (afirmaciones 3, 5, 7, 9 y 11) */
export const LIKERT = [
  { text: "Antes de gastar, separo la plata de lo que tengo que pagar.", reverse: false },
  { text: "Cuando prometo pagar algo en una fecha, lo cumplo aunque me toque sacrificar otra cosa.", reverse: false },
  { text: "Si me sobra plata, prefiero gastarla de una vez que guardarla.", reverse: true },
  { text: "Llevo cuentas (en un cuaderno o en el celular) de lo que entra y lo que sale.", reverse: false },
  { text: "No pagarle a una empresa grande no le hace daño a nadie.", reverse: true },
  { text: "Cuando tengo un problema de plata, busco a quien le debo para llegar a un acuerdo.", reverse: false },
  { text: "Muchas veces compro cosas que no tenía planeadas.", reverse: true },
  { text: "Termino lo que empiezo, aunque sea difícil.", reverse: false },
  { text: "Si me atraso en un pago, prefiero no contestar el teléfono.", reverse: true },
  { text: "Pienso en cómo estará mi negocio dentro de seis meses.", reverse: false },
  { text: "A veces dejo pasar fechas de pago sin avisar.", reverse: true },
];
export const TIME_PREFERENCE = opts(["hoy", "$100.000 hoy", 0], ["mes", "$120.000 dentro de un mes", 3]);

// ---------- Paso 6: referencias (10 pts) ----------
export const RELATIONS = ["Proveedor", "Cliente frecuente", "Administradora de la natillera", "Arrendador", "Líder comunitario", "Otro"];

// ---------- Documentos opcionales (lectura simulada: subir el archivo cuenta como documento) ----------
export const DOCS = {
  extracto: "Extracto de tu cuenta o billetera",
  factura: "Tu última factura de servicios (sirve aunque esté a nombre de otra persona)",
  arriendo: "Recibo de arriendo",
  recargas: "Captura del historial de recargas",
  libreta: "Foto de la libreta de la natillera o cadena",
  pazysalvo: "Paz y salvo o recibo de compras a crédito",
} as const;
export type DocKey = keyof typeof DOCS;
export const DOC_KEYS = Object.keys(DOCS) as DocKey[];

export interface Reference {
  name: string;
  phone: string;
  relation: string;
  /** Si la relación es "Otro", cuál */
  relationOther: string;
  /** Pedir confirmación por mensaje (simulado: se da por confirmada) */
  notify: boolean;
}

export interface StudyAnswers {
  confirmAdult: boolean;
  consent: boolean;
  sector: string;
  /** Personas que dependen de sus ingresos (solo lo usa el modelo de ML) */
  dependents: string;
  income: string;
  expenses: string;
  debts: string;
  loanShark: string;
  variability: string;
  activityAge: string;
  utilities: string;
  rent: string;
  phonePlan: string;
  savingsGroup: string;
  creditPurchases: string;
  housingAge: string;
  workplace: string;
  phoneOwner: string;
  likert: (number | null)[];
  timePref: string;
  references: Reference[];
}

const emptyRef = (): Reference => ({ name: "", phone: "", relation: "", relationOther: "", notify: false });

export const EMPTY_STUDY: StudyAnswers = {
  confirmAdult: false,
  consent: false,
  sector: "",
  dependents: "",
  income: "",
  expenses: "",
  debts: "",
  loanShark: "",
  variability: "",
  activityAge: "",
  utilities: "",
  rent: "",
  phonePlan: "",
  savingsGroup: "",
  creditPurchases: "",
  housingAge: "",
  workplace: "",
  phoneOwner: "",
  likert: LIKERT.map(() => null),
  timePref: "",
  references: [emptyRef(), emptyRef()],
};

export const STUDY_STEPS = [
  { title: "Antes de empezar", sub: "Tus datos solo se usan para evaluar tu crédito." },
  { title: "Tus ingresos y gastos", sub: "Nos ayuda a calcular una cuota que sí puedas pagar." },
  { title: "Los pagos de tu hogar", sub: "Cómo pagas tus cuentas dice mucho de ti. Subir un documento te da más puntos." },
  { title: "Tu estabilidad", sub: "Unas preguntas cortas sobre dónde vives y trabajas." },
  { title: "Cómo manejas la plata", sub: "No hay respuestas buenas ni malas: responde con sinceridad." },
  { title: "Tus referencias", sub: "Personas que te conocen y pueden confirmar que cumples. No familiares directos." },
];

export type StudyErrors = Record<string, string>;

const pick = (list: Option[], id: string) => list.find((o) => o.id === id);
const num = (v: string) => Number(v);
const refComplete = (r: Reference) => Boolean(r.name.trim() && r.phone.trim() && r.relation);

/** Errores por campo de un paso (vacío si está completo). Las claves coinciden con los campos de la pantalla. */
export function studyErrors(step: number, a: StudyAnswers): StudyErrors {
  const e: StudyErrors = {};
  const need = (key: keyof StudyAnswers, list: Option[], msg = "Elige una opción") => {
    if (!pick(list, a[key] as string)) e[key] = msg;
  };
  if (step === 0) {
    if (!a.confirmAdult) e.confirmAdult = "Debes confirmar que eres mayor de edad";
    if (!a.consent) e.consent = "Necesitamos tu autorización para evaluar tu crédito";
  }
  if (step === 1) {
    if (!SECTORS.some((s) => s.id === a.sector)) e.sector = "Elige a qué te dedicas";
    if (!/^\d{1,2}$/.test(a.dependents ?? "") || num(a.dependents) > 15) e.dependents = "Escribe cuántas personas (0 si nadie depende de ti)";
    if (!(num(a.income) > 0)) e.income = "Ingresa cuánto te entra al mes";
    if (a.expenses === "" || num(a.expenses) < 0) e.expenses = "Ingresa cuánto gasta tu hogar al mes (puede ser 0)";
    if (a.debts === "" || num(a.debts) < 0) e.debts = "Ingresa cuánto pagas en deudas (si no tienes, escribe 0)";
    need("loanShark", YES_NO);
    need("variability", VARIABILITY);
    need("activityAge", ACTIVITY_AGE);
  }
  if (step === 2) {
    need("utilities", UTILITIES);
    need("rent", RENT);
    need("phonePlan", PHONE_PLAN);
    need("savingsGroup", SAVINGS_GROUP);
    need("creditPurchases", CREDIT_PURCHASES);
  }
  if (step === 3) {
    need("housingAge", HOUSING_AGE);
    need("workplace", WORKPLACE);
    need("phoneOwner", PHONE_OWNER);
  }
  if (step === 4) {
    a.likert.forEach((v, i) => {
      if (!(v && v >= 1 && v <= 5)) e[`likert${i}`] = "Elige un número del 1 al 5";
    });
    need("timePref", TIME_PREFERENCE);
  }
  if (step === 5) {
    a.references.forEach((r, i) => {
      const started = r.name.trim() || r.phone.trim() || r.relation;
      if (!started) return; // las referencias son opcionales
      const nameErr = validateName(r.name, "nombre");
      if (nameErr) e[`ref${i}name`] = nameErr.replace("tu nombre", "el nombre").replace("Tu nombre", "El nombre");
      const phoneErr = validatePhone(r.phone, "Colombiana");
      if (phoneErr) e[`ref${i}phone`] = phoneErr;
      if (!RELATIONS.includes(r.relation)) e[`ref${i}relation`] = "Elige la relación";
      else if (r.relation === "Otro" && !r.relationOther.trim()) e[`ref${i}relationOther`] = "Escribe qué relación tiene contigo";
    });
  }
  return e;
}

// ======================================================================
// Cálculo del perfil (solo en el servidor)
// ======================================================================

/**
 * Lo que se leyó de un documento. Con GEMINI_API_KEY lo lee la IA (src/lib/doc-reader.ts);
 * sin llave se usa `readingFromName` (trucos en el nombre del archivo, para la demo y el dataset).
 */
export interface DocReading {
  /** Se pudo leer y es del tipo de documento esperado: solo así respalda respuestas */
  valid: boolean;
  /** Señales de edición o falsificación: no respalda nada y excluye */
  altered: boolean;
  /** Extracto: ingreso mensual promedio (abonos/depósitos), en pesos */
  monthlyIncome: number | null;
  /** Factura, arriendo, paz y salvo o libreta: muestra mora, saldo vencido o corte */
  hasOverdue: boolean | null;
  holderName: string | null;
  issuer: string | null;
  documentDate: string | null;
  /** Qué se leyó, en una frase para el usuario */
  summary: string;
  /** Por qué no sirve (si valid es false) */
  reason: string | null;
  source: "gemini" | "simulado";
}

/** Lectura simulada a partir del nombre del archivo (trucos de demo: factura_mora, extracto_1000000, …alterad…) */
export function readingFromName(key: DocKey, fileName: string): DocReading {
  const n = fileName.toLowerCase();
  const altered = n.includes("alterad");
  const income = key === "extracto" ? Number(n.match(/extracto[_-]?(\d{4,})/)?.[1] ?? NaN) : NaN;
  return {
    valid: !altered,
    altered,
    monthlyIncome: income > 0 ? income : null,
    hasOverdue: key === "factura" ? n.includes("mora") : null,
    holderName: null,
    issuer: null,
    documentDate: null,
    summary: altered ? "El documento parece alterado." : "Documento recibido (lectura simulada).",
    reason: altered ? "Parece alterado" : null,
    source: "simulado",
  };
}

export const readingsFromNames = (names: Partial<Record<DocKey, string>>) =>
  Object.fromEntries((Object.entries(names) as [DocKey, string][]).map(([k, n]) => [k, readingFromName(k, n)])) as Partial<Record<DocKey, DocReading>>;

export interface StudyContext {
  /** Lo que se leyó de cada documento subido */
  docs: Partial<Record<DocKey, DocReading>>;
  /** Tiene un crédito con la plataforma con cuotas vencidas sin pagar */
  hasUnpaidLoan: boolean;
}

export interface StudyResult {
  score: number;
  /** 1 a 3 reciben crédito; 4 = no apto por ahora */
  riskLevel: RiskLevel;
  level: Level | null;
  breakdown: { key: string; label: string; points: number; max: number }[];
  /** % de los puntos de afirmaciones respaldados por un documento o un tercero */
  backing: number;
  /** Cuota quincenal máxima que puede asumir */
  maxInstallment: number;
  alerts: string[];
  /** Con 1 alerta el perfil queda marcado para revisión, sin cambiar el nivel */
  review: boolean;
  /** Nivel 4: razones concretas y qué puede cambiar */
  reasons: string[];
  recommendations: string[];
}

/** Cupo: el menor entre el techo del nivel y lo que alcanza a pagar con su cuota máxima, redondeado a miles hacia abajo */
export function creditLimit(level: Level, maxInstallment: number, installments: number) {
  const i = periodRate(LEVELS[level].rateEA, INSTALLMENT_DAYS);
  const pv = maxInstallment * ((1 - Math.pow(1 + i, -installments)) / i);
  return Math.floor(Math.min(LEVELS[level].maxAmount, pv) / 1000) * 1000;
}

export function computeStudy(a: StudyAnswers, ctx: StudyContext): StudyResult {
  for (let s = 0; s < STUDY_STEPS.length; s++) {
    const err = Object.values(studyErrors(s, a))[0];
    if (err) throw new Error(err);
  }

  const alerts: string[] = [];
  const exclusions: string[] = [];
  // Documento alterado → no respalda nada y excluye
  const altered = (Object.keys(ctx.docs) as DocKey[]).filter((k) => ctx.docs[k]?.altered);
  if (altered.length) exclusions.push("Uno de los documentos que subiste parece alterado.");
  // Solo respalda si se pudo leer y es del tipo esperado
  const hasDoc = (k: DocKey) => Boolean(ctx.docs[k]?.valid) && !altered.includes(k);

  // Referencias: la confirmación es simulada (si pidió enviarle mensaje, se da por confirmada)
  const refs = a.references.filter(refComplete).map((r) => ({ ...r, status: r.notify ? "confirmada" : "registrada" }));
  // Ganchos para cuando la confirmación sea real: "no_conoce" (alerta X3) y "no_cumple" (exclusión)
  const confirmedRelations = new Set(refs.filter((r) => r.status === "confirmada").map((r) => r.relation));

  const backingOf = (doc?: DocKey, relations: string[] = []): Backing =>
    relations.some((rel) => confirmedRelations.has(rel)) ? "confirmado" : doc && hasDoc(doc) ? "documento" : "declarado";

  // Acumuladores de puntos ponderados y del índice de respaldo
  let backedRaw = 0;
  let claimRaw = 0;
  const claim = (raw: number, backing: Backing, neutral = false) => {
    if (neutral) return raw;
    claimRaw += raw;
    if (backing !== "declarado") backedRaw += raw;
    return raw * CONFIG.factors[backing];
  };
  const opt = (list: Option[], id: string) => pick(list, id)!;

  // ---------- X2: extracto vs. ingreso declarado ----------
  let income = num(a.income);
  const extractIncome = hasDoc("extracto") ? (ctx.docs.extracto?.monthlyIncome ?? NaN) : NaN;
  if (extractIncome > 0 && income > extractIncome * CONFIG.incomeMismatch) {
    alerts.push("El ingreso que declaraste es mucho mayor que el de tu extracto: usamos el del extracto.");
    income = extractIncome;
  }
  const expenses = num(a.expenses);
  const debts = num(a.debts);
  const free = income - expenses - debts;
  const margin = free / income;
  const debtLoad = debts / income;

  // ---------- X4: presupuesto poco creíble ----------
  if (expenses + debts < income * CONFIG.implausibleBudget && !hasDoc("extracto"))
    alerts.push("Tus gastos y cuotas parecen muy bajos frente a tu ingreso y no hay extracto que lo respalde.");

  // ---------- Capacidad de pago (30) ----------
  const ext = backingOf("extracto");
  const marginPts = margin >= 0.3 ? 12 : margin >= 0.15 ? 8 : margin >= 0.05 ? 4 : 0;
  const debtPts = debtLoad <= 0.2 ? 8 : debtLoad <= 0.4 ? 5 : debtLoad <= 0.6 ? 2 : 0;
  const capacity =
    claim(marginPts, ext) +
    claim(debtPts, ext) +
    claim(opt(VARIABILITY, a.variability).points, ext) +
    claim(opt(ACTIVITY_AGE, a.activityAge).points, backingOf(undefined, ["Proveedor", "Cliente frecuente"]));

  // ---------- Historial de pagos (30) ----------
  let utilities = a.utilities;
  if (utilities === "siempre" && hasDoc("factura") && ctx.docs.factura?.hasOverdue) {
    alerts.push("Dijiste que pagas los servicios siempre a tiempo, pero la factura muestra mora: lo calificamos como 1 o 2 retrasos.");
    utilities = "1a2";
  }
  const item = (list: Option[], id: string, backing: Backing) => {
    const o = opt(list, id);
    return claim(o.points, backing, o.neutral);
  };
  const history =
    item(UTILITIES, utilities, backingOf("factura")) +
    item(RENT, a.rent, backingOf("arriendo", ["Arrendador"])) +
    item(PHONE_PLAN, a.phonePlan, backingOf("recargas")) +
    item(SAVINGS_GROUP, a.savingsGroup, backingOf("libreta", ["Administradora de la natillera"])) +
    item(CREDIT_PURCHASES, a.creditPurchases, backingOf("pazysalvo"));

  // ---------- Estabilidad (10) ----------
  const stability =
    item(HOUSING_AGE, a.housingAge, backingOf("factura")) +
    item(WORKPLACE, a.workplace, backingOf(undefined, ["Proveedor", "Cliente frecuente"])) +
    item(PHONE_OWNER, a.phoneOwner, "declarado");

  // ---------- Personalidad (20): no se multiplica, es una prueba ----------
  const adj = a.likert.map((v, i) => (LIKERT[i].reverse ? 6 - (v as number) : (v as number)));
  const s10 = adj.slice(0, 10).reduce((s, v) => s + v, 0);
  const statements = ((s10 - 10) / 40) * 14;
  const patience = opt(TIME_PREFERENCE, a.timePref).points;
  // X5: "cumplo lo que prometo pagar" (2) vs. "dejo pasar fechas sin avisar" invertida (11)
  const contradictory = Math.abs(adj[1] - adj[10]) >= 3;
  if (contradictory) alerts.push("Algunas respuestas sobre cómo cumples tus pagos se contradicen entre sí.");
  const personality = statements + patience + (contradictory ? 0 : 3);

  // ---------- Referencias (10): cada una de 0 a 5, no se multiplica ----------
  const references = Math.min(10, refs.reduce((s, r) => s + (r.status === "confirmada" ? 5 : 2), 0));

  const score = Math.round(capacity + history + stability + personality + references);
  const backing = claimRaw > 0 ? Math.round((backedRaw / claimRaw) * 100) : 0;

  // ---------- Del puntaje al nivel (en este orden) ----------
  let riskLevel: RiskLevel = CONFIG.thresholds.find((t) => score >= t.min)?.level ?? 4;
  // 1. Alertas: 1 → para revisión; 2 → baja un nivel
  const review = alerts.length === 1;
  if (alerts.length === 2) riskLevel = Math.min(4, riskLevel + 1) as RiskLevel;
  // 2. Carga de deuda alta: máximo nivel 3
  if (debtLoad > CONFIG.debtLoadLimit && riskLevel < 3) riskLevel = 3;
  // 3. Exclusiones: directo al nivel 4
  if (free <= 0) exclusions.unshift("Con tus ingresos, gastos y deudas actuales no te sobra plata: prestarte empeoraría tu situación.");
  if (alerts.length >= 3) exclusions.push("Hay varias inconsistencias entre tus respuestas y tus documentos.");
  if (ctx.hasUnpaidLoan) exclusions.push("Tienes un crédito con nosotros con cuotas vencidas sin pagar.");
  if (exclusions.length) riskLevel = 4;

  // Cuota máxima por quincena: 50 % del disponible diario × 15 días
  const maxInstallment = Math.max(0, Math.floor(((free / 30) * CONFIG.maxInstallmentShare) * INSTALLMENT_DAYS));

  // Si ni el crédito mínimo al plazo más largo cabe en su capacidad, no es apto por ahora
  if (riskLevel !== 4) {
    const cfg = LEVELS[riskLevel];
    const smallest = buildSchedule(MIN_LOAN, cfg.rateEA, Math.floor(cfg.maxDays / INSTALLMENT_DAYS), 0)[0].payment;
    if (maxInstallment < smallest) {
      riskLevel = 4;
      exclusions.push("Lo que te queda libre cada quincena no alcanza para la cuota del crédito más pequeño.");
    }
  }

  // ---------- Recomendaciones (niveles 1 a 3) o razones (nivel 4) ----------
  const recommendations: string[] = [];
  const reasons: string[] = [];
  if (riskLevel === 4) {
    reasons.push(...(exclusions.length ? exclusions : ["Tu puntaje todavía no alcanza el mínimo para un primer crédito."]));
    if (free <= 0) reasons.push("Qué puede cambiar: bajar tus gastos o terminar de pagar alguna deuda.");
    else if (altered.length) reasons.push("Qué puede cambiar: sube los documentos originales, sin modificaciones.");
    else if (ctx.hasUnpaidLoan) reasons.push("Qué puede cambiar: ponerte al día con tu crédito actual.");
    else reasons.push("Qué puede cambiar: respaldar tus respuestas con documentos y pedir a tus referencias que confirmen.");
  } else {
    if (!hasDoc("factura")) recommendations.push("Sube tu última factura de servicios: respalda tus pagos y el tiempo en tu vivienda.");
    if (a.savingsGroup !== "no" && backingOf("libreta", ["Administradora de la natillera"]) === "declarado")
      recommendations.push("Sube la foto de la libreta o pide a la administradora de la natillera que confirme.");
    if (refs.length === 0) recommendations.push("Agrega una referencia (proveedor, cliente o arrendador) y pídele que confirme.");
    else if (refs.some((r) => r.status !== "confirmada")) recommendations.push("Pide a tus referencias que confirmen: una referencia confirmada vale más del doble.");
    if (riskLevel >= 2) recommendations.push("Paga tu crédito a tiempo y subes un nivel.");
  }

  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    score,
    riskLevel,
    level: riskLevel === 4 ? null : riskLevel,
    backing,
    maxInstallment,
    alerts,
    review,
    reasons,
    recommendations,
    breakdown: [
      { key: "capacidad", label: "Capacidad de pago", points: r1(capacity), max: 30 },
      { key: "historial", label: "Pagos de tu hogar", points: r1(history), max: 30 },
      { key: "estabilidad", label: "Estabilidad", points: r1(stability), max: 10 },
      { key: "personalidad", label: "Manejo de la plata", points: r1(personality), max: 20 },
      { key: "referencias", label: "Referencias", points: r1(references), max: 10 },
    ],
  };
}
