"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Badge, Button, Card, Choice, Input, MoneyInput, PasswordInput, Select } from "@/components/ui";
import {
  BORROWER_INCOME_SOURCES,
  CURRENCIES,
  EMPTY_REGISTRATION,
  type FieldErrors,
  fieldErrors,
  ID_FILE_TYPES,
  INVESTOR_INCOME_SOURCES,
  NATIONALITIES,
  NO_BREB_MESSAGE,
  type RegistrationData,
  type Role,
  SEX_OPTIONS,
  STEPS,
  validateIdFile,
} from "@/lib/registration";

type Files = { idFront: File | null; idBack: File | null };

const STEP_INFO = [
  { title: "Cuéntanos sobre ti", sub: "Usamos estos datos para verificar tu identidad." },
  { title: "Tu perfil", sub: "Nos ayuda a ofrecerte las condiciones adecuadas." },
  { title: "Verifica tu identidad", sub: "Sube una foto clara de tu documento por ambos lados." },
  { title: "Protege tu cuenta", sub: "Crea una contraseña segura para ingresar." },
];

export function RegisterWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole = params.get("rol");
  const [data, setData] = useState<RegistrationData>({
    ...EMPTY_REGISTRATION,
    role: initialRole === "inversor" || initialRole === "acreditado" ? initialRole : "",
  });
  const [files, setFiles] = useState<Files>({ idFront: null, idBack: null });
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState<Partial<Record<keyof RegistrationData | "idFront" | "idBack", boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const errors: FieldErrors & { idFront?: string | null; idBack?: string | null } =
    step === 2
      ? { idFront: validateIdFile(files.idFront, "lado principal"), idBack: validateIdFile(files.idBack, "lado secundario") }
      : fieldErrors(step, data);
  const show = (k: keyof typeof errors) => ((submitted || touched[k]) && errors[k]) || undefined;

  const set = <K extends keyof RegistrationData>(key: K, value: RegistrationData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setServerError("");
  };
  /** Props comunes de un campo de texto */
  const field = (key: keyof RegistrationData) => ({
    value: data[key],
    error: show(key),
    required: true,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
    onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
  });

  // Lleva el foco al primer campo con error después de intentar avanzar
  useEffect(() => {
    if (!submitted) return;
    const el = document.querySelector<HTMLElement>('[aria-invalid="true"], [role="radiogroup"][aria-describedby]');
    el?.focus();
  }, [submitted, step]);

  async function next() {
    if (Object.values(errors).some(Boolean)) return setSubmitted(true);
    setSubmitted(false);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      setTouched({});
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      for (const [k, v] of Object.entries(data)) body.set(k, v);
      body.set("idFront", files.idFront!);
      body.set("idBack", files.idBack!);
      const res = await fetch("/api/auth/register", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo crear la cuenta");
      router.push("/inicio");
      router.refresh();
    } catch (e) {
      setServerError((e as Error).message);
      setBusy(false);
    }
  }

  const colombian = data.nationality === "Colombiana";
  const blockedByBreb = step === 1 && data.role === "acreditado" && data.acceptsBreb === "no";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold sm:text-3xl">Crea tu cuenta</h1>
        <p className="text-sm text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-mint underline">
            Ingresa aquí
          </Link>
        </p>
      </div>

      <p className="text-sm sm:hidden">
        <span className="text-muted">
          Paso {step + 1} de {STEPS.length} ·
        </span>{" "}
        <span className="font-semibold">{STEPS[step]}</span>
      </p>
      <ol className="grid grid-cols-4 gap-2" aria-label="Pasos del registro">
        {STEPS.map((label, i) => (
          <li key={label} className="space-y-1.5" aria-current={i === step ? "step" : undefined}>
            <div className={`h-1.5 rounded-full transition-colors ${i < step ? "bg-mint" : i === step ? "bg-brand" : "bg-line"}`} />
            <div className={`hidden text-xs sm:block ${i === step ? "font-semibold" : "text-muted"}`}>
              {i < step ? "✓ " : `${i + 1}. `}
              {label}
            </div>
          </li>
        ))}
      </ol>

      <Card className="space-y-6 p-5 sm:p-8">
        <div>
          <h2 className="text-lg font-semibold">{STEP_INFO[step].title}</h2>
          <p className="text-sm text-muted">{STEP_INFO[step].sub}</p>
        </div>

        {step === 0 && (
          <>
            <Section title="Identificación">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Nombres" autoComplete="given-name" placeholder="Ej. María José" {...field("firstName")} />
                <Input label="Apellidos" autoComplete="family-name" placeholder="Ej. Pérez Gómez" {...field("lastName")} />
                <Select label="Nacionalidad" options={NATIONALITIES} {...field("nationality")} />
                <Input
                  label={colombian ? "Número de cédula" : "Documento de identidad"}
                  inputMode={colombian ? "numeric" : "text"}
                  placeholder={colombian ? "Sin puntos ni espacios" : "Pasaporte, DNI o ID"}
                  {...field("cedula")}
                  onChange={(e) => set("cedula", colombian ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value.slice(0, 15))}
                />
                <Input label="Edad" type="number" inputMode="numeric" min={18} max={100} placeholder="18 o más" {...field("age")} />
                <Select label="Sexo" options={SEX_OPTIONS} {...field("sex")} />
              </div>
            </Section>

            <Section title="Contacto">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Correo electrónico" type="email" autoComplete="email" placeholder="nombre@correo.com" {...field("email")} />
                <Input
                  label="Celular"
                  type="tel"
                  autoComplete="tel"
                  placeholder={colombian ? "300 123 4567" : "+1 555 123 4567"}
                  hint={colombian ? "10 dígitos" : "Incluye el indicativo del país"}
                  {...field("phone")}
                />
              </div>
              <Input label="Dirección de residencia" autoComplete="street-address" placeholder="Calle, número, barrio y ciudad" {...field("address")} />
            </Section>

            <Choice<Role>
              label="¿Cómo quieres usar la plataforma?"
              required
              value={data.role}
              error={show("role")}
              onChange={(v) => set("role", v)}
              options={[
                { id: "inversor", title: "Inversionista", sub: "Invierto desde mi wallet de Interledger" },
                { id: "acreditado", title: "Acreditado", sub: "Quiero acceder a un crédito" },
              ]}
            />
          </>
        )}

        {step === 1 && data.role === "inversor" && (
          <>
            <Input
              label="Wallet address de Interledger"
              placeholder="$ilp.interledger-test.dev/tu-nombre"
              hint="Desde aquí envías tus inversiones y aquí recibes tus retiros."
              autoComplete="off"
              spellCheck={false}
              {...field("wallet")}
            />
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
              <MoneyInput
                label="Ingreso promedio mensual"
                required
                prefix={data.investorCurrency || "$"}
                value={data.investorIncome}
                onValue={(v) => set("investorIncome", v)}
                onBlur={() => setTouched((t) => ({ ...t, investorIncome: true }))}
                error={show("investorIncome")}
              />
              <Select label="Moneda" options={CURRENCIES} {...field("investorCurrency")} />
            </div>
            <Select label="¿De dónde vienen tus ingresos?" options={INVESTOR_INCOME_SOURCES} {...field("investorIncomeSource")} />
            <Choice
              label="Tipo de actividad"
              required
              value={data.employment}
              error={show("employment")}
              onChange={(v) => set("employment", v)}
              options={[
                { id: "independiente", title: "Independiente", sub: "Trabajo por mi cuenta" },
                { id: "asalariado", title: "Asalariado", sub: "Tengo un empleador" },
              ]}
            />
          </>
        )}

        {step === 1 && data.role === "acreditado" && (
          <>
            <Select label="Fuente principal de ingresos" options={BORROWER_INCOME_SOURCES} {...field("borrowerIncomeSource")} />
            <MoneyInput
              label="Ingreso promedio mensual (COP)"
              required
              placeholder="0"
              hint="Incluye ingresos formales e informales."
              value={data.borrowerIncome}
              onValue={(v) => set("borrowerIncome", v)}
              onBlur={() => setTouched((t) => ({ ...t, borrowerIncome: true }))}
              error={show("borrowerIncome")}
            />
            <Choice
              label="¿Puedes recibir y hacer pagos por Bre-B?"
              required
              value={data.acceptsBreb}
              error={data.acceptsBreb === "no" ? undefined : show("acceptsBreb")}
              onChange={(v) => set("acceptsBreb", v)}
              options={[
                { id: "si", title: "Sí", sub: "Tengo una llave Bre-B" },
                { id: "no", title: "No", sub: "Todavía no tengo llave" },
              ]}
            />
            {data.acceptsBreb === "no" && (
              <Alert tone="warning" title="Necesitas una llave Bre-B para continuar">
                {NO_BREB_MESSAGE}
              </Alert>
            )}
            {data.acceptsBreb === "si" && (
              <Input
                label="Tu llave Bre-B"
                placeholder="Celular, cédula, correo o @alias"
                hint="Aquí recibes el crédito y desde aquí pagas tus cuotas."
                autoComplete="off"
                {...field("llaveBreb")}
              />
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FileDrop
                label="Documento · lado principal"
                file={files.idFront}
                error={show("idFront")}
                onChange={(f) => (setFiles((x) => ({ ...x, idFront: f })), setTouched((t) => ({ ...t, idFront: true })))}
              />
              <FileDrop
                label="Documento · lado secundario"
                file={files.idBack}
                error={show("idBack")}
                onChange={(f) => (setFiles((x) => ({ ...x, idBack: f })), setTouched((t) => ({ ...t, idBack: true })))}
              />
            </div>
            <ul className="space-y-1 text-xs text-muted">
              <li>• Foto nítida, sin reflejos y con los cuatro bordes visibles.</li>
              <li>• Formatos JPG, PNG, WEBP o PDF de máximo 5 MB.</li>
            </ul>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-line p-4">
              <div>
                <div className="text-sm font-medium">Verificación facial</div>
                <div className="text-xs text-muted">Te pediremos una selfie para confirmar que eres tú.</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="warn">Próximamente</Badge>
                <Button type="button" variant="ghost" disabled>
                  Iniciar
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <PasswordInput
              label="Contraseña"
              autoComplete="new-password"
              showStrength
              hint="Mínimo 8 caracteres, con letras y números."
              {...field("password")}
            />
            <PasswordInput label="Confirmar contraseña" autoComplete="new-password" {...field("password2")} />
            <label className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${show("acceptsTerms") ? "border-red-500/60" : "border-line"}`}>
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
                checked={data.acceptsTerms === "si"}
                onChange={(e) => set("acceptsTerms", e.target.checked ? "si" : "")}
                aria-invalid={show("acceptsTerms") ? true : undefined}
              />
              <span>
                Autorizo el tratamiento de mis datos personales y la consulta de información alternativa para evaluar mi perfil,
                según la Ley 1581 de 2012.
                {show("acceptsTerms") && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{show("acceptsTerms")}</span>}
              </span>
            </label>
          </>
        )}

        {serverError && (
          <Alert tone="error" title="No pudimos crear tu cuenta">
            {serverError}
          </Alert>
        )}
        {submitted && Object.values(errors).some(Boolean) && !blockedByBreb && (
          <Alert tone="error">Revisa los campos marcados en rojo para continuar.</Alert>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0 || busy}
            onClick={() => (setStep(step - 1), setSubmitted(false), setServerError(""))}
          >
            Atrás
          </Button>
          <span className="hidden text-xs text-muted sm:inline">
            Paso {step + 1} de {STEPS.length}
          </span>
          <Button type="button" onClick={next} disabled={blockedByBreb} loading={busy}>
            {busy ? "Creando cuenta…" : step === STEPS.length - 1 ? "Crear cuenta" : "Continuar"}
          </Button>
        </div>
      </Card>
      <p className="text-center text-xs text-muted">
        <span className="text-red-500">*</span> Campos obligatorios
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

function FileDrop({ label, file, error, onChange }: { label: string; file: File | null; error?: string; onChange: (f: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    // Vista previa local del archivo elegido (no sale del navegador hasta enviar)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [file]);

  return (
    <div className="text-sm">
      <label className="block cursor-pointer">
        <span className="mb-1 block font-medium">
          {label}
          <span className="text-red-500" aria-hidden="true">
            {" "}
            *
          </span>
        </span>
        <div
          className={`relative flex h-40 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition ${
            error ? "border-red-500/70" : file ? "border-mint bg-mint/5" : "border-line hover:border-brand/50"
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={label} className="h-full w-full object-cover" />
          ) : (
            <span className="px-4 text-center text-xs text-muted">
              {file ? (
                <>📄 {file.name}</>
              ) : (
                <>
                  <span className="mb-1 block text-2xl">📷</span>Toca para tomar una foto o elegir un archivo
                </>
              )}
            </span>
          )}
          {file && <span className="absolute right-2 top-2 rounded-full bg-mint px-2 py-0.5 text-[11px] font-semibold text-black">✓ Listo</span>}
        </div>
        <input type="file" accept={ID_FILE_TYPES.join(",")} className="sr-only" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      </label>
      {file && (
        <button type="button" className="mt-1 text-xs text-muted underline hover:text-foreground" onClick={() => onChange(null)}>
          Cambiar archivo
        </button>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
          ● {error}
        </p>
      )}
    </div>
  );
}
