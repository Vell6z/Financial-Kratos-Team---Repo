import type { Level } from "@/lib/config";

// Lo que devuelve GET /api/state para el panel del operador

export type InstallmentState = "PENDIENTE" | "POR_PAGAR" | "PAGADA" | "EN_MORA" | "PAGADA_CON_MORA";

export interface AuditEventView {
  id: string;
  seq: number;
  at: number;
  demoAt: number;
  category: string;
  action: string;
  actor: { type: "usuario" | "operador" | "sistema"; id?: string; name?: string; role?: string };
  entity?: { type: string; id: string };
  summary: string;
  data?: Record<string, string | number | boolean | null>;
  ip?: string;
  prevHash: string;
  hash: string;
}

export interface LoanRow {
  id: string;
  name: string;
  cedula: string;
  level: Level;
  amount: number;
  installments: number;
  status: "en_espera" | "activo" | "pagado" | "cancelado";
  purpose: string | null;
  createdAt: number;
  disbursedAt: number | null;
  owed: number;
  overdue: boolean;
  daysLate: number;
  chargedOffAt: number | null;
  paidCount: number;
  schedule: { n: number; dueAt: number; payment: number; state: InstallmentState; daysLate: number; paidAt: number | null }[];
  disbursement: { state: string; history: { state: string; at: number }[]; rejectedReason: string | null } | null;
  payout: { id: string; directory: string; bank: string; key: string } | null;
  creditReport: { status: "aviso" | "al_dia" | "en_mora" | "pagada"; noticeAt: number; reportedAt?: number; paidAt?: number } | null;
  disbursementTxId: string | null;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  cedula: string;
  role: "inversor" | "acreditado" | "admin";
  createdAt: number;
  faceVerification: "pendiente" | "aprobada" | "rechazada";
  suspended: { at: number; reason: string; by: string } | null;
  wallet: string | null;
  study: { score: number; level: Level | null; blockedUntil: number | null; creditScore: number } | null;
  loans: number;
  balance: number;
}

export interface State {
  now: number;
  clockOffsetDays: number;
  interledger: boolean;
  vaultGrant: { grantedAt: number; assetCode: string; limit: number; spent: number } | null;
  pools: Record<Level, { liquidity: number; lent: number }>;
  investorBalance: number;
  kpis: { portfolio: number; overdue: number; par30: number; chargedOff: number; disbursed: number; collected: number; invested: number; withdrawn: number };
  loans: LoanRow[];
  users: UserRow[];
  positions: { id: string; wallet: string; owner: string | null; level: Level; balance: number; deposited: number; withdrawn: number; lots: number; nextMaturity: number | null }[];
  recurring: {
    id: string;
    wallet: string;
    owner: string | null;
    level: Level;
    mode: string;
    amountCop: number;
    debit: { value: number; assetCode: string } | null;
    intervalLabel: string;
    status: "activa" | "pausada";
    runs: number;
    nextRunAt: number | null;
    lastError: string | null;
  }[];
  txs: { id: string; at: number; kind: string; level: Level; amountCop: number; detail: string; mode: string; hasReceipt: boolean }[];
  creditReports: {
    loanId: string;
    name: string;
    level: Level;
    status: "aviso" | "en_mora" | "pagada";
    noticeAt: number;
    reportedAt?: number;
    paidAt?: number;
    chargedOffAt: number | null;
    snapshot?: { overdueBalance: number; amount: number };
  }[];
  faceReviews: {
    id: string;
    name: string;
    cedula: string;
    at: number;
    dedupDistance: number | null;
    dedupMatchCedula: string | null;
    yawRange: number;
    mode: string;
    reason: "parecido" | "duplicado_probable" | "sin_camara";
  }[];
  audit: { total: number; broken: { seq: number; reason: string } | null; latest: AuditEventView[] };
}

export const TX_KIND: Record<string, { label: string; sign: string }> = {
  deposito_ilp: { label: "Inversión · Interledger", sign: "+" },
  retiro_ilp: { label: "Retiro · Interledger", sign: "−" },
  desembolso_breb: { label: "Desembolso · Bre-B", sign: "−" },
  pago_breb: { label: "Pago de cuota · Bre-B", sign: "+" },
};

export const AUDIT_CATEGORIES: Record<string, string> = {
  acceso: "Acceso",
  identidad: "Identidad",
  estudio: "Estudio",
  credito: "Crédito",
  pago: "Pagos",
  inversion: "Inversión",
  boveda: "Bóveda",
  mora: "Mora y reportes",
  operador: "Operador",
  demo: "Demo",
};

/** "17 oct 2026, 3:40 p. m." */
export const fmtDateTime = (ms: number) =>
  new Date(ms).toLocaleString("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export type TabId = "resumen" | "cartera" | "usuarios" | "inversiones" | "movimientos" | "auditoria";

/** Llama una acción del operador (/api/admin) y recarga. Devuelve true si salió bien */
export type AdminAction = (body: Record<string, unknown>, done: { title: string; text?: string; tone?: "success" | "info" }) => Promise<boolean>;
