"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/feedback";
import { Alert, Badge, Button, Card, MoneyInput, Spinner, api } from "@/components/ui";
import { LEVELS, SCORE_THRESHOLDS, type Level } from "@/lib/config";
import { cop, pct } from "@/lib/finance";
import { ID_FILE_TYPES } from "@/lib/registration";
import {
  ACTIVITY_AGE,
  CREDIT_PURCHASES,
  type DocKey,
  DOCS,
  EMPTY_STUDY,
  HOUSING_AGE,
  LIKERT,
  type Option,
  PHONE_OWNER,
  PHONE_PLAN,
  RELATIONS,
  RENT,
  SAVINGS_GROUP,
  SECTORS,
  STUDY_STEPS,
  type StudyAnswers,
  studyErrors,
  TIME_PREFERENCE,
  UTILITIES,
  VARIABILITY,
  WORKPLACE,
  YES_NO,
} from "@/lib/scoring";

interface StudyView {
  name: string;
  score: number;
  level: Level | null;
  riskLevel: Level | 4;
  recommendations: string[];
  breakdown: { key: string; label: string; points: number; max: number }[];
  maxInstallment: number;
  backing: number;
  alerts: string[];
  review: boolean;
  reasons: string[];
  ml: { probability: number; rulesLevel: Level | 4; adjustment: -1 | 0 | 1; against: string[]; inFavor: string[] } | null;
  docs: DocView[];
  retryAt: number | null;
  canRetake: boolean;
  docsCount: number;
}

interface DocView {
  key: string;
  label: string;
  valid: boolean;
  altered: boolean;
  summary: string;
  reason: string | null;
  monthlyIncome: number | null;
  hasOverdue: boolean | null;
  issuer: string | null;
  source: "gemini" | "simulado";
}

interface Me {
  firstName: string;
  name: string;
  cedula: string;
  phone: string;
}

export default function StudyPage() {
  const [study, setStudy] = useState<StudyView | null | undefined>(undefined);
  const [retake, setRetake] = useState(false);

  useEffect(() => {
    api<{ study: StudyView | null }>("/api/study")
      .then((d) => setStudy(d.study))
      .catch(() => setStudy(null));
  }, []);

  if (study === undefined)
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner /> Cargando…
      </p>
    );
  if (study && !retake) return <Result study={study} onRetake={() => setRetake(true)} />;
  return <Wizard first={!study} onDone={(s) => (setStudy(s), setRetake(false))} />;
}

// ======================================================================
// Formulario en 6 pasos
// ======================================================================

function Wizard({ first, onDone }: { first: boolean; onDone: (s: StudyView) => void }) {
  const toast = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [a, setA] = useState<StudyAnswers>(EMPTY_STUDY);
  const [docs, setDocs] = useState<Partial<Record<DocKey, File>>>({});
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    api<Me>("/api/auth/me").then(setMe).catch(() => {});
  }, []);

  const errors = studyErrors(step, a);
  const err = (k: string) => (submitted ? errors[k] : undefined);
  const set = <K extends keyof StudyAnswers>(k: K, v: StudyAnswers[K]) => setA((x) => ({ ...x, [k]: v }));
  const setDoc = (k: DocKey, f: File | null) =>
    setDocs((d) => {
      const n = { ...d };
      if (f) n[k] = f;
      else delete n[k];
      return n;
    });

  // Al intentar avanzar, lleva la vista al primer campo con error
  useEffect(() => {
    if (!submitted) return;
    document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [submitted, step]);

  async function next() {
    if (Object.keys(errors).length) return setSubmitted(true);
    setSubmitted(false);
    if (step < STUDY_STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBusy(true);
    setServerError("");
    try {
      const body = new FormData();
      body.set("answers", JSON.stringify(a));
      for (const [k, f] of Object.entries(docs)) body.set(`doc_${k}`, f as File);
      const res = await fetch("/api/study", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No pudimos procesar tu estudio");
      toast(json.level ? "success" : "info", json.level ? "¡Estudio aprobado!" : "Estudio completado", json.level ? `Quedaste en ${LEVELS[json.level as Level].name}.` : "Mira cómo mejorar tu perfil.");
      window.scrollTo({ top: 0 });
      onDone(json);
    } catch (e) {
      setServerError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const income = Number(a.income) || 0;
  const free = income - (Number(a.expenses) || 0) - (Number(a.debts) || 0);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {first && step === 0 && (
        <Alert tone="info" title="Un último paso para pedir tu crédito">
          Antes de usar la app necesitamos conocerte. Toma unos 5 minutos y no necesitas historial bancario.
        </Alert>
      )}

      <Card className="space-y-6 p-5 sm:p-8">
        <div className="space-y-2">
          <div className="h-1.5 rounded-full bg-line">
            <div className="h-1.5 rounded-full bg-brand transition-all" style={{ width: `${((step + 1) / STUDY_STEPS.length) * 100}%` }} />
          </div>
          <p className="text-xs text-muted">
            Paso {step + 1} de {STUDY_STEPS.length}
          </p>
          <h1 className="text-2xl font-semibold">{STUDY_STEPS[step].title}</h1>
          <p className="text-sm text-muted">{STUDY_STEPS[step].sub}</p>
        </div>

        {/* Paso 1 — Antes de empezar */}
        {step === 0 && (
          <>
            <div className="grid gap-3 rounded-xl border border-line p-4 text-sm sm:grid-cols-3">
              <ReadOnly label="Nombre" value={me?.name} />
              <ReadOnly label="Número de documento" value={me?.cedula} />
              <ReadOnly label="Celular" value={me?.phone} />
              <p className="text-xs text-muted sm:col-span-3">Estos datos vienen de tu registro.</p>
            </div>
            <Check checked={a.confirmAdult} onChange={(v) => set("confirmAdult", v)} error={err("confirmAdult")}>
              Confirmo que soy mayor de 18 años.
            </Check>
            <Check checked={a.consent} onChange={(v) => set("consent", v)} error={err("consent")}>
              Autorizo el tratamiento de mis datos personales (Ley 1581 de 2012 y Ley 1266 de 2008) solo para evaluar mi crédito, que
              contacten a mis referencias y que los documentos que suba se lean con inteligencia artificial (Google Gemini). Puedo revocar
              esta autorización cuando quiera.
            </Check>
          </>
        )}

        {/* Paso 2 — Ingresos y gastos */}
        {step === 1 && (
          <>
            <div data-error={Boolean(err("sector"))}>
              <label className="mb-1 block text-sm font-medium">¿A qué te dedicas?</label>
              <select
                value={a.sector}
                onChange={(e) => set("sector", e.target.value)}
                aria-invalid={err("sector") ? true : undefined}
                className={`w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 ${err("sector") ? "border-red-500 focus:ring-red-500/20" : "border-line focus:border-brand focus:ring-brand/20"}`}
              >
                <option value="" disabled>
                  Selecciona tu oficio o negocio
                </option>
                {SECTORS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              {err("sector") && <p className="mt-1 text-xs text-red-600 dark:text-red-400">● {err("sector")}</p>}
            </div>
            <div className="space-y-2" data-error={Boolean(err("income"))}>
              <MoneyInput
                label="¿Cuánto te entra en un mes normal?"
                required
                value={a.income}
                onValue={(v) => set("income", v)}
                error={err("income")}
                placeholder="0"
                hint="El extracto respalda tus ingresos, tu margen y tus deudas."
              />
              <DocUpload k="extracto" file={docs.extracto} onChange={setDoc} />
            </div>
            <div data-error={Boolean(err("expenses"))}>
              <MoneyInput
                label="¿Cuánto gasta tu hogar en un mes?"
                hint="Comida, arriendo, servicios y transporte."
                required
                value={a.expenses}
                onValue={(v) => set("expenses", v)}
                error={err("expenses")}
                placeholder="0"
              />
            </div>
            <div data-error={Boolean(err("debts"))}>
              <MoneyInput
                label="¿Cuánto pagas al mes en cuotas de deudas?"
                hint="Incluye gota a gota, almacenes y préstamos. Si no tienes, escribe 0."
                required
                value={a.debts}
                onValue={(v) => set("debts", v)}
                error={err("debts")}
                placeholder="0"
              />
            </div>
            <TextField
              label="¿Cuántas personas dependen de tus ingresos?"
              value={a.dependents}
              onChange={(v) => set("dependents", v.replace(/\D/g, "").slice(0, 2))}
              error={err("dependents")}
              placeholder="0"
              inputMode="numeric"
            />
            {income > 0 && a.expenses !== "" && a.debts !== "" && (
              <div className={`rounded-lg px-4 py-3 text-sm ${free > 0 ? "bg-brand-soft" : "bg-red-500/10"}`}>
                {free > 0 ? (
                  <>
                    Te quedan libres <b className="text-mint">{cop(free)}</b> al mes. Con eso calculamos una cuota que sí puedas pagar.
                  </>
                ) : (
                  <>Tus gastos y deudas superan tus ingresos. Revisa los valores: así no podríamos ofrecerte una cuota.</>
                )}
              </div>
            )}
            <Question label="¿Alguna de esas deudas es con un gota a gota?" error={err("loanShark")}>
              <Options list={YES_NO} value={a.loanShark} onChange={(v) => set("loanShark", v)} error={err("loanShark")} />
            </Question>
            <Question label="Semana a semana, tus ingresos…" error={err("variability")}>
              <Options list={VARIABILITY} value={a.variability} onChange={(v) => set("variability", v)} error={err("variability")} />
            </Question>
            <Question label="¿Hace cuánto tienes esta actividad o negocio?" error={err("activityAge")}>
              <Options list={ACTIVITY_AGE} value={a.activityAge} onChange={(v) => set("activityAge", v)} error={err("activityAge")} />
            </Question>
          </>
        )}

        {/* Paso 3 — Pagos del hogar */}
        {step === 2 && (
          <>
            <p className="rounded-lg bg-brand-soft px-4 py-2.5 text-xs text-muted">
              Lo que respaldas con un documento vale más que lo que solo dices.{" "}
              <Badge tone="warn">Lectura de documentos simulada</Badge>
            </p>
            <Question label="Servicios públicos (agua, luz, gas) en los últimos 6 meses" error={err("utilities")}>
              <Options list={UTILITIES} value={a.utilities} onChange={(v) => set("utilities", v)} error={err("utilities")} />
              <DocUpload k="factura" file={docs.factura} onChange={setDoc} />
            </Question>
            <Question label="Arriendo" error={err("rent")}>
              <Options list={RENT} value={a.rent} onChange={(v) => set("rent", v)} error={err("rent")} />
              {a.rent !== "propia" && <DocUpload k="arriendo" file={docs.arriendo} onChange={setDoc} />}
            </Question>
            <Question label="Celular" error={err("phonePlan")}>
              <Options list={PHONE_PLAN} value={a.phonePlan} onChange={(v) => set("phonePlan", v)} error={err("phonePlan")} />
              <DocUpload k="recargas" file={docs.recargas} onChange={setDoc} />
            </Question>
            <Question label="Natillera, cadena o fondo de ahorro" error={err("savingsGroup")}>
              <Options list={SAVINGS_GROUP} value={a.savingsGroup} onChange={(v) => set("savingsGroup", v)} error={err("savingsGroup")} />
              {a.savingsGroup !== "no" && <DocUpload k="libreta" file={docs.libreta} onChange={setDoc} />}
            </Question>
            <Question label="Compras a crédito (almacén, moto, celular)" error={err("creditPurchases")}>
              <Options list={CREDIT_PURCHASES} value={a.creditPurchases} onChange={(v) => set("creditPurchases", v)} error={err("creditPurchases")} />
              {a.creditPurchases !== "nunca" && <DocUpload k="pazysalvo" file={docs.pazysalvo} onChange={setDoc} />}
            </Question>
          </>
        )}

        {/* Paso 4 — Estabilidad */}
        {step === 3 && (
          <>
            <Question label="¿Hace cuánto vives donde vives?" error={err("housingAge")}>
              <Options list={HOUSING_AGE} value={a.housingAge} onChange={(v) => set("housingAge", v)} error={err("housingAge")} />
            </Question>
            <Question label="¿Dónde trabajas?" error={err("workplace")}>
              <Options list={WORKPLACE} value={a.workplace} onChange={(v) => set("workplace", v)} error={err("workplace")} />
            </Question>
            <Question label="¿El celular está a tu nombre?" error={err("phoneOwner")}>
              <Options list={PHONE_OWNER} value={a.phoneOwner} onChange={(v) => set("phoneOwner", v)} error={err("phoneOwner")} />
            </Question>
          </>
        )}

        {/* Paso 5 — Cómo manejas la plata */}
        {step === 4 && (
          <>
            <p className="rounded-lg bg-brand-soft px-4 py-2.5 text-xs text-muted">
              1 = nada de acuerdo · 5 = totalmente de acuerdo.{" "}
              <span className="font-medium text-foreground">
                {a.likert.filter(Boolean).length} de {LIKERT.length}
              </span>{" "}
              respondidas
            </p>
            {LIKERT.map((item, i) => (
              <Question key={i} label={`${i + 1}. ${item.text}`} error={err(`likert${i}`)}>
                <Likert value={a.likert[i]} onChange={(v) => set("likert", a.likert.map((x, j) => (j === i ? v : x)))} error={err(`likert${i}`)} />
              </Question>
            ))}
            <Question label="¿Qué prefieres?" error={err("timePref")}>
              <Options list={TIME_PREFERENCE} value={a.timePref} onChange={(v) => set("timePref", v)} error={err("timePref")} />
            </Question>
          </>
        )}

        {/* Paso 6 — Referencias */}
        {step === 5 && (
          <>
            {a.references.map((r, i) => {
              const upd = (patch: Partial<typeof r>) => set("references", a.references.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <fieldset key={i} className="space-y-3 rounded-xl border border-line p-4">
                  <legend className="px-1 text-sm font-semibold">
                    Referencia {i + 1} <span className="font-normal text-muted">(opcional)</span>
                  </legend>
                  <TextField label="Nombre" value={r.name} onChange={(v) => upd({ name: v })} error={err(`ref${i}name`)} placeholder="Nombre y apellido" />
                  <TextField label="Celular" value={r.phone} onChange={(v) => upd({ phone: v.replace(/[^\d ]/g, "") })} error={err(`ref${i}phone`)} placeholder="300 123 4567" type="tel" />
                  <div data-error={Boolean(err(`ref${i}relation`))}>
                    <label className="mb-1 block text-sm font-medium">¿Qué relación tiene contigo?</label>
                    <select
                      value={r.relation}
                      onChange={(e) => upd({ relation: e.target.value })}
                      className={`w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 ${err(`ref${i}relation`) ? "border-red-500 focus:ring-red-500/20" : "border-line focus:border-brand focus:ring-brand/20"}`}
                    >
                      <option value="" disabled>
                        Selecciona una opción
                      </option>
                      {RELATIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                    {err(`ref${i}relation`) && <p className="mt-1 text-xs text-red-600 dark:text-red-400">● {err(`ref${i}relation`)}</p>}
                  </div>
                  {r.relation === "Otro" && (
                    <TextField label="¿Cuál?" value={r.relationOther} onChange={(v) => upd({ relationOther: v })} error={err(`ref${i}relationOther`)} placeholder="Ej. compañero de la iglesia" />
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={r.notify} onChange={(e) => upd({ notify: e.target.checked })} />
                    Enviarle un mensaje para que confirme
                    <Badge tone="warn">Simulado: se da por confirmada</Badge>
                  </label>
                </fieldset>
              );
            })}
            <p className="text-xs text-muted">
              Una referencia confirmada vale 5 puntos y sin confirmar 2. Si es tu proveedor, cliente, arrendador o la administradora de tu natillera,
              además respalda lo que dijiste. No incluyas padres, hijos, hermanos ni pareja.
            </p>
          </>
        )}

        {submitted && Object.keys(errors).length > 0 && <Alert tone="error">Responde todas las preguntas marcadas para continuar.</Alert>}
        {serverError && (
          <Alert tone="error" title="No pudimos procesar tu estudio">
            {serverError}
          </Alert>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
          <Button variant="ghost" disabled={step === 0 || busy} onClick={() => (setStep(step - 1), setSubmitted(false), window.scrollTo({ top: 0 }))}>
            Atrás
          </Button>
          <Button onClick={next} loading={busy}>
            {busy ? "Calculando…" : step === STUDY_STEPS.length - 1 ? "Ver mi perfil" : "Siguiente"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-medium">{value ?? "…"}</div>
    </div>
  );
}

function Check({ checked, onChange, error, children }: { checked: boolean; onChange: (v: boolean) => void; error?: string; children: ReactNode }) {
  return (
    <div data-error={Boolean(error)}>
      <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${error ? "border-red-500/60" : "border-line"}`}>
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{children}</span>
      </label>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">● {error}</p>}
    </div>
  );
}

function Question({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2" data-error={Boolean(error)}>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400">● {error}</p>}
    </fieldset>
  );
}

function Options({ list, value, onChange, error }: { list: Option[]; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap" role="radiogroup">
      {list.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            className={`min-h-11 rounded-lg border px-4 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 sm:min-h-0 ${
              selected ? "border-brand bg-brand-soft font-medium" : error ? "border-red-500/60" : "border-line hover:border-brand/50"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Likert({ value, onChange, error }: { value: number | null; onChange: (v: number) => void; error?: string }) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2" role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} de 5`}
            onClick={() => onChange(n)}
            className={`h-11 rounded-lg border text-sm font-medium transition ${
              value === n ? "border-brand bg-brand text-white" : error ? "border-red-500/60" : "border-line hover:border-brand/50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>Nada de acuerdo</span>
        <span>Totalmente de acuerdo</span>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <div data-error={Boolean(error)}>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 ${error ? "border-red-500 focus:ring-red-500/20" : "border-line focus:border-brand focus:ring-brand/20"}`}
      />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">● {error}</p>}
    </div>
  );
}

/** Documento opcional que da más puntos */
function DocUpload({ k, file, onChange }: { k: DocKey; file?: File; onChange: (k: DocKey, f: File | null) => void }) {
  const [error, setError] = useState("");
  return (
    <div>
      <div className={`flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-xs ${file ? "border-mint bg-mint/5" : "border-line"}`}>
        <span aria-hidden="true">{file ? "✓" : "📎"}</span>
        <span className="min-w-0 flex-1">
          <span className={`block font-medium text-foreground ${file ? "truncate" : "line-clamp-2"}`}>{file ? file.name : DOCS[k]}</span>
          <span className="text-muted">{file ? "Adjunto" : "Opcional · da más puntos"}</span>
        </span>
        {file ? (
          <button type="button" className="shrink-0 rounded px-2 py-1 text-muted underline hover:text-foreground" onClick={() => onChange(k, null)}>
            Quitar
          </button>
        ) : (
          <label className="shrink-0 cursor-pointer rounded-md border border-line px-3 py-1.5 font-medium hover:border-brand/50">
            Adjuntar
            <input
              type="file"
              accept={ID_FILE_TYPES.join(",")}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (!ID_FILE_TYPES.includes(f.type)) return setError("Usa JPG, PNG, WEBP o PDF");
                if (f.size > 5 * 1024 * 1024) return setError("El archivo pesa más de 5 MB");
                setError("");
                onChange(k, f);
              }}
            />
          </label>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">● {error}</p>}
    </div>
  );
}

// ======================================================================
// Resultado
// ======================================================================

function Result({ study, onRetake }: { study: StudyView; onRetake: () => void }) {
  const router = useRouter();
  const approved = study.level !== null;
  const first = study.name.split(" ")[0];
  const retryDate = study.retryAt ? new Date(study.retryAt).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card className="space-y-6 p-5 sm:p-8">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-widest text-mint">Tu perfil de riesgo</p>
            {study.review && <Badge tone="warn">En revisión</Badge>}
          </div>
          <h1 className="text-2xl font-semibold">{approved ? `¡Aprobado, ${first}!` : `${first}, por ahora no podemos aprobarte`}</h1>
          <p className="text-sm text-muted">
            {approved
              ? "Ya puedes armar tu crédito. Este es el resumen de tu estudio."
              : retryDate
                ? `Podrás volver a solicitar desde el ${retryDate}.`
                : "Revisa qué puede cambiar y vuelve a intentarlo."}
          </p>
        </div>

        {!approved && study.reasons.length > 0 && (
          <Alert tone="warning" title="Por qué">
            <ul className="space-y-1">
              {study.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-brand-soft p-4">
            <div className="text-xs text-muted">Puntaje</div>
            <div className="text-3xl font-semibold">
              {study.score}
              <span className="text-base text-muted">/100</span>
            </div>
          </div>
          <div className="rounded-xl bg-brand-soft p-4">
            <div className="text-xs text-muted">Nivel</div>
            <div className="text-xl font-semibold">{approved ? LEVELS[study.level!].name : "Nivel 4"}</div>
            <div className="text-xs text-muted">{approved ? `${LEVELS[study.level!].risk} · ${pct(LEVELS[study.level!].rateEA)} EA` : "No apto por ahora"}</div>
          </div>
          {approved && (
            <div className="col-span-2 rounded-xl bg-brand-soft p-4 sm:col-span-1">
              <div className="text-xs text-muted">Cuota máxima cada 15 días</div>
              <div className="text-xl font-semibold">{cop(study.maxInstallment)}</div>
              <div className="text-xs text-muted">Techo del nivel {cop(LEVELS[study.level!].maxAmount)}</div>
            </div>
          )}
        </div>

        {study.ml && <MLCard ml={study.ml} level={study.riskLevel} />}

        {study.docs?.length > 0 && <DocsCard docs={study.docs} />}

        <ScoreBar score={study.score} />

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Tu perfil está respaldado al {study.backing}%</span>
          </div>
          <div className="h-2 rounded-full bg-line">
            <div className="h-2 rounded-full bg-brand" style={{ width: `${study.backing}%` }} />
          </div>
          <p className="text-xs text-muted">Lo que respaldas con documentos o con una referencia que confirma vale más que lo que solo dices.</p>
        </div>

        {study.alerts.length > 0 && (
          <Alert tone="info" title={study.alerts.length === 1 ? "Encontramos algo para revisar" : "Encontramos inconsistencias"}>
            <ul className="space-y-1">
              {study.alerts.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Alert>
        )}

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Cómo se calculó</h2>
          {study.breakdown.map((b) => (
            <div key={b.key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{b.label}</span>
                <span className="tabular-nums text-muted">
                  {b.points} / {b.max}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-line">
                <div className="h-1.5 rounded-full bg-mint" style={{ width: `${Math.min(100, (b.points / b.max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        {approved && study.recommendations.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold">Para subir tu puntaje</h2>
            <ul className="space-y-2">
              {study.recommendations.map((r) => (
                <li key={r} className="flex gap-2 text-sm">
                  <span className="mt-0.5 text-mint">✓</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={onRetake} disabled={!study.canRetake}>
            {study.canRetake ? "Repetir el estudio" : `Disponible desde el ${retryDate}`}
          </Button>
          {approved ? (
            <Button onClick={() => router.push("/credito")}>Armar mi crédito</Button>
          ) : (
            <Link href="/inicio" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-white">
              Ir al inicio
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}

/** Qué se leyó de cada documento: si respaldó respuestas o por qué no */
function DocsCard({ docs }: { docs: DocView[] }) {
  const ai = docs.some((d) => d.source === "gemini");
  return (
    <div className="space-y-3 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Documentos revisados</h2>
        <Badge>{ai ? "Leídos con IA" : "Lectura simulada"}</Badge>
      </div>
      <ul className="space-y-2">
        {docs.map((d) => (
          <li key={d.key} className="flex gap-3 text-sm">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                d.valid ? "bg-mint/15 text-mint" : d.altered ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-orange/15 text-orange"
              }`}
              aria-hidden="true"
            >
              {d.valid ? "✓" : d.altered ? "✕" : "!"}
            </span>
            <div className="min-w-0">
              <div className="font-medium">
                {d.label}
                {d.issuer && <span className="font-normal text-muted"> · {d.issuer}</span>}
              </div>
              <p className="text-xs text-muted">{d.valid ? d.summary : d.reason}</p>
              {d.valid && d.monthlyIncome !== null && <p className="text-xs">Ingreso mensual leído: {cop(d.monthlyIncome)}</p>}
              {d.valid && d.hasOverdue && <p className="text-xs text-orange">Muestra pagos atrasados o saldo vencido.</p>}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted">Los documentos que no se pudieron confirmar no cuentan como respaldo. Puedes repetir el estudio con el original.</p>
    </div>
  );
}

function MLCard({ ml, level }: { ml: NonNullable<StudyView["ml"]>; level: Level | 4 }) {
  const p = Math.round(ml.probability * 1000) / 10;
  const risk = p < 8 ? { label: "Baja", tone: "text-mint" } : p < 20 ? { label: "Media", tone: "text-orange" } : { label: "Alta", tone: "text-red-600 dark:text-red-400" };
  const name = (l: Level | 4) => (l === 4 ? "no apto" : LEVELS[l].name);
  return (
    <div className="space-y-3 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Modelo de riesgo con Machine Learning</h2>
        {ml.adjustment === 1 && <Badge tone="good">Subió tu nivel</Badge>}
        {ml.adjustment === -1 && <Badge tone="warn">Bajó tu nivel</Badge>}
        {ml.adjustment === 0 && <Badge>Confirmó tu nivel</Badge>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-semibold tabular-nums ${risk.tone}`}>{p.toLocaleString("es-CO")} %</span>
        <span className="text-sm text-muted">probabilidad estimada de atraso · {risk.label.toLowerCase()}</span>
      </div>
      <p className="text-xs text-muted">
        {ml.adjustment === 0
          ? `Aprendió de miles de créditos cómo paga la gente con un perfil como el tuyo y está de acuerdo con tu ${name(level)}.`
          : `Tus respuestas daban ${name(ml.rulesLevel)}; con lo que aprendió de miles de créditos, quedaste en ${name(level)}.`}
      </p>
      {(ml.inFavor.length > 0 || ml.against.length > 0) && (
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {ml.inFavor.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-muted">A tu favor</div>
              <ul className="space-y-1">
                {ml.inFavor.map((g) => (
                  <li key={g} className="flex gap-2">
                    <span className="text-mint">+</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ml.against.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-muted">En contra</div>
              <ul className="space-y-1">
                {ml.against.map((g) => (
                  <li key={g} className="flex gap-2">
                    <span className="text-red-600 dark:text-red-400">−</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="space-y-1">
      <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500 via-orange to-mint">
        <span className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded bg-foreground" style={{ left: `${score}%` }} aria-hidden="true" />
      </div>
      <div className="flex justify-between text-[11px] text-muted">
        <span>0</span>
        {[...SCORE_THRESHOLDS].reverse().map((t) => (
          <span key={t.level}>
            N{t.level} · {t.min}+
          </span>
        ))}
        <span>100</span>
      </div>
    </div>
  );
}
