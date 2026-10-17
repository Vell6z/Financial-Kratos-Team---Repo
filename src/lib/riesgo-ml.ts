import { INSTALLMENT_DAYS, LEVELS, type Level } from "./config";
import { buildSchedule } from "./finance";
import { creditLimit, type DocKey, type DocReading, type RiskLevel, type StudyAnswers } from "./scoring";
import model from "../../ml/modelo/regresion_logistica.json";

// Modelo de Machine Learning que ajusta el nivel del estudio (solo en el servidor).
// Los pesos salen de `python3 ml/train_baseline.py`. Las variables deben calcularse
// exactamente igual que `features()` en ese archivo: si cambian una, cambien la otra.
// Explicación: ml/README.md

export const ML_POLICY = {
  /** Con probabilidad de atraso menor a esto, sube un nivel (solo niveles 2 y 3) */
  upgradeBelow: 0.04,
  /** Con probabilidad mayor a esto, baja un nivel (de nivel 3 pasa a no apto) */
  downgradeAbove: 0.3,
};

/** Una solicitud con los nombres de columna del dataset. Lo que falta se reemplaza por el promedio. */
export type MLRecord = Partial<Record<string, string | number>>;

const RELATIONS = ["Proveedor", "Cliente frecuente", "Administradora de la natillera", "Arrendador", "Líder comunitario", "Otro"];
const CATEGORICAL = [
  "ciudad", "escolaridad", "sector", "gota_a_gota", "variabilidad", "antiguedad_actividad", "servicios",
  "arriendo", "plan_celular", "natillera", "compras_credito", "antiguedad_vivienda", "lugar_trabajo",
  "celular_propio", "preferencia_tiempo",
];

const num = (v: string | number | undefined, fallback = 0) => (v === undefined || v === "" ? fallback : Number(v));

/** Port de `features()` de ml/train_baseline.py. Devuelve las variables y los grupos sin dato. */
export function mlFeatures(r: MLRecord) {
  const f: Record<string, number> = {};
  const missing = new Set<string>();
  const income = num(r.ingreso_declarado);
  const extract = num(r.ingreso_extracto);
  f.log_ingreso_declarado = Math.log1p(income);
  f.gastos_sobre_ingreso = num(r.gastos_declarados) / income;
  f.deudas_sobre_ingreso = num(r.deudas_declaradas) / income;
  f.margen_declarado = num(r.disponible_declarado) / income;
  f.tiene_extracto = extract ? 1 : 0;
  f.ingreso_vs_extracto = extract ? Math.log(income / extract) : 0;
  for (const col of [
    "edad", "estrato", "personas_a_cargo", "referencias", "referencias_confirmadas",
    "doc_extracto", "doc_factura", "doc_arriendo", "doc_recargas", "doc_libreta", "doc_pazysalvo",
    "factura_con_mora", "doc_alterado",
  ]) {
    if (r[col] === undefined) missing.add(col);
    f[col] = num(r[col]);
  }
  for (let i = 1; i <= 11; i++) f[`likert_${i}`] = num(r[`likert_${i}`]);
  const logOf = (col: string, name: string) => {
    if (r[col] === undefined) missing.add(name);
    f[name] = Math.log1p(num(r[col]));
  };
  logOf("antiguedad_linea_meses", "log_antiguedad_linea");
  logOf("recargas_mes", "log_recargas_mes");
  logOf("transacciones_billetera_mes", "log_transacciones_billetera");
  f.log_monto = Math.log1p(num(r.monto));
  f.cuotas = num(r.cuotas);
  f.tasa_ea = num(r.tasa_ea);
  f.cuota_sobre_disponible = Math.min(3, num(r.cuota_sobre_disponible, 3));
  f.cuota_sobre_ingreso = (num(r.valor_cuota) * 2) / income;
  for (const col of CATEGORICAL) {
    if (r[col] === undefined) missing.add(`${col}=`);
    else f[`${col}=${r[col]}`] = 1;
  }
  const relations = r.referencias_relaciones ? String(r.referencias_relaciones).split("|") : [];
  for (const rel of RELATIONS) f[`ref_${rel}`] = relations.filter((x) => x === rel).length;
  return { f, missing };
}

/** Grupos para explicar la decisión en palabras simples */
const GROUPS: [RegExp, string][] = [
  [/^personas_a_cargo$/, "Las personas que dependen de ti"],
  [/^(log_ingreso_declarado|gastos_sobre_ingreso|deudas_sobre_ingreso|margen_declarado|ingreso_vs_extracto|tiene_extracto)$/, "Tu presupuesto: ingresos, gastos y deudas"],
  [/^(log_monto|cuotas|tasa_ea|cuota_sobre_disponible|cuota_sobre_ingreso)$/, "El tamaño de la cuota frente a lo que te sobra"],
  [/^(referencias|referencias_confirmadas|ref_)/, "Tus referencias"],
  [/^(doc_|factura_con_mora)/, "Los documentos que subiste"],
  [/^(servicios|arriendo|plan_celular|natillera|compras_credito)=/, "Cómo pagas las cuentas de tu hogar"],
  [/^(antiguedad_actividad|variabilidad)=/, "La antigüedad y estabilidad de tus ingresos"],
  [/^(antiguedad_vivienda|lugar_trabajo|celular_propio)=/, "Tu estabilidad en vivienda y trabajo"],
  [/^(likert_|preferencia_tiempo=)/, "Cómo manejas la plata"],
  [/^sector=/, "Tu oficio"],
  [/^gota_a_gota=/, "Deudas con gota a gota"],
  [/^edad$/, "Tu edad"],
];

/** Qué puede hacer la persona según lo que pesó en contra */
const HINTS: Record<string, string> = {
  "Deudas con gota a gota": "terminar de pagar el gota a gota",
  "Tu presupuesto: ingresos, gastos y deudas": "bajar tus gastos o tus deudas",
  "Tus referencias": "pedir a tus referencias que confirmen",
  "Los documentos que subiste": "subir documentos que respalden tus respuestas",
  "Cómo pagas las cuentas de tu hogar": "ponerte al día con las cuentas de tu hogar",
  "La antigüedad y estabilidad de tus ingresos": "darle más tiempo a tu negocio",
};

export function mlHint(against: string[]) {
  const hints = against.map((g) => HINTS[g]).filter(Boolean).slice(0, 2);
  return `Qué puede cambiar: ${hints.length ? hints.join(" o ") : "respaldar tus respuestas con documentos y referencias que confirmen"}.`;
}

/** Probabilidad de mora de 30 días o más, y qué grupos de respuestas pesaron a favor y en contra */
export function predictDefault(r: MLRecord) {
  const { f, missing } = mlFeatures(r);
  let z = model.intercepto;
  const byGroup = new Map<string, number>();
  for (const v of model.variables) {
    // Sin dato: se usa el promedio del entrenamiento (aporta 0)
    if ([...missing].some((m) => v.nombre === m || (m.endsWith("=") && v.nombre.startsWith(m)))) continue;
    const contribution = v.peso * (((f[v.nombre] ?? 0) - v.media) / v.desviacion);
    z += contribution;
    const group = GROUPS.find(([re]) => re.test(v.nombre))?.[1];
    if (group) byGroup.set(group, (byGroup.get(group) ?? 0) + contribution);
  }
  const ranked = [...byGroup].filter(([, c]) => Math.abs(c) >= 0.15).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return {
    probability: 1 / (1 + Math.exp(-z)),
    against: ranked.filter(([, c]) => c > 0).slice(0, 3).map(([g]) => g),
    inFavor: ranked.filter(([, c]) => c < 0).slice(0, 3).map(([g]) => g),
  };
}

/** Arma la solicitud con las respuestas del estudio y un crédito de referencia del nivel */
export function recordFromStudy(
  a: StudyAnswers,
  docs: Partial<Record<DocKey, DocReading>>,
  age: number,
  loan: { level: Level; amount: number; installments: number },
): MLRecord {
  const income = Number(a.income);
  const free = income - Number(a.expenses) - Number(a.debts);
  const altered = Object.values(docs).some((d) => d?.altered);
  const extract = docs.extracto?.valid ? docs.extracto.monthlyIncome : null;
  const refs = a.references.filter((r) => r.name.trim() && r.phone.trim() && r.relation);
  const payment = buildSchedule(loan.amount, LEVELS[loan.level].rateEA, loan.installments, 0)[0].payment;
  const r: MLRecord = {
    edad: age,
    personas_a_cargo: Math.min(6, Number(a.dependents)),
    ingreso_declarado: income,
    gastos_declarados: Number(a.expenses),
    deudas_declaradas: Number(a.debts),
    disponible_declarado: free,
    gota_a_gota: a.loanShark,
    variabilidad: a.variability,
    antiguedad_actividad: a.activityAge,
    servicios: a.utilities,
    arriendo: a.rent,
    plan_celular: a.phonePlan,
    natillera: a.savingsGroup,
    compras_credito: a.creditPurchases,
    antiguedad_vivienda: a.housingAge,
    lugar_trabajo: a.workplace,
    celular_propio: a.phoneOwner,
    preferencia_tiempo: a.timePref,
    referencias: refs.length,
    referencias_confirmadas: refs.filter((x) => x.notify).length,
    referencias_relaciones: refs.map((x) => x.relation).join("|"),
    ingreso_extracto: extract && !altered ? extract : "",
    factura_con_mora: docs.factura?.hasOverdue ? 1 : 0,
    doc_alterado: altered ? 1 : 0,
    monto: loan.amount,
    cuotas: loan.installments,
    tasa_ea: LEVELS[loan.level].rateEA,
    valor_cuota: payment,
    cuota_sobre_disponible: free > 0 ? payment / (free / 2) : "",
  };
  // Oficio "Otro" no estaba en el entrenamiento: se trata como sin dato
  if (a.sector !== "otro") r.sector = a.sector;
  a.likert.forEach((v, i) => (r[`likert_${i + 1}`] = v ?? 3));
  for (const k of ["extracto", "factura", "arriendo", "recargas", "libreta", "pazysalvo"] as DocKey[]) r[`doc_${k}`] = docs[k] && (docs[k]!.valid || docs[k]!.altered) ? 1 : 0; // como en el dataset: alterado cuenta como subido
  return r;
}

export interface MLAssessment {
  probability: number;
  /** Nivel que daban solo las reglas */
  rulesLevel: RiskLevel;
  /** +1 subió un nivel, −1 bajó un nivel */
  adjustment: -1 | 0 | 1;
  against: string[];
  inFavor: string[];
}

/** Crédito de referencia para evaluar: el plazo más largo del nivel y el 70 % del cupo */
export function referenceLoan(level: Level, maxInstallment: number) {
  const installments = Math.floor(LEVELS[level].maxDays / INSTALLMENT_DAYS);
  const amount = Math.max(100_000, Math.round((creditLimit(level, maxInstallment, installments) * 0.7) / 10_000) * 10_000);
  return { level, amount, installments };
}

/** Ajusta el nivel de reglas con el modelo. Nunca sube a quien las reglas dejaron en nivel 4. */
export function assessWithML(
  a: StudyAnswers,
  docs: Partial<Record<DocKey, DocReading>>,
  age: number,
  rulesLevel: RiskLevel,
  maxInstallment: number,
): MLAssessment | null {
  if (rulesLevel === 4) return null;
  const p = predictDefault(recordFromStudy(a, docs, age, referenceLoan(rulesLevel, maxInstallment)));
  const adjustment = p.probability > ML_POLICY.downgradeAbove ? -1 : p.probability < ML_POLICY.upgradeBelow && rulesLevel > 1 ? 1 : 0;
  return { probability: p.probability, rulesLevel, adjustment, against: p.against, inFavor: p.inFavor };
}
