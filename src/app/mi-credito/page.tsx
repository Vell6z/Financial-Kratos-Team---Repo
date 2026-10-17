"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useToast } from "@/components/feedback";
import { Alert, Badge, Button, Card, EmptyState, MoneyInput, PageHeader, Spinner, Stat, api, fmtDate } from "@/components/ui";
import { bankName } from "@/lib/breb-keys";
import { APP_NAME, LEVELS, MIN_PAYMENT, VAULT_BREB, type Level } from "@/lib/config";
import type { Installment } from "@/lib/finance";
import { cop, pct } from "@/lib/finance";

interface LoanView {
  id: string;
  level: Level;
  amount: number;
  rateEA: number;
  installments: number;
  llaveBreb: string;
  breb?: { holderName: string; financialEntity: { name: string } };
  status: "en_espera" | "activo" | "pagado" | "cancelado";
  createdAt: number;
  disbursement?: { state: string; rejectedReason?: string; history: { state: string; at: number }[] };
  payout?: {
    id: string;
    reference: string;
    idempotencyKey: string;
    directory: "production" | "sandbox" | "simulado";
    checkedAt: number;
    beneficiary: { key: string; keyType: string; holderName: string; financialEntity: { name: string; code: string } };
    amountCop: number;
    request: unknown;
    submittedAt: number;
  };
  schedule: (Installment & { state: InstallmentState; daysLate: number; deadline: number })[];
  overdue: boolean;
  daysLate: number;
  daysToNext: number | null;
  now: number;
  nextInstallment: Installment | null;
  /** Lo que falta de la próxima cuota (descontando abonos) y el saldo total */
  nextDue: number;
  owed: number;
  disbursedAt?: number;
  /** Para el comprobante del desembolso en PDF */
  disbursementTxId: string | null;
  /** Solicitud de pago (simulada) de la cuota impaga más antigua que ya venció */
  paymentRequest: { n: number; amount: number; deadline: number; state: InstallmentState; daysLate: number } | null;
  /** Nivel del siguiente crédito según el peor atraso (docs/reglas-cambio-de-nivel.md) */
  levelOutlook: { worstDelay: number; from: Level; to: Level | 4; blockedUntil: number | null; closed: boolean } | null;
  chargedOffAt?: number;
  creditReport?: {
    noticeAt: number;
    reportedAt?: number;
    status: "aviso" | "al_dia" | "en_mora" | "pagada";
    snapshot?: {
      holderName: string;
      documentType: string;
      documentNumber: string;
      obligationId: string;
      obligationType: string;
      disbursedAt: number;
      amount: number;
      overdueBalance: number;
      daysLate: number;
    };
    paidAt?: number;
  };
}

type InstallmentState = "PENDIENTE" | "POR_PAGAR" | "PAGADA" | "EN_MORA" | "PAGADA_CON_MORA";

interface Receipt {
  txId: string;
  reference: string;
  at: number;
  amount: number;
  applied: { n: number; amount: number; completed: boolean }[];
  toKey: string;
  fromKey: string;
}

interface Data {
  applicant: { name: string; score: number; level: Level | null; paidOnTime: number; blockedUntil?: number; historyLevel?: Level; scoreLevel: Level | null } | null;
  loans: LoanView[];
}

export default function MyCreditPage() {
  const [data, setData] = useState<Data | null>(null);
  const [paying, setPaying] = useState<LoanView | null>(null);
  const toast = useToast();

  const load = useCallback(() => api<Data>("/api/loans").then(setData), []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Acreditado" title="Mi crédito" description="Consulta tus cuotas y paga por Bre-B desde tu banco." />

      {!data && (
        <p className="flex items-center gap-2 text-muted">
          <Spinner /> Cargando tus créditos…
        </p>
      )}

      {data?.applicant && (
        <Card className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <Stat label="Titular" value={data.applicant.name} />
          </div>
          <Stat label="Nivel actual" value={levelLabel(data)} sub={data.applicant.historyLevel ? "Según tu historial de pagos" : `Puntaje ${data.applicant.score}/100`} />
          <Stat label="Créditos pagados a tiempo" value={data.applicant.paidOnTime} sub="Pagar a tiempo te sube un nivel" />
          <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm sm:col-span-3">
            <span className="text-muted">Tu nivel, tus créditos y cómo los pagaste, en un documento.</span>
            <PdfLink href="/api/credit-history">Solicitar certificado de historial crediticio (PDF)</PdfLink>
          </div>
        </Card>
      )}

      {data && data.loans.length === 0 && (
        <EmptyState
          title="Todavía no tienes créditos"
          description="Elige monto y plazo según tu nivel. Si hay capital disponible, recibes el dinero al instante en tu llave Bre-B."
          action={
            <Link href="/credito" className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
              Pedir mi crédito
            </Link>
          }
        />
      )}

      {data?.loans.map((loan) => (
        <Card key={loan.id} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-lg font-semibold">{cop(loan.amount)}</div>
              <div className="text-sm text-muted">
                {LEVELS[loan.level].name} · {pct(loan.rateEA)} EA · {loan.installments} cuotas, una cada 15 días
              </div>
            </div>
            <StatusBadge loan={loan} />
          </div>

          {(loan.status === "activo" || loan.status === "pagado") && <Progress loan={loan} />}

          {loan.status !== "cancelado" && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <PdfLink href={`/api/loans/${loan.id}/plan`}>{loan.status === "en_espera" ? "Plan de pagos estimado (PDF)" : "Plan de pagos (PDF)"}</PdfLink>
              {loan.status === "pagado" && <PdfLink href={`/api/loans/${loan.id}/paz-y-salvo`}>Paz y salvo (PDF)</PdfLink>}
            </div>
          )}

          <LoanNotice loan={loan} />

          <CreditReportCard loan={loan} />

          <LevelOutlook loan={loan} />

          {loan.payout && <PayoutReceipt payout={loan.payout} txId={loan.disbursementTxId} />}

          {(loan.status === "activo" || loan.status === "pagado") && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="w-8 py-1">#</th>
                    <th>Vence</th>
                    <th className="text-right">Cuota</th>
                    <th className="hidden text-right sm:table-cell">Interés</th>
                    <th className="hidden text-right sm:table-cell">Capital</th>
                    <th className="text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.schedule.map((i) => (
                    <tr key={i.n} className="border-t border-line">
                      <td className="py-2 text-muted">{i.n}</td>
                      <td className="whitespace-nowrap">{fmtShort(i.dueAt)}</td>
                      <td className="text-right">
                        {cop(i.payment)}
                        {!i.paidAt && (i.paidAmount ?? 0) > 0 && <div className="text-[11px] text-muted">abonado {cop(i.paidAmount!)}</div>}
                      </td>
                      <td className="hidden text-right sm:table-cell">{cop(i.interest)}</td>
                      <td className="hidden text-right sm:table-cell">{cop(i.principal)}</td>
                      <td className="text-right">
                        <InstallmentBadge i={i} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loan.status === "activo" && loan.paymentRequest && <PaymentRequest loan={loan} onPay={() => setPaying(loan)} />}

          {loan.status === "activo" && loan.nextInstallment && !loan.paymentRequest && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <div className="text-sm">
                <div className="text-muted">Próxima cuota · {fmtDate(loan.nextInstallment.dueAt)}</div>
                <div className="text-lg font-semibold tabular-nums">{cop(loan.nextDue)}</div>
                {(loan.nextInstallment.paidAmount ?? 0) > 0 && (
                  <div className="text-xs text-muted">Ya abonaste {cop(loan.nextInstallment.paidAmount!)} de {cop(loan.nextInstallment.payment)}</div>
                )}
              </div>
              <Button onClick={() => setPaying(loan)} variant="ghost" className="w-full sm:w-auto">
                Pagar o abonar por Bre-B
              </Button>
            </div>
          )}
        </Card>
      ))}

      {paying && (
        <BrebTransfer
          loan={paying}
          onClose={() => setPaying(null)}
          onPaid={(r, loan) => {
            void load();
            if (loan.status === "pagado") toast("success", "¡Crédito pagado!", "Tu historial mejora y puedes acceder a mejores condiciones.");
            else toast("success", "Transferencia recibida", `${cop(r.amount)} llegaron a la bóveda de ${APP_NAME} (${r.reference}).`);
          }}
        />
      )}
    </div>
  );
}

/** Aviso según el estado del crédito: en espera, vencido o próximo a vencer */
function LoanNotice({ loan }: { loan: LoanView }) {
  if (loan.status === "cancelado")
    return (
      <Alert
        tone="error"
        title="No pudimos desembolsar este crédito"
        action={
          <Link href="/credito" className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
            Pedirlo de nuevo
          </Link>
        }
      >
        {loan.disbursement?.rejectedReason ?? "Tu llave Bre-B no pasó la verificación."} No se envió dinero y no debes nada.
      </Alert>
    );
  if (loan.status === "en_espera" && loan.disbursement?.state === "TREASURY_DEBITED")
    return (
      <Alert tone="info" title="Desembolsando">
        Ya reservamos el capital. Estamos verificando tu llave Bre-B en el directorio antes de enviar el dinero.
      </Alert>
    );
  if (loan.status === "en_espera")
    return (
      <Alert tone="info" title="Aprobado, en espera de fondeo">
        Lo desembolsamos a tu llave Bre-B en cuanto haya capital disponible en el pool. No tienes que hacer nada.
      </Alert>
    );
  if (loan.chargedOffAt && loan.status === "activo")
    return (
      <Alert tone="error" title="Crédito castigado">
        Llegó a {loan.daysLate} días de mora. Aún puedes pagarlo: tu reporte se actualiza a obligación pagada.
      </Alert>
    );
  if (!loan.paymentRequest && loan.daysToNext !== null && loan.daysToNext <= 2 && loan.nextInstallment)
    return (
      <Alert tone="info" title={`Tu cuota vence el ${ddmm(loan.nextInstallment.dueAt)}`}>
        Tu cuota de {cop(loan.nextDue)} vence el {fmtDate(loan.nextInstallment.dueAt)}. Ese día te llega la solicitud de pago.
      </Alert>
    );
  if (loan.status === "pagado")
    return <Alert tone="success" title="Crédito pagado">¡Buen trabajo! Este pago suma a tu historial.</Alert>;
  return null;
}

/** Fecha corta para tablas: "28 nov 2026" */
const fmtShort = (ms: number) => new Date(ms).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }).replace(/ de /g, " ");

function Progress({ loan }: { loan: LoanView }) {
  const paid = loan.schedule.filter((i) => i.paidAt).length;
  const owed = loan.owed;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap justify-between gap-x-4 text-xs text-muted">
        <span>
          {paid} de {loan.installments} cuotas pagadas
        </span>
        <span>Saldo pendiente {cop(owed)}</span>
      </div>
      <div className="h-2 rounded-full bg-line">
        <div className="h-2 rounded-full bg-mint transition-all" style={{ width: `${(paid / loan.installments) * 100}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ loan }: { loan: LoanView }) {
  if (loan.status === "pagado") return <Badge tone="good">Pagado</Badge>;
  if (loan.status === "cancelado") return <Badge tone="bad">Desembolso bloqueado</Badge>;
  if (loan.status === "en_espera") return <Badge tone="warn">{loan.disbursement?.state === "TREASURY_DEBITED" ? "Desembolsando" : "En espera de fondeo"}</Badge>;
  if (loan.chargedOffAt) return <Badge tone="bad">Castigado · {loan.daysLate} días de mora</Badge>;
  if (loan.overdue) return <Badge tone="bad">En mora · {loan.daysLate} días</Badge>;
  if (loan.paymentRequest) return <Badge tone="warn">Cuota por pagar</Badge>;
  return <Badge>Al día · desembolsado a {loan.llaveBreb}{loan.breb ? ` (${bankName(loan.breb.financialEntity.name)})` : ""}</Badge>;
}

const ddmm = (ms: number) => new Date(ms).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" });

function InstallmentBadge({ i }: { i: LoanView["schedule"][number] }) {
  const badge = (tone: "neutral" | "good" | "warn" | "bad", text: string) => (
    <span className="whitespace-nowrap">
      <Badge tone={tone}>{text}</Badge>
    </span>
  );
  switch (i.state) {
    case "PAGADA":
      return badge("good", "A tiempo");
    case "PAGADA_CON_MORA":
      return badge("warn", `Pagada · ${i.daysLate} d tarde`);
    case "POR_PAGAR":
      return badge("warn", `Pagar antes del ${ddmm(i.deadline)}`);
    case "EN_MORA":
      return badge("bad", `Mora · ${i.daysLate} d`);
    default:
      return badge("neutral", "Pendiente");
  }
}

/** Nivel actual: con mora de más de 30 días o bloqueado es nivel 4 */
function levelLabel(data: Data) {
  const a = data.applicant!;
  if (a.level) return LEVELS[a.level].name;
  // Fecha de la demo (el operador puede adelantar el reloj)
  const t = data.loans[0]?.now ?? Date.now();
  if (a.blockedUntil && a.blockedUntil > t) return "Nivel 4 · bloqueado";
  if (data.loans.some((l) => l.status === "activo" && l.daysLate > 30)) return "Nivel 4 · en mora";
  return "No aprobado";
}

/** Solicitud de pago (simulada) de la cuota vencida: 3 días para pagarla sin entrar en mora */
function PaymentRequest({ loan, onPay }: { loan: LoanView; onPay: () => void }) {
  const r = loan.paymentRequest!;
  const late = r.state === "EN_MORA";
  return (
    <div className={`space-y-3 rounded-xl border p-4 ${late ? "border-red-500/40 bg-red-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">Solicitud de pago · cuota {r.n}</span>
        <Badge>Pago simulado</Badge>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="text-sm">
          <div className="text-2xl font-semibold tabular-nums">{cop(r.amount)}</div>
          <div className="text-muted">
            A la llave <b className="text-foreground">{VAULT_BREB.key}</b>
          </div>
          <div className={late ? "font-medium text-red-600 dark:text-red-400" : "font-medium"}>
            {late
              ? `Tu cuota está en mora desde el ${ddmm(r.deadline + 1)} (${r.daysLate} días de atraso)`
              : `Tienes hasta el ${ddmm(r.deadline)} para pagar`}
          </div>
        </div>
        <Button onClick={onPay} variant={late ? "danger" : "primary"} className="w-full sm:w-auto">
          Pagar por Bre-B
        </Button>
      </div>
      <p className="text-[11px] text-muted">
        Pagando dentro de los 3 días la cuota cuenta como pagada a tiempo. Puedes abonar por partes; el atraso se cuenta desde el vencimiento.
      </p>
    </div>
  );
}

/** Qué pasa con su nivel (docs/reglas-cambio-de-nivel.md): mensajes claros y sin culpar */
function LevelOutlook({ loan }: { loan: LoanView }) {
  const o = loan.levelOutlook;
  if (!o) return null;
  const blocked = o.blockedUntil && o.blockedUntil > loan.now;
  if (blocked)
    return (
      <Alert tone="error" title="No puedes pedir crédito por ahora">
        Podrás volver a solicitar desde el {new Date(o.blockedUntil!).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })}.
      </Alert>
    );
  if (o.to === 4)
    return (
      <Alert tone="error" title="Ponte al día">
        Tienes cuotas con más de 30 días de atraso. Ponte al día para volver a pedir crédito.
      </Alert>
    );
  const name = LEVELS[o.to as Level].name.toLowerCase();
  if (o.to < o.from)
    return (
      <Alert tone="success" title={o.closed ? `Tu próximo crédito es ${name}` : "Vas pagando todo a tiempo"}>
        {o.closed
          ? `Pagaste todo a tiempo: tu próximo crédito será ${name}, con más cupo y mejor tasa.`
          : `Si sigues así, tu próximo crédito será ${name}: más cupo y mejor tasa.`}
      </Alert>
    );
  if (o.to === o.from)
    return (
      <Alert tone="info" title={`Tu próximo crédito sigue en ${name}`}>
        {o.worstDelay > 3
          ? `Tuviste un atraso de ${o.worstDelay} días. Tu próximo crédito sigue en ${name}. Paga todo a tiempo para subir.`
          : `Ya estás en el mejor nivel. Sigue pagando a tiempo para mantenerlo.`}
      </Alert>
    );
  return (
    <Alert tone="warning" title={`Tu próximo crédito será ${name}`}>
      Tuviste un atraso de {o.worstDelay} días. Tu próximo crédito será {name}.
    </Alert>
  );
}

/** Aviso del día 70 y reporte SIMULADO del día 90 a centrales de riesgo */
function CreditReportCard({ loan }: { loan: LoanView }) {
  const r = loan.creditReport;
  if (!r || r.status === "al_dia") return null;
  if (r.status === "aviso")
    return (
      <Alert tone="error" title="Aviso previo de reporte a centrales de riesgo">
        Tienes una cuota con 70 días de atraso. Si no te pones al día en los próximos 20 días (antes del {fmtDate(r.noticeAt + 20 * 86_400_000)}), tu deuda será
        reportada a las centrales de riesgo.
      </Alert>
    );
  const s = r.snapshot;
  return (
    <div className="space-y-3 rounded-xl border border-red-500/40 p-4 text-sm">
      <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300">
        SIMULACIÓN: este reporte no se envía a ninguna central de riesgo.
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">Reporte a centrales de riesgo</span>
        <span className="shrink-0 whitespace-nowrap">
          <Badge tone={r.status === "pagada" ? "warn" : "bad"}>{r.status === "pagada" ? "Pagada después de mora" : "En mora"}</Badge>
        </span>
      </div>
      {s && (
        <dl className="space-y-1">
          <ReceiptRow k="Titular" v={s.holderName} />
          <ReceiptRow k="Documento" v={`${s.documentType} ${s.documentNumber}`} />
          <ReceiptRow k="Obligación" v={`${s.obligationId} · ${s.obligationType}`} />
          <ReceiptRow k="Fecha de desembolso" v={fmtDate(s.disbursedAt)} />
          <ReceiptRow k="Monto desembolsado" v={cop(s.amount)} />
          <ReceiptRow k="Saldo en mora" v={cop(s.overdueBalance)} />
          <ReceiptRow k="Días de mora" v={String(s.daysLate)} />
          <ReceiptRow k="Aviso previo" v={fmtDate(r.noticeAt)} />
          <ReceiptRow k="Fecha del reporte" v={fmtDate(r.reportedAt!)} />
          {r.paidAt && <ReceiptRow k="Pagada el" v={fmtDate(r.paidAt)} />}
        </dl>
      )}
    </div>
  );
}

/**
 * Simulador de la app del banco: el acreditado envía por Bre-B a la llave de la plataforma, vinculada a la bóveda.
 * Pasos: datos (llave y monto) → confirmar → comprobante.
 */
function BrebTransfer({ loan, onClose, onPaid }: { loan: LoanView; onClose: () => void; onPaid: (r: Receipt, loan: LoanView) => void }) {
  const [step, setStep] = useState<"datos" | "confirmar" | "listo">("datos");
  const [toKey, setToKey] = useState(VAULT_BREB.key);
  const [amount, setAmount] = useState(String(loan.nextDue));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const value = Number(amount) || 0;
  const keyFound = toKey.trim().toLowerCase() === VAULT_BREB.key.toLowerCase();
  const amountError =
    !value ? "Ingresa el valor" : value > loan.owed ? `Tu saldo pendiente es ${cop(loan.owed)}` : value < Math.min(MIN_PAYMENT, loan.owed) ? `El mínimo es ${cop(MIN_PAYMENT)}` : null;
  const partial = value < loan.nextDue;

  async function send() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ receipt: Receipt; loan: LoanView }>(`/api/loans/${loan.id}/pay`, { toKey, amount: value });
      setReceipt(r.receipt);
      setStep("listo");
      onPaid(r.receipt, r.loan);
    } catch (e) {
      setError((e as Error).message);
      setStep("datos");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="breb-title" className="toast-in w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-brand px-5 py-3 text-white">
          <span id="breb-title" className="text-sm font-semibold">
            Tu banco · Enviar por Bre-B
          </span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">Simulador</span>
        </div>

        <div className="space-y-4 p-5">
          {step === "datos" && (
            <>
              <Line k="Desde" v={`Tu cuenta · llave ${loan.llaveBreb}`} />
              <div className="space-y-1">
                <label htmlFor="breb-to" className="block text-sm font-medium">
                  Llave de destino
                </label>
                <input
                  id="breb-to"
                  value={toKey}
                  onChange={(e) => setToKey(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  className={`w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 ${keyFound || !toKey ? "border-line focus:border-brand focus:ring-brand/20" : "border-red-500 focus:ring-red-500/20"}`}
                />
                {keyFound ? (
                  <div className="rounded-lg bg-mint/10 px-3 py-2 text-xs">
                    <span className="font-medium text-mint">✓ {VAULT_BREB.holderName}</span>
                    <span className="block text-muted">{VAULT_BREB.bank} · vinculada a la bóveda de {APP_NAME}</span>
                  </div>
                ) : (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {toKey ? "Esa llave no existe en el directorio Bre-B." : "Escribe la llave."}{" "}
                    <button type="button" className="font-medium underline" onClick={() => setToKey(VAULT_BREB.key)}>
                      Usar {VAULT_BREB.key}
                    </button>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <MoneyInput label="Valor a enviar" value={amount} onValue={setAmount} error={amount ? amountError : null} />
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: `Cuota ${loan.nextInstallment?.n ?? ""}`, v: loan.nextDue },
                    { label: "Todo el saldo", v: loan.owed },
                  ].map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setAmount(String(c.v))}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${value === c.v ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50"}`}
                    >
                      {c.label} · {cop(c.v)}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted">
                  {partial && !amountError ? "Es un abono: se aplica a tu cuota más antigua y el resto queda pendiente." : "Si envías más que la cuota, el resto se abona a las siguientes."}
                </p>
              </div>
              {error && <Alert tone="error" title="No se pudo enviar">{error}</Alert>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>
                  Cancelar
                </Button>
                <Button onClick={() => setStep("confirmar")} disabled={!keyFound || Boolean(amountError)}>
                  Continuar
                </Button>
              </div>
            </>
          )}

          {step === "confirmar" && (
            <>
              <div className="text-center">
                <div className="text-xs text-muted">Vas a enviar</div>
                <div className="text-3xl font-semibold tabular-nums">{cop(value)}</div>
              </div>
              <div className="space-y-2 rounded-lg bg-brand-soft p-3 text-sm">
                <Line k="Para" v={VAULT_BREB.holderName} />
                <Line k="Llave" v={VAULT_BREB.key} />
                <Line k="Entidad" v={VAULT_BREB.bank} />
                <Line k="Concepto" v={partial ? `Abono a la cuota ${loan.nextInstallment?.n}` : `Pago crédito ${cop(loan.amount)}`} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setStep("datos")} disabled={busy}>
                  Atrás
                </Button>
                <Button onClick={send} loading={busy}>
                  {busy ? "Enviando…" : "Enviar"}
                </Button>
              </div>
            </>
          )}

          {step === "listo" && receipt && (
            <>
              <div className="space-y-1 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint/15 text-2xl text-mint">✓</div>
                <div className="font-semibold">Transferencia exitosa</div>
                <div className="text-3xl font-semibold tabular-nums">{cop(receipt.amount)}</div>
                <div className="text-xs text-muted">Llegó a la bóveda de {APP_NAME} al instante</div>
              </div>
              <div className="space-y-2 rounded-lg bg-brand-soft p-3 text-sm">
                <Line k="Referencia" v={receipt.reference} />
                <Line k="Fecha" v={fmtDate(receipt.at)} />
                <Line k="De" v={receipt.fromKey} />
                <Line k="Para" v={receipt.toKey} />
                {receipt.applied.map((a) => (
                  <Line key={a.n} k={`Cuota ${a.n}`} v={`${cop(a.amount)} · ${a.completed ? "pagada" : "abono"}`} />
                ))}
              </div>
              <a
                href={`/api/receipts/${receipt.txId}`}
                target="_blank"
                rel="noopener"
                className="block text-center text-sm font-medium text-brand hover:underline"
              >
                Ver comprobante (PDF)
              </a>
              <Button className="w-full" onClick={onClose}>
                Listo
              </Button>
            </>
          )}
          <p className="text-center text-[10px] text-muted">Simulación de sandbox: no se mueve dinero real.</p>
        </div>
      </div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted">{k}</span>
      <span className="min-w-0 truncate text-right font-medium" title={v}>
        {v}
      </span>
    </div>
  );
}

const DIRECTORY: Record<NonNullable<LoanView["payout"]>["directory"], string> = {
  production: "directorio Bre-B real (producción, solo lectura)",
  sandbox: "directorio Bre-B de pruebas (sandbox)",
  simulado: "verificación simulada",
};

/** Comprobante del desembolso: la llave se re-verificó y el payout quedó armado (sin enviar dinero real) */
function PayoutReceipt({ payout, txId }: { payout: NonNullable<LoanView["payout"]>; txId: string | null }) {
  const bank = bankName(payout.beneficiary.financialEntity.name);
  const code = payout.beneficiary.financialEntity.code;
  return (
    <details className="group rounded-xl border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
        <span>
          <span className="font-medium">Comprobante de desembolso</span>
          <span className="block text-xs text-muted">
            {cop(payout.amountCop)} a {payout.beneficiary.key} · {bank}
          </span>
        </span>
        <span className="text-xs text-muted transition group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-3 border-t border-line px-4 py-3 text-sm">
        <dl className="space-y-1.5">
          <ReceiptRow k="Payout" v={payout.id} />
          <ReceiptRow k="Referencia" v={payout.reference} />
          <ReceiptRow k="Titular" v={payout.beneficiary.holderName} />
          <ReceiptRow k="Entidad" v={/^\d+$/.test(code) ? `${bank} (${code})` : bank} />
          <ReceiptRow k="Llave" v={`${payout.beneficiary.key} · ${payout.beneficiary.keyType}`} />
          <ReceiptRow k="Monto" v={cop(payout.amountCop)} />
          <ReceiptRow k="Fecha" v={fmtDate(payout.submittedAt)} />
        </dl>
        <p className="text-xs text-muted">
          Justo antes de pagar volvimos a verificar tu llave en el {DIRECTORY[payout.directory]}: sigue activa y con el mismo titular y banco que confirmaste.
        </p>
        <details>
          <summary className="cursor-pointer text-xs font-medium text-brand-strong">Ver la solicitud de payout a Wompi</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-background p-3 text-[11px] leading-relaxed">{JSON.stringify(payout.request, null, 2)}</pre>
        </details>
        <Alert tone="info" title="Payout simulado">
          Es exactamente lo que se le enviaría a Wompi (montos en centavos; la referencia evita pagar dos veces), pero no se envió: no se movió dinero real.
        </Alert>
        {txId && <PdfLink href={`/api/receipts/${txId}`}>Comprobante de desembolso (PDF)</PdfLink>}
      </div>
    </details>
  );
}

/** Enlace a un documento PDF (se abre en otra pestaña) */
function PdfLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
      <span aria-hidden="true">↓</span>
      {children}
    </a>
  );
}

function ReceiptRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className="min-w-0 break-all text-right font-medium">{v}</dd>
    </div>
  );
}
