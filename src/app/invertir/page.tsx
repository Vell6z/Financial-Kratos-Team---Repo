"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog, useToast } from "@/components/feedback";
import { Alert, Badge, Button, Card, EmptyState, Input, MoneyInput, PageHeader, Stat, api } from "@/components/ui";
import { EARLY_WITHDRAWAL_SHARE, investmentTermDays, LEVEL_IDS, LEVELS, MIN_INVESTMENT, type Level } from "@/lib/config";
import { accrue, cop, pct } from "@/lib/finance";
import { validateMoney, validateWallet, walletLabel } from "@/lib/validators";

const QUICK_AMOUNTS = [100_000, 500_000, 1_000_000, 5_000_000];
const RISK_TEXT: Record<Level, string> = {
  1: "Créditos a perfiles con mejor historial. Menor rendimiento, menor riesgo.",
  2: "Equilibrio entre rendimiento y riesgo de impago.",
  3: "Mayor rendimiento a cambio de mayor riesgo de impago.",
};

interface Position {
  id: string;
  level: Level;
  balance: number;
  deposited: number;
  withdrawn: number;
  /** Plazos de los aportes y cuánto puede retirar hoy (calculado en el servidor) */
  matured: boolean;
  nextMaturity: number | null;
  allowed: number;
  max: number;
  lots: { id: string; at: number; principal: number; value: number; maturesAt: number; matured: boolean; allowed: number }[];
}

const EARLY_PCT = `${EARLY_WITHDRAWAL_SHARE * 100} %`;
const shortDate = (t: number) => new Date(t).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }).replace(/ de /g, " ");

interface Quote {
  debit: { value: number; assetCode: string };
  receive: { value: number; assetCode: string };
  copPerUnit: number;
  fxSource: FxSource;
  fxUpdatedAt: string | null;
  amountCop: number;
  vaultAsset: string;
  expiresAt: string | null;
}
type FxSource = "mercado" | "manual" | "respaldo";
/** Moneda de la bóveda y pesos por unidad, para estimar antes de cotizar */
interface Fx {
  assetCode: string;
  copPerUnit: number;
  source: FxSource;
  updatedAt: string | null;
}
const FX_SOURCE: Record<FxSource, string> = { mercado: "tasa de mercado", manual: "tasa fija del equipo", respaldo: "tasa de respaldo (sin conexión)" };
type DepositResult = { status: "completed" | "pending"; redirectUrl?: string; debit?: string; receive?: string; quote?: Quote };
/** Pago cotizado por Interledger que falta aprobar en la wallet */
type Pending = DepositResult & { kind: "deposit" | "withdraw"; amountCop: number; level: Level };

const RETURN_MESSAGES: Record<string, { tone: "success" | "error" | "warning"; title: string; text: string }> = {
  invertido: { tone: "success", title: "Inversión recibida", text: "Llegó por Interledger y tu cajita ya está rentando." },
  retirado: { tone: "success", title: "Retiro enviado", text: "El dinero va en camino a tu wallet por Interledger." },
  rechazado: { tone: "warning", title: "Pago cancelado", text: "No se aprobó el pago en la wallet. No se movió dinero." },
  error: { tone: "error", title: "No se pudo completar el pago", text: "Intenta de nuevo en unos minutos." },
};

/** "$ilp.x/nombre" o "ilp.x/nombre" → URL, para mostrarla igual que la guardada */
const asUrl = (w: string) => {
  const s = w.trim();
  return s.startsWith("$") ? `https://${s.slice(1)}` : /^https?:\/\//.test(s) ? s : `https://${s}`;
};

export default function InvestPage() {
  const [wallet, setWallet] = useState("");
  const [level, setLevel] = useState<Level>(2);
  const [amount, setAmount] = useState("1000000");
  const [positions, setPositions] = useState<Position[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [interledger, setInterledger] = useState(true);
  const [toWithdraw, setToWithdraw] = useState<{ p: Position; value: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [fx, setFx] = useState<Fx | null>(null);
  // Máximo por retiro: US$30.000 en pesos a la tasa del día (lo calcula el servidor)
  const [maxWithdrawal, setMaxWithdrawal] = useState<{ usd: number; cop: number } | null>(null);
  const toast = useToast();

  useEffect(() => {
    api<Fx | null>("/api/fx")
      .then(setFx)
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const data = await api<{ interledger: boolean; wallet: string | null; positions: Position[]; maxWithdrawal: { usd: number; cop: number } }>("/api/invest");
    setPositions(data.positions);
    setMaxWithdrawal(data.maxWithdrawal);
    setInterledger(data.interledger);
    if (data.wallet) setWallet((prev) => prev || data.wallet!);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const pago = q.get("pago");
    if (pago && RETURN_MESSAGES[pago]) {
      // Muestra el resultado del pago al volver de la wallet
      const m = RETURN_MESSAGES[pago];
      toast(m.tone, m.title, q.get("msg") ?? m.text);
      window.history.replaceState(null, "", "/invertir");
    }
  }, [toast]);

  // Refresca para ver crecer el saldo con interés compuesto
  useEffect(() => {
    const refresh = () => void load().catch(() => {});
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  async function invest() {
    setSubmitted(true);
    if (walletError || amountError) return;
    setBusy(true);
    try {
      const res = await api<DepositResult>("/api/invest/deposit", { wallet, level, amountCop: Number(amount) });
      if (res.status === "pending") setPending({ ...res, kind: "deposit", amountCop: Number(amount), level });
      else toast("success", "Inversión registrada", `${cop(Number(amount))} en ${LEVELS[level].name}. Tu cajita ya está rentando.`);
      setSubmitted(false);
      await load();
    } catch (e) {
      toast("error", "No se pudo invertir", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(p: Position, value: number) {
    setBusy(true);
    try {
      const res = await api<DepositResult>("/api/invest/withdraw", { level: p.level, amountCop: Math.floor(value) });
      if (res.status === "pending") setPending({ ...res, kind: "withdraw", amountCop: Math.floor(value), level: p.level });
      else
        toast(
          "success",
          "Retiro enviado",
          res.receive ? `${cop(value)} salieron de la bóveda: llegan ${res.receive.replace(".", ",")} a tu wallet.` : `${cop(value)} enviados a tu wallet.`,
        );
      await load();
    } catch (e) {
      toast("error", "No se pudo retirar", (e as Error).message);
    } finally {
      setBusy(false);
      setToWithdraw(null);
    }
  }

  const walletError = validateWallet(wallet);
  const amountError = validateMoney(amount, { min: MIN_INVESTMENT, label: "cuánto quieres invertir" });
  const projected = Number(amount) > 0 ? accrue(Number(amount), LEVELS[level].rateEA, 365 * 86_400_000) : 0;
  const total = positions.reduce((s, p) => s + p.balance, 0);
  const gains = positions.reduce((s, p) => s + p.balance - p.deposited + p.withdrawn, 0);
  const awaitingDeposit = pending?.kind === "deposit" ? pending : null;
  const now = useNow(Boolean(pending));
  const expired = Boolean(pending?.quote?.expiresAt && Date.parse(pending.quote.expiresAt) <= now);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inversionista"
        title="Mis inversiones"
        description={`Elige un nivel de riesgo: tu dinero renta a la tasa de ese nivel con interés compuesto. Al cumplir el plazo del nivel retiras todo; antes, hasta el ${EARLY_PCT}.`}
      />

      <Card className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <Stat label="Saldo total" value={cop(total)} />
        </div>
        <Stat label="Rendimiento acumulado" value={<span className="text-mint">{cop(gains)}</span>} />
        <Stat label="Cajitas activas" value={positions.filter((p) => p.balance >= 1).length} />
      </Card>

      {!interledger && (
        <Alert tone="info" title="Modo demostración">
          Open Payments no está conectado: las inversiones y retiros se simulan sin mover dinero real.
        </Alert>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Nueva inversión</h2>
          <p className="text-sm text-muted">Confirma tu wallet, elige el riesgo y define el monto. Al final apruebas el pago en tu wallet.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <Card className="p-6">
            {/* Con un pago ya cotizado no se cambian los datos: la cotización es por este monto y este nivel */}
            <fieldset disabled={Boolean(awaitingDeposit)} className="min-w-0 space-y-6 transition disabled:opacity-60">
              <Input
                label="1. Wallet address de Interledger"
                placeholder="$ilp.interledger-test.dev/tu-nombre"
                value={wallet}
                required
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setWallet(e.target.value)}
                error={submitted ? walletError : null}
                hint="Desde aquí envías la inversión y aquí recibes tus retiros."
              />

              <div className="text-sm" role="radiogroup" aria-label="Perfil de riesgo">
                <span className="mb-2 block font-medium">2. Perfil de riesgo</span>
                <div className="grid gap-3 sm:grid-cols-3">
                  {LEVEL_IDS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={level === l}
                      onClick={() => setLevel(l)}
                      className={`rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${level === l ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{LEVELS[l].name}</span>
                        <span className="text-xs text-muted">{LEVELS[l].risk}</span>
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-mint">{pct(LEVELS[l].rateEA)} EA</div>
                      <div className="text-xs font-medium">Plazo {investmentTermDays(l)} días</div>
                      <p className="mt-1 text-xs text-muted">{RISK_TEXT[l]}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <MoneyInput
                  label="3. Monto a invertir (COP)"
                  required
                  value={amount}
                  onValue={setAmount}
                  error={submitted ? amountError : null}
                  hint={`Mínimo ${cop(MIN_INVESTMENT)}. Interledger convierte desde la moneda de tu wallet.`}
                />
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setAmount(String(q))}
                      className={`rounded-full border px-3 py-2 text-xs transition sm:py-1 ${Number(amount) === q ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50"}`}
                    >
                      {cop(q)}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>
          </Card>

          {/* Resumen y acción: el paso de aprobar aparece aquí mismo, donde se hizo clic en "Invertir" */}
          <Card className="h-fit space-y-4 p-6 lg:sticky lg:top-20">
            <Steps current={awaitingDeposit ? 2 : 1} />
            {awaitingDeposit ? (
              <>
                <div>
                  <h3 className="font-semibold">4. Aprueba el pago en tu wallet</h3>
                  <p className="text-sm text-muted">
                    Interledger ya cotizó tu inversión de {cop(awaitingDeposit.amountCop)} en {LEVELS[awaitingDeposit.level].name}.
                  </p>
                </div>
                <QuoteDetails p={awaitingDeposit} now={now} />
                {expired ? (
                  <Button className="w-full py-2.5" loading={busy} onClick={() => (setPending(null), invest())}>
                    Volver a cotizar
                  </Button>
                ) : (
                  <a
                    href={awaitingDeposit.redirectUrl}
                    className="flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    Aprobar en mi wallet
                  </a>
                )}
                <Button variant="ghost" className="w-full" onClick={() => setPending(null)}>
                  Cancelar y cambiar datos
                </Button>
                <p className="text-center text-[11px] text-muted">Te llevamos a tu wallet; al aprobar vuelves aquí y tu cajita empieza a rentar.</p>
              </>
            ) : (
              <>
                <h3 className="font-semibold">Resumen</h3>
                <dl className="space-y-2 text-sm">
                  <SummaryRow k="Desde" v={wallet && !walletError ? walletLabel(asUrl(wallet)) : "—"} />
                  <SummaryRow k="Cajita" v={`${LEVELS[level].name} · ${pct(LEVELS[level].rateEA)} EA`} />
                  <SummaryRow k="Plazo" v={`${investmentTermDays(level)} días`} />
                  <SummaryRow k="Monto" v={Number(amount) > 0 ? cop(Number(amount)) : "—"} />
                  {fx && fx.assetCode !== "COP" && Number(amount) > 0 && (
                    <SummaryRow k={`En ${fx.assetCode}`} v={`≈ ${fmtAsset(Number(amount) / fx.copPerUnit, fx.assetCode)}`} />
                  )}
                </dl>
                {fx && fx.assetCode !== "COP" && (
                  <p className="-mt-2 text-[11px] text-muted">
                    1 {fx.assetCode} = {cop(fx.copPerUnit)} · {FX_SOURCE[fx.source]}. El valor exacto lo cotiza Interledger al invertir.
                  </p>
                )}
                {projected > 0 && !amountError && (
                  <div className="rounded-lg bg-brand-soft p-4">
                    <div className="text-xs text-muted">En un año tendrías aprox.</div>
                    <div className="text-2xl font-semibold tabular-nums">{cop(projected)}</div>
                    <div className="text-xs text-mint">+{cop(projected - Number(amount))}</div>
                    <div className="mt-1 text-[11px] text-muted">Proyección sin impagos; el riesgo lo asume el inversionista.</div>
                  </div>
                )}
                <p className="text-[11px] text-muted">
                  Cada aporte tiene su propio plazo de {investmentTermDays(level)} días: antes de cumplirlo puedes retirar hasta el {EARLY_PCT} de ese aporte.
                </p>
                <Button onClick={invest} loading={busy} className="w-full py-2.5">
                  {busy ? "Cotizando con Interledger…" : `Invertir ${Number(amount) > 0 ? cop(Number(amount)) : ""}`}
                </Button>
                <p className="text-center text-[11px] text-muted">
                  {interledger ? "Después apruebas el pago en tu wallet de Interledger." : "Modo demostración: no se mueve dinero real."}
                </p>
              </>
            )}
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Mis cajitas</h2>
        {positions.length === 0 ? (
          <EmptyState title="Aún no tienes cajitas" description="Cuando hagas tu primera inversión, aquí verás cómo crece tu saldo día a día." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {positions.map((p) => (
              <PositionCard key={p.id} p={p} busy={busy} maxWithdrawal={maxWithdrawal} onWithdraw={(v) => setToWithdraw({ p, value: v })} />
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={toWithdraw !== null}
        title="¿Confirmas el retiro?"
        confirmLabel="Retirar"
        loading={busy}
        onConfirm={() => toWithdraw && withdraw(toWithdraw.p, toWithdraw.value)}
        onCancel={() => setToWithdraw(null)}
      >
        {toWithdraw && (
          <>
            Retirarás <b className="text-foreground">{cop(toWithdraw.value)}</b> de tu cajita {LEVELS[toWithdraw.p.level].name} hacia{" "}
            <span className="break-all text-foreground">{walletLabel(wallet)}</span>.
          </>
        )}
      </ConfirmDialog>

      {/* El retiro lo paga la bóveda: se aprueba en su wallet justo después de confirmar, en el mismo lugar */}
      <ConfirmDialog
        open={pending?.kind === "withdraw"}
        title="Aprueba el retiro en la wallet"
        confirmLabel={expired ? "Cerrar y volver a retirar" : "Aprobar en la wallet"}
        onConfirm={() => (expired ? setPending(null) : pending?.redirectUrl && window.location.assign(pending.redirectUrl))}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === "withdraw" && (
          <div className="space-y-3">
            <p>
              Interledger cotizó el retiro de {cop(pending.amountCop)} de tu cajita {LEVELS[pending.level].name}.
            </p>
            <QuoteDetails p={pending} now={now} />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

/** Progreso de la inversión: datos → aprobación en la wallet → rentando */
function Steps({ current }: { current: 1 | 2 }) {
  const steps = ["Datos", "Aprobar", "Rentando"];
  return (
    <ol className="flex items-center gap-2 text-[11px]" aria-label="Progreso de la inversión">
      {steps.map((s, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "now" : "next";
        return (
          <li key={s} className="flex flex-1 items-center gap-1.5" aria-current={state === "now" ? "step" : undefined}>
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-semibold ${
                state === "done" ? "bg-mint text-white" : state === "now" ? "bg-brand text-white" : "bg-line text-muted"
              }`}
            >
              {state === "done" ? "✓" : n}
            </span>
            <span className={state === "next" ? "text-muted" : "font-medium"}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Hora actual que se actualiza cada segundo mientras hay una cotización abierta (para el vencimiento) */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

const fmtAsset = (n: number, code: string, digits = 2) =>
  `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)} ${code}`;

/** Cotización de Interledger: cuánto sale, cuánto llega, tasa de cambio, costo de la red, equivalente en pesos y vencimiento */
function QuoteDetails({ p, now }: { p: Pending; now: number }) {
  const q = p.quote;
  if (!q)
    return (
      <dl className="space-y-2 rounded-lg bg-brand-soft p-3 text-sm">
        <SummaryRow k="Sale" v={p.debit ?? "—"} />
        <SummaryRow k="Llega" v={p.receive ?? "—"} />
      </dl>
    );
  const deposit = p.kind === "deposit";
  const sameAsset = q.debit.assetCode === q.receive.assetCode;
  const rate = q.debit.value > 0 ? q.receive.value / q.debit.value : 0;
  const fee = q.debit.value - q.receive.value;
  // Lo que entra o sale de la bóveda, convertido desde los pesos con la tasa de mercado
  const vaultSide = deposit ? q.receive : q.debit;
  const walletSide = deposit ? q.debit : q.receive;
  const left = q.expiresAt ? Math.max(0, Math.ceil((Date.parse(q.expiresAt) - now) / 1000)) : null;
  const updated = q.fxUpdatedAt ? new Date(q.fxUpdatedAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : null;
  return (
    <div className="space-y-3">
      <dl className="space-y-2 rounded-lg bg-brand-soft p-3 text-sm">
        <Stage n={1} title="Pesos a moneda de la bóveda" />
        <SummaryRow k={deposit ? "Inviertes" : "Retiras"} v={cop(q.amountCop)} />
        <SummaryRow k={`1 ${q.vaultAsset}`} v={cop(q.copPerUnit)} />
        <SummaryRow k={deposit ? "Recibe la bóveda" : "Sale de la bóveda"} v={fmtAsset(vaultSide.value, vaultSide.assetCode)} />
        <Stage n={2} title="Interledger" />
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <dt className="text-muted">Tasa de cambio</dt>
          <dd className="font-medium tabular-nums">
            1 {q.debit.assetCode} = {fmtAsset(sameAsset ? 1 : rate, q.receive.assetCode, sameAsset ? 0 : 4)}
          </dd>
        </div>
        <SummaryRow k="Costo de la red" v={sameAsset ? fmtAsset(fee, q.debit.assetCode) : "Incluido"} />
        <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2">
          <dt className="font-medium">{deposit ? "Envías desde tu wallet" : "Recibes en tu wallet"}</dt>
          <dd className="whitespace-nowrap text-base font-semibold tabular-nums">{fmtAsset(walletSide.value, walletSide.assetCode)}</dd>
        </div>
      </dl>
      <p className="text-[11px] text-muted">
        Pesos a {q.vaultAsset}: {FX_SOURCE[q.fxSource]}
        {updated ? ` (${updated})` : ""}, porque la red de prueba de Interledger no maneja pesos.{" "}
        {sameAsset
          ? `Tu wallet y la bóveda usan ${q.debit.assetCode}: Interledger no cambia de moneda, solo cobra el costo de la red.`
          : `Interledger convierte de ${q.debit.assetCode} a ${q.receive.assetCode} y la tasa ya incluye su costo.`}
      </p>
      {left !== null &&
        (left > 0 ? (
          <p className="text-xs text-muted">
            Cotización válida por <b className="tabular-nums text-foreground">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</b>
          </p>
        ) : (
          <Alert tone="warning" title="La cotización venció">
            Las tasas cambian: vuelve a cotizar para ver el valor actualizado.
          </Alert>
        ))}
    </div>
  );
}

function Stage({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted first:pt-0">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] text-white">{n}</span>
      {title}
    </div>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className="min-w-0 truncate text-right font-medium tabular-nums" title={v}>
        {v}
      </dd>
    </div>
  );
}

function PositionCard({
  p,
  busy,
  maxWithdrawal,
  onWithdraw,
}: {
  p: Position;
  busy: boolean;
  maxWithdrawal: { usd: number; cop: number } | null;
  onWithdraw: (v: number) => void;
}) {
  const maxCop = maxWithdrawal?.cop ?? Infinity;
  const maxLabel = maxWithdrawal ? `US$${maxWithdrawal.usd.toLocaleString("es-CO")} (${cop(maxWithdrawal.cop)} hoy)` : "";
  const [value, setValue] = useState("");
  const gain = p.balance - p.deposited + p.withdrawn;
  const n = Number(value);
  const error = !value
    ? null
    : n > Math.floor(p.balance)
      ? `Supera tu saldo (${cop(p.balance)})`
      : n > maxCop
        ? `El máximo por retiro es ${maxLabel}`
        : n > p.allowed
          ? `Hoy puedes sacar hasta ${cop(p.allowed)} por los plazos de tus aportes`
          : null;
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{LEVELS[p.level].name}</span>
        <Badge>{pct(LEVELS[p.level].rateEA)} EA</Badge>
      </div>
      <div>
        <div className="text-2xl font-semibold tabular-nums">{cop(p.balance)}</div>
        <div className="text-xs text-muted">
          <span className="text-mint">+{cop(gain)}</span> de rendimiento · invertido {cop(p.deposited)}
        </div>
      </div>
      {p.lots.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted">
            <span>Tus aportes</span>
            <span>{p.matured ? "Todos cumplieron su plazo" : `Antes del plazo: hasta ${EARLY_PCT}`}</span>
          </div>
          <ul className="space-y-1.5">
            {p.lots.map((l) => (
              <li key={l.id} className={`rounded-lg px-3 py-2 text-xs ${l.matured ? "bg-mint/10" : "bg-brand-soft"}`}>
                <div className="flex justify-between gap-3">
                  <span className="font-medium tabular-nums">{cop(l.value)}</span>
                  <span className={l.matured ? "font-medium text-mint" : "text-muted"}>
                    {l.matured ? "Disponible" : `Vence el ${shortDate(l.maturesAt)}`}
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-muted">
                  <span>Aportado el {shortDate(l.at)}</span>
                  {!l.matured && <span className="whitespace-nowrap tabular-nums">hoy {cop(l.allowed)}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.balance >= 1 ? (
        <div className="space-y-2 border-t border-line pt-4">
          <div className="flex justify-between text-xs">
            <span className="text-muted">Puedes retirar hoy</span>
            <span className="font-medium tabular-nums">{cop(p.max)}</span>
          </div>
          <MoneyInput label="Monto a retirar" value={value} onValue={setValue} error={error} placeholder="0" hint={maxLabel ? `Máximo ${maxLabel} por retiro.` : undefined} />
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" disabled={busy || !(n > 0) || Boolean(error)} onClick={() => onWithdraw(n)}>
              Retirar
            </Button>
            <Button variant="ghost" className="flex-1" disabled={busy || p.max < 1} onClick={() => onWithdraw(p.max)}>
              Retirar {cop(p.max)}
            </Button>
          </div>
        </div>
      ) : (
        <p className="border-t border-line pt-4 text-xs text-muted">Cajita sin saldo.</p>
      )}
    </Card>
  );
}
