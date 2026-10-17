"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrebQrScanner } from "@/components/breb-qr-scanner";
import { ConfirmDialog, useToast } from "@/components/feedback";
import { Alert, Badge, Button, Card, Choice, Input, MoneyInput, PageHeader, Spinner, api } from "@/components/ui";
import { bankName, BREB_KEY_TYPE_IDS, BREB_KEY_TYPES, SANDBOX_KEYS, brebKeyFormatError, detectBrebKeyType, normalizeBrebKey, type BrebKeyType } from "@/lib/breb-keys";
import { CREDIT_PURPOSES, creditTypeLabel, DELINQUENCY, INSTALLMENT_DAYS, LEVELS, MIN_INSTALLMENTS, MIN_LOAN, type CreditPurpose, type Level } from "@/lib/config";
import { buildSchedule, cop, pct } from "@/lib/finance";
import { creditLimit } from "@/lib/scoring";
import { validateMoney } from "@/lib/validators";

interface Verification {
  id: string;
  key: string;
  keyType: BrebKeyType;
  holderName: string;
  financialEntity: { name: string; code: string };
  nameMatches: boolean;
  mode: "sandbox" | "production" | "simulado";
  expiresAt: number;
}


interface Evaluation {
  name: string;
  score: number;
  level: Level | null;
  recommendations: string[];
  maxInstallment: number;
}

export default function CreditPage() {
  const router = useRouter();
  const [study, setStudy] = useState<Evaluation | null>(null);
  // null mientras carga: la oferta arranca con la llave registrada en el perfil
  const [llave, setLlave] = useState<string | null>(null);
  const [hasActiveLoan, setHasActiveLoan] = useState<boolean | null>(null);

  useEffect(() => {
    api<{ study: Evaluation | null }>("/api/study")
      .then((d) => setStudy(d.study))
      .catch(() => {});
    api<{ borrowerProfile?: { llaveBreb: string } }>("/api/auth/me")
      .then((u) => setLlave(u.borrowerProfile?.llaveBreb ?? ""))
      .catch(() => setLlave(""));
    api<{ loans: { status: string }[] }>("/api/loans")
      .then((d) => setHasActiveLoan(d.loans.some((l) => l.status !== "pagado" && l.status !== "cancelado")))
      .catch(() => setHasActiveLoan(false));
  }, []);

  if (hasActiveLoan === null || !study || llave === null)
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner /> Cargando…
      </p>
    );

  if (hasActiveLoan)
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Acreditado" title="Pedir crédito" />
        <Alert
          tone="info"
          title="Ya tienes un crédito vigente"
          action={
            <Link href="/mi-credito" className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
              Ver mi crédito
            </Link>
          }
        >
          Termina de pagarlo para pedir uno nuevo. Si lo pagas a tiempo, subirás de nivel y tendrás mejores condiciones.
        </Alert>
      </div>
    );

  if (!study.level)
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Acreditado" title="Pedir crédito" />
        <Alert
          tone="warning"
          title="Tu estudio aún no está aprobado"
          action={
            <Link href="/estudio" className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
              Ver mi estudio
            </Link>
          }
        >
          Revisa cómo mejorar tu perfil y vuelve a hacer el estudio cuando estés listo.
        </Alert>
      </div>
    );

  return <LoanOffer evaluation={study} defaultLlave={llave} onDone={() => router.push("/mi-credito")} />;
}

function LoanOffer({ evaluation, defaultLlave, onDone }: { evaluation: Evaluation; defaultLlave: string; onDone: () => void }) {
  const cfg = LEVELS[evaluation.level!];
  const minN = Math.max(MIN_INSTALLMENTS, Math.ceil(cfg.minDays / INSTALLMENT_DAYS));
  const maxN = Math.floor(cfg.maxDays / INSTALLMENT_DAYS);
  // Arranca con el plazo más corto cuyo cupo permite el crédito mínimo, y un monto que quepa en ese cupo
  const [initial] = useState(() => {
    for (let k = minN; k <= maxN; k++) {
      const cap = creditLimit(evaluation.level!, evaluation.maxInstallment, k);
      if (cap >= MIN_LOAN) return { amount: Math.min(1_000_000, cap), n: k };
    }
    return { amount: MIN_LOAN, n: maxN };
  });
  const [amount, setAmount] = useState(String(initial.amount));
  const [n, setN] = useState(initial.n);
  const [llave, setLlave] = useState(defaultLlave);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Para qué lo usará (negocio u hogar), y la aceptación del contrato y el pagaré (simulados)
  const [purpose, setPurpose] = useState<CreditPurpose | "">("");
  const [contractOpen, setContractOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const toast = useToast();

  const value = Number(amount) || 0;
  // Cupo: el menor entre el techo del nivel y lo que alcanza a pagar en el plazo elegido
  const limit = creditLimit(evaluation.level!, evaluation.maxInstallment, n);
  const amountError =
    limit < MIN_LOAN
      ? "Con este plazo tu cupo no alcanza el crédito mínimo: elige más cuotas"
      : validateMoney(amount, { min: MIN_LOAN, max: limit, label: "cuánto necesitas" });
  // Llave Bre-B: el tipo se sugiere por el formato, pero el usuario lo puede cambiar (celular y cédula pueden tener 10 dígitos)
  const [keyType, setKeyType] = useState<BrebKeyType>(() => detectBrebKeyType(normalizeBrebKey(defaultLlave)));
  const [typeTouched, setTypeTouched] = useState(false);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [scanning, setScanning] = useState(false);
  // La llave del diálogo vino de un QR escaneado
  const [fromQr, setFromQr] = useState(false);
  const [mode, setMode] = useState<Verification["mode"] | null>(null);
  const key = normalizeBrebKey(llave);
  const llaveError = brebKeyFormatError(key, keyType);
  useEffect(() => {
    api<{ mode: Verification["mode"] }>("/api/breb/verify")
      .then((d) => setMode(d.mode))
      .catch(() => {});
  }, []);
  function changeKey(v: string) {
    setLlave(v);
    setVerification(null); // si cambia la llave, hay que verificarla de nuevo
    if (!typeTouched) setKeyType(detectBrebKeyType(normalizeBrebKey(v)));
  }
  function changeType(t: BrebKeyType) {
    setKeyType(t);
    setTypeTouched(true);
    setVerification(null);
  }
  const [startAt] = useState(() => Date.now());
  const schedule = useMemo(() => buildSchedule(value || MIN_LOAN, cfg.rateEA, n, startAt), [value, cfg.rateEA, n, startAt]);
  const total = schedule.reduce((s, i) => s + i.payment, 0);
  const tooHigh = !amountError && schedule[0].payment > evaluation.maxInstallment;

  /** Paso 1: consultar la llave en el directorio Bre-B y mostrar el titular para que lo confirme */
  async function verify(from?: { key: string; keyType: BrebKeyType }) {
    setTouched(true);
    const target = from ?? { key, keyType };
    if (amountError || tooHigh || !purpose || (!from && llaveError)) return;
    setVerifying(true);
    setError("");
    setFromQr(Boolean(from));
    try {
      setVerification(await api<Verification>("/api/breb/verify", target));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  /** Paso 2: el usuario confirmó el beneficiario; el servidor usa la llave verificada, no la del formulario */
  async function request() {
    if (!verification) return;
    if (verification.expiresAt < Date.now()) {
      setVerification(null);
      setError("La verificación de tu llave venció. Verifícala de nuevo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const loan = await api<{ status: string; disbursement?: { rejectedReason?: string } }>("/api/loans", {
        amount: value,
        installments: n,
        verificationId: verification.id,
        confirmBeneficiary: true,
        purpose,
        acceptTerms: accepted,
      });
      if (loan.status === "activo") toast("success", "¡Crédito desembolsado!", `Enviamos ${cop(value)} a tu llave Bre-B ${verification.key}.`);
      else if (loan.status === "cancelado") toast("error", "No pudimos desembolsar", loan.disbursement?.rejectedReason ?? "Tu llave no pasó la verificación.");
      else toast("warning", "Crédito en espera de fondeo", "Está aprobado; lo desembolsamos en cuanto haya capital en el pool.");
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setVerification(null);
      setContractOpen(false);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Pedir crédito" title={`Tu crédito, ${evaluation.name.split(" ")[0]}`} description="Ajusta el monto y el plazo. Ves la cuota exacta antes de solicitar." />
      <div className="flex flex-wrap gap-2">
        <Badge tone="good">{cfg.name}</Badge>
        <Badge>Puntaje {evaluation.score}/100</Badge>
        <Badge>Tasa {pct(cfg.rateEA)} EA</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="space-y-6 p-6">
          <div className="space-y-3">
            <MoneyInput
              label="¿Cuánto necesitas?"
              required
              value={amount}
              onValue={setAmount}
              error={amountError}
              hint={`Tu cupo con ${n} cuotas es ${cop(Math.max(limit, 0))} (techo del ${cfg.name}: ${cop(cfg.maxAmount)}).`}
            />
            <input
              type="range"
              aria-label="Ajustar monto"
              min={MIN_LOAN}
              max={Math.max(limit, MIN_LOAN)}
              // El cupo se redondea a miles: con pasos de $1.000 la barra llega justo al cupo
              step={1_000}
              value={Math.min(Math.max(value, MIN_LOAN), Math.max(limit, MIN_LOAN))}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full accent-[var(--brand)]"
            />
            <div className="flex justify-between text-[11px] text-muted tabular-nums">
              <span>{cop(MIN_LOAN)}</span>
              <span>Tu cupo {cop(Math.max(limit, MIN_LOAN))}</span>
            </div>
          </div>

          <div className="text-sm">
            <span className="mb-2 block font-medium">¿En cuántas cuotas? (una cada 15 días, mínimo 2)</span>
            <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap" role="radiogroup" aria-label="Número de cuotas">
              {Array.from({ length: maxN - minN + 1 }, (_, i) => minN + i).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={n === k}
                  onClick={() => setN(k)}
                  className={`rounded-lg border px-2 py-2 text-center transition sm:px-3 sm:text-left ${n === k ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50"}`}
                >
                  <span className="block font-medium">
                    {k}
                    <span className="hidden sm:inline"> cuotas</span>
                  </span>
                  <span className="block text-xs text-muted">{k * INSTALLMENT_DAYS} días</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">Llave Bre-B donde recibes el dinero</span>
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium transition hover:border-brand/50"
                >
                  <span aria-hidden="true">⌗</span> Escanear QR Bre-B
                </button>
              </div>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de llave">
                {BREB_KEY_TYPE_IDS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={keyType === t}
                    onClick={() => changeType(t)}
                    className={`min-h-9 rounded-full border px-3 text-xs transition ${keyType === t ? "border-brand bg-brand-soft font-medium" : "border-line text-muted hover:border-brand/50"}`}
                  >
                    {BREB_KEY_TYPES[t]}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label={BREB_KEY_TYPES[keyType]}
              required
              placeholder={SANDBOX_KEYS[keyType]}
              value={llave}
              onChange={(e) => changeKey(e.target.value)}
              onBlur={() => setTouched(true)}
              error={touched ? llaveError : null}
              hint="La misma llave desde la que pagarás tus cuotas. Antes de desembolsar confirmamos a nombre de quién está."
            />
            {mode && mode !== "production" && (
              <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs text-muted">
                {mode === "sandbox" ? "Directorio Bre-B de pruebas (Wompi sandbox)" : "Verificación simulada"}: solo reconoce{" "}
                {BREB_KEY_TYPE_IDS.map((t, i) => (
                  <span key={t}>
                    {i > 0 && ", "}
                    <button type="button" className="font-medium text-foreground underline" onClick={() => (changeType(t), changeKey(SANDBOX_KEYS[t]))}>
                      {SANDBOX_KEYS[t]}
                    </button>
                  </span>
                ))}
                .
              </p>
            )}
          </div>
          <div className="space-y-3">
            <div className="text-sm">
              <span className="font-medium">
                ¿Para qué vas a usar el crédito?<span className="text-red-500" aria-hidden="true"> *</span>
              </span>
              <p className="text-xs text-muted">Puede ser para tu negocio o para ti y tu hogar.</p>
            </div>
            {(
              [
                ["productivo", "Para tu negocio o trabajo"],
                ["consumo", "Para ti y tu hogar"],
              ] as const
            ).map(([kind, label]) => (
              <Choice
                key={kind}
                label={label}
                value={CREDIT_PURPOSES.some((p) => p.id === purpose && p.kind === kind) ? purpose : ""}
                onChange={setPurpose}
                options={CREDIT_PURPOSES.filter((p) => p.kind === kind).map((p) => ({ id: p.id, title: p.title, sub: p.sub }))}
              />
            ))}
            {touched && !purpose && <p className="text-xs text-red-600 dark:text-red-400">● Elige para qué lo usarás</p>}
          </div>
        </Card>

        <Card className="h-fit space-y-4 p-6 lg:sticky lg:top-20">
          <h2 className="font-semibold">Resumen</h2>
          <dl className="space-y-2 text-sm">
            <SummaryRow k="Monto" v={cop(value)} />
            <SummaryRow k="Cuotas" v={`${n} · cada 15 días`} />
            <SummaryRow k="Tasa" v={`${pct(cfg.rateEA)} EA`} />
            <SummaryRow k="Intereses" v={cop(Math.max(0, total - value))} />
            <SummaryRow k="Tu máximo por cuota" v={cop(evaluation.maxInstallment)} />
          </dl>
          <div className={`rounded-lg p-4 ${tooHigh ? "bg-red-500/10" : "bg-brand-soft"}`}>
            <div className="text-xs text-muted">Cuota cada 15 días</div>
            <div className="text-2xl font-semibold tabular-nums">{cop(schedule[0].payment)}</div>
            <div className="text-xs text-muted">Total a pagar {cop(total)}</div>
          </div>
          {tooHigh && (
            <Alert tone="warning" title="La cuota supera tu capacidad de pago">
              Elige más cuotas o un monto menor para que la cuota no pase de {cop(evaluation.maxInstallment)}.
            </Alert>
          )}
          {error && (
            <Alert tone="error" title="No se pudo solicitar">
              {error}
            </Alert>
          )}
          <Button onClick={() => verify()} loading={verifying} className="w-full py-2.5" disabled={Boolean(amountError) || tooHigh}>
            {verifying ? "Verificando tu llave…" : "Verificar llave y solicitar"}
          </Button>
          <p className="text-center text-[11px] text-muted">El dinero llega a tu llave Bre-B al instante si hay capital disponible.</p>
        </Card>
      </div>

      {scanning && (
        <BrebQrScanner
          onClose={() => setScanning(false)}
          onUse={(qr) => {
            // La llave del QR pasa al formulario y se consulta en el directorio Bre-B; el titular lo confirma el usuario
            setScanning(false);
            setLlave(qr.key);
            setKeyType(qr.keyType);
            setTypeTouched(true);
            setVerification(null);
            void verify({ key: qr.key, keyType: qr.keyType });
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(verification) && !contractOpen}
        title="Beneficiario encontrado"
        confirmLabel="Es mi cuenta, continuar"
        onConfirm={() => (setAccepted(false), setContractOpen(true))}
        onCancel={() => setVerification(null)}
      >
        {verification && (
          <div className="space-y-3">
            <dl className="space-y-1.5 rounded-lg bg-brand-soft p-3">
              <BeneficiaryRow k="Titular" v={verification.holderName} />
              <BeneficiaryRow k="Entidad" v={bankName(verification.financialEntity.name)} />
              <BeneficiaryRow k="Llave" v={`${verification.key} · ${BREB_KEY_TYPES[verification.keyType]}`} />
              <BeneficiaryRow k="Monto" v={cop(value)} />
            </dl>
            {verification.nameMatches ? (
              <p className="text-sm">¿Confirmas que esta es tu cuenta? Enviaremos el dinero solo a esta llave.</p>
            ) : (
              <Alert tone="warning" title="El titular no parece coincidir con tu nombre">
                Solo confirma si la cuenta es tuya. Si no lo es, cancela y usa una llave a tu nombre.
              </Alert>
            )}
            {fromQr && <p className="text-[11px] text-muted">Llave leída del QR Bre-B. El titular y el banco vienen del directorio, no del QR.</p>}
            {verification.mode !== "production" && (
              <p className="text-[11px] text-muted">{verification.mode === "sandbox" ? "Consultado en el directorio de pruebas de Wompi." : "Verificación simulada."}</p>
            )}
          </div>
        )}
      </ConfirmDialog>
      {/* Contrato y pagaré SIMULADOS: el acreditado los acepta antes de solicitar */}
      <ConfirmDialog
        open={Boolean(verification) && contractOpen}
        title="Contrato de crédito y pagaré"
        confirmLabel="Acepto y solicito el crédito"
        loading={busy}
        onConfirm={() => (accepted ? request() : setError("Marca la casilla para aceptar el contrato."))}
        onCancel={() => (setContractOpen(false), setVerification(null))}
      >
        <div className="space-y-3 text-sm">
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
            SIMULACIÓN: documento de demostración, sin validez legal.
          </p>
          <dl className="space-y-1.5 rounded-lg bg-brand-soft p-3">
            <BeneficiaryRow k="Tipo" v={creditTypeLabel(purpose)} />
            <BeneficiaryRow k="Destino" v={CREDIT_PURPOSES.find((p) => p.id === purpose)?.title ?? "—"} />
            <BeneficiaryRow k="Monto" v={cop(value)} />
            <BeneficiaryRow k="Tasa" v={`${pct(cfg.rateEA)} efectiva anual, fija`} />
            <BeneficiaryRow k="Cuotas" v={`${n} de ${cop(schedule[0].payment)}, una cada ${INSTALLMENT_DAYS} días`} />
            <BeneficiaryRow k="Total a pagar" v={cop(total)} />
          </dl>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
            <li>La tasa está por debajo del tope de usura. No hay comisiones, seguros ni costos adicionales.</li>
            <li>
              Cada cuota tiene {DELINQUENCY.daysToPay} días para pagarse desde su vencimiento. Los atrasos bajan tu nivel para el siguiente crédito; en este piloto no hay interés
              de mora.
            </li>
            <li>
              Autorizo que, si llego a {DELINQUENCY.reportDays} días de mora y después de un aviso previo, los datos de esta obligación se reporten a las centrales de riesgo
              (Ley 1266 de 2008).
            </li>
            <li>Firmo un pagaré por el valor del crédito a favor de la plataforma.</li>
          </ul>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>Leí y acepto el contrato de crédito y el pagaré.</span>
          </label>
          {error && <Alert tone="error" title="No se pudo solicitar">{error}</Alert>}
        </div>
      </ConfirmDialog>
    </div>
  );
}

function BeneficiaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium tabular-nums">{v}</dd>
    </div>
  );
}
