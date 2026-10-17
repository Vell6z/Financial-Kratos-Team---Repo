import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { Level, LEVEL_IDS, LEVELS } from "./config";
import type { Installment } from "./finance";
import type { AccountRole } from "./registration";
import type { BrebKeyType } from "./breb-keys";
import type { MLAssessment } from "./riesgo-ml";
import type { IncomingRef, PaymentConfirmation, QuoteView } from "./openpayments";
import type { DocKey, DocReading, StudyAnswers, StudyResult } from "./scoring";
import { demoUsers } from "./demo-accounts";
import { seedDemoInvestments } from "./demo-seed";

// Persistencia mínima en un archivo JSON (suficiente para la demo; sin base de datos).

export type TxKind = "deposito_ilp" | "retiro_ilp" | "desembolso_breb" | "pago_breb";

export interface Tx {
  id: string;
  at: number;
  kind: TxKind;
  level: Level;
  amountCop: number;
  detail: string;
  mode: "interledger" | "simulado";
  /** Dueño del movimiento: wallet del inversionista o cédula del acreditado */
  wallet?: string;
  cedula?: string;
  /** Retiro: de qué aportes salió (para devolverlo exacto si el envío falla) */
  lots?: { id: string; amount: number; early: boolean }[];
  /** Inversión o retiro: datos para el comprobante (cotización y lo confirmado por quien recibe) */
  receipt?: TxReceipt;
}

export interface TxReceipt {
  /** Wallet del inversionista y de la bóveda */
  investorWallet: string;
  vaultWallet?: string;
  /** Monto pedido en pesos (puede diferir de amountCop si llegó solo una parte) */
  requestedCop: number;
  quote?: QuoteView;
  confirmation?: PaymentConfirmation | null;
  /** Aporte creado (inversión) y su vencimiento */
  lotId?: string;
  maturesAt?: number;
  /** Aporte precargado para la demo: no pasó por Interledger */
  demo?: boolean;
}

/** "Cajita" del inversionista en un nivel de riesgo */
export interface Position {
  id: string;
  wallet: string;
  level: Level;
  balance: number;
  deposited: number;
  withdrawn: number;
  lastAccrualAt: number;
  /** Cada aporte con su propio plazo (el balance de la cajita es la suma de sus valores) */
  lots?: Lot[];
  /** Formato anterior (un solo plazo por cajita): se convierte en un aporte al cargar */
  lockedUntil?: number;
  earlyWithdrawn?: number;
}

/** Un aporte a la cajita: renta a la tasa del nivel y tiene su propio plazo */
export interface Lot {
  id: string;
  at: number;
  principal: number;
  /** Valor actual (capital + rendimiento − retiros) */
  value: number;
  /** Fin del plazo de este aporte (un año). Antes, solo se puede sacar el 50 % */
  maturesAt: number;
  /** Lo retirado de este aporte antes de su plazo (cuenta para su tope del 50 %) */
  earlyWithdrawn: number;
}

export interface Applicant {
  cedula: string;
  name: string;
  score: number;
  scoreLevel: Level | null;
  recommendations: string[];
  breakdown: StudyResult["breakdown"];
  /** Cuota máxima (cada 15 días) según su capacidad de pago */
  maxInstallment: number;
  /** Nivel del modelo de riesgo: 1 a 3 reciben crédito, 4 = no apto por ahora */
  riskLevel: StudyResult["riskLevel"];
  backing: number;
  alerts: string[];
  review: boolean;
  /** Ajuste del modelo de Machine Learning sobre el nivel de reglas (src/lib/riesgo-ml.ts) */
  ml?: MLAssessment | null;
  /** Lo que se leyó de cada documento (IA o simulado) */
  docReadings?: Partial<Record<DocKey, DocReading>>;
  /** Nivel 4: razones y fecha (reloj de la demo) desde la que puede volver a solicitar */
  reasons: string[];
  retryAt?: number;
  answers: StudyAnswers;
  /** Rutas privadas de los documentos opcionales que adjuntó */
  docs: Partial<Record<DocKey, string>>;
  /** Créditos pagados completos y sin atrasos: cada uno sube un nivel */
  paidOnTime: number;
  evaluatedAt: number;
}

/** Estados del desembolso (en orden). Si la llave no se verifica, el crédito no se crea. */
export const DISBURSEMENT_STATES = [
  "CREDIT_APPROVED",
  "BREB_KEY_VERIFIED",
  "USER_CONFIRMED_BENEFICIARY",
  "TREASURY_DEBITED",
  "PAYOUT_SUBMITTED",
  "DISBURSED",
  /** La llave ya no está activa o cambió de titular al momento de desembolsar: no se paga */
  "BREB_KEY_REJECTED",
] as const;
export type DisbursementState = (typeof DISBURSEMENT_STATES)[number];

/** Payout de desembolso. Simulado: se arma el pedido exacto para Wompi, pero no se envía */
export interface Payout {
  id: string;
  /** Referencia del lote e idempotency key: el id del crédito (si se reintenta, no se paga dos veces) */
  reference: string;
  idempotencyKey: string;
  status: "SIMULATED_APPROVED";
  /** Directorio Bre-B donde se re-verificó la llave justo antes del payout */
  directory: "production" | "sandbox" | "simulado";
  checkedAt: number;
  beneficiary: { key: string; keyType: string; holderName: string; financialEntity: { name: string; code: string } };
  amountCop: number;
  /** Cuerpo que recibiría POST /payouts de Wompi (montos en centavos) */
  request: { reference: string; transactions: { amount: number; name: string; email: string; key: string }[] };
  submittedAt: number;
}

/** Resultado de consultar una llave en el directorio Bre-B: vale 5 minutos y solo para quien la verificó */
export interface BrebVerification {
  id: string;
  userId: string;
  key: string;
  keyType: BrebKeyType;
  holderName: string;
  financialEntity: { name: string; code: string };
  /** El titular enmascarado coincide con el nombre registrado */
  nameMatches: boolean;
  mode: "sandbox" | "production" | "simulado";
  status: "VERIFIED" | "USED";
  verifiedAt: number;
  expiresAt: number;
}

export interface Loan {
  id: string;
  cedula: string;
  name: string;
  /** Llave verificada en el directorio Bre-B (no la que escribió el usuario) */
  llaveBreb: string;
  breb?: {
    verificationId: string;
    keyType: BrebKeyType;
    holderName: string;
    financialEntity: { name: string; code: string };
    mode: BrebVerification["mode"];
    verifiedAt: number;
    confirmedAt: number;
  };
  disbursement?: {
    state: DisbursementState;
    history: { state: DisbursementState; at: number }[];
    /** Referencia e idempotency key del payout: el id del crédito */
    reference: string;
    /** Por qué se bloqueó el desembolso */
    rejectedReason?: string;
  };
  /** Payout Bre-B simulado: lo que se le enviaría a Wompi, sin mover dinero */
  payout?: Payout;
  level: Level;
  rateEA: number;
  amount: number;
  installments: number;
  schedule: Installment[];
  /** en_espera incluye el desembolso en proceso; cancelado = la llave no pasó la verificación al desembolsar */
  status: "en_espera" | "activo" | "pagado" | "cancelado";
  createdAt: number;
  disbursedAt?: number;
}

/** Pago de Open Payments esperando que el usuario lo apruebe en su wallet */
export interface PendingPayment {
  id: string;
  kind: "deposit" | "withdraw";
  wallet: string;
  level: Level;
  amountCop: number;
  senderWallet: string;
  senderResourceServer: string;
  quoteId: string;
  continueUri: string;
  continueToken: string;
  clientNonce?: string;
  interactNonce?: string;
  authServer?: string;
  quote?: QuoteView;
  incoming?: IncomingRef;
  createdAt: number;
}

/** Resultado de la verificación facial del registro, sin imágenes. Para auditoría y revisión del admin. */
export interface FaceCheck {
  /** Modo con el que se verificó: local (gratis), un IDV de pago, o sin cámara (lo revisa el operador) */
  mode: "local" | "provider" | "sin_camara";
  /** ¿Pasó el reto de giro de cabeza? */
  liveness: boolean;
  /** Giro máximo de cabeza detectado, en grados */
  yawRange: number;
  /** Distancia 1:1 entre la selfie y el documento (menor = más parecidos) */
  documentDistance: number;
  /** Menor distancia encontrada en la deduplicación 1:N (null si la base estaba vacía) */
  dedupDistance: number | null;
  /** Si hubo un parecido en zona gris, a qué cédula (para que el operador compare) */
  dedupMatchCedula?: string;
  challenge: "turn_head" | "none";
  /** Por qué quedó en revisión del operador */
  reviewReason?: "parecido" | "duplicado_probable" | "sin_camara";
  at: number;
}

export interface User {
  id: string;
  role: AccountRole;
  firstName: string;
  lastName: string;
  /** Nombre completo */
  name: string;
  email: string;
  cedula: string;
  phone: string;
  nationality: string;
  age: number;
  sex: string;
  address: string;
  passwordHash: string;
  salt: string;
  /** Wallet address de Interledger (inversionista) */
  wallet?: string;
  investorProfile?: {
    monthlyIncome: number;
    currency: string;
    incomeSource: string;
    employment: "independiente" | "asalariado";
  };
  borrowerProfile?: {
    incomeSource: string;
    monthlyIncomeCop: number;
    llaveBreb: string;
  };
  /** Rutas privadas (no públicas) de las copias del documento de identidad */
  documents: { idFront: string; idBack: string };
  /**
   * Estado de la verificación facial del registro:
   * - "aprobada": liveness + match 1:1 pasaron y no hubo duplicado.
   * - "pendiente": zona gris de deduplicación, a la espera de revisión del operador (admin).
   * - "rechazada": el operador la rechazó (duplicado confirmado o identidad no coincide).
   */
  faceVerification: "pendiente" | "aprobada" | "rechazada";
  /**
   * Vector facial geométrico para deduplicar (src/lib/face-descriptor.ts), CIFRADO en reposo
   * (AES-256-GCM, ver faceverify.ts). NUNCA se guarda la imagen de la cara, solo este descriptor.
   */
  faceDescriptor?: string;
  /** Rastro del resultado de la verificación, sin imágenes (para auditoría y revisión). */
  faceCheck?: FaceCheck;
  /** Hasta cuándo (reloj de la demo) vio sus notificaciones */
  notificationsSeenAt?: number;
  createdAt: number;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: number;
}

export interface Pool {
  /** Dinero disponible para prestar o para retiros */
  liquidity: number;
  /** Capital actualmente prestado */
  lent: number;
}

/**
 * Permiso del operador para que la plataforma envíe pagos desde la bóveda sin aprobar cada retiro.
 * Es un grant de Open Payments con un tope total (`limit`); el token se rota cuando vence.
 */
export interface VaultGrant {
  accessToken: string;
  manageUrl: string;
  /** Cuándo vence el token (ms). null = el servidor no indicó vencimiento */
  tokenExpiresAt: number | null;
  limit: { value: string; assetCode: string; assetScale: number };
  /** Lo que ya se envió con este permiso, en la unidad mínima del activo */
  spent: string;
  grantedAt: number;
}

/** Autorización de la bóveda esperando que el operador apruebe en la wallet */
export interface PendingVaultGrant {
  continueUri: string;
  continueToken: string;
  clientNonce: string;
  interactNonce: string;
  authServer: string;
  limit: VaultGrant["limit"];
  createdAt: number;
}

export interface DB {
  users: User[];
  sessions: Session[];
  clockOffsetMs: number;
  pools: Record<Level, Pool>;
  positions: Position[];
  applicants: Applicant[];
  loans: Loan[];
  txs: Tx[];
  pending: PendingPayment[];
  brebVerifications: BrebVerification[];
  vaultGrant?: VaultGrant | null;
  pendingVaultGrant?: PendingVaultGrant | null;
  /** Versión de las inversiones precargadas de la cuenta demo (src/lib/demo-seed.ts). `true` = versión 1 */
  demoSeeded?: number | boolean;
}

const DB_PATH = path.join(process.cwd(), "data", "db.json");

export function emptyDB(): DB {
  return {
    users: [],
    sessions: [],
    clockOffsetMs: 0,
    pools: Object.fromEntries(LEVEL_IDS.map((l) => [l, { liquidity: LEVELS[l].seed, lent: 0 }])) as Record<Level, Pool>,
    positions: [],
    applicants: [],
    loans: [],
    txs: [],
    pending: [],
    brebVerifications: [],
  };
}

async function load(): Promise<DB> {
  let db: DB;
  try {
    db = { ...emptyDB(), ...JSON.parse(await fs.readFile(DB_PATH, "utf8")) } as DB;
  } catch {
    // Base nueva: las cuentas demo se agregan abajo
    db = emptyDB();
  }
  // Garantiza que existan las cuentas demo (también las que se agreguen después) y sus inversiones precargadas.
  // Va fuera del try: un error aquí no debe confundirse con una base nueva
  for (const demo of demoUsers()) if (!db.users.some((u) => u.id === demo.id)) db.users.push(demo);
  seedDemoInvestments(db, now(db));
  return db;
}

async function save(db: DB) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

let queue: Promise<unknown> = Promise.resolve();

/** Ejecuta `fn` con acceso exclusivo a la base y guarda los cambios. */
export function withDB<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    await save(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export const readDB = () => withDB((db) => db);

export const now = (db: DB) => Date.now() + db.clockOffsetMs;

export const newId = () => crypto.randomUUID().slice(0, 8);
