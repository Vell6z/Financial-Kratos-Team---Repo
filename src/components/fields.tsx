"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { passwordStrength } from "@/lib/validators";

// Campos de formulario con etiqueta, ayuda, marca de requerido y mensaje de error accesible.

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
}

function FieldShell({ id, label, hint, error, required, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="block text-sm">
      <label htmlFor={id} className="mb-1 block font-medium">
        {label}
        {required && (
          <span className="text-red-500" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="mt-1 flex items-start gap-1 text-xs text-red-600 dark:text-red-400" role="alert">
          <span aria-hidden="true">●</span>
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className="mt-1 text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export const fieldClass = (error?: string | null) =>
  `w-full rounded-lg border bg-background px-3 py-2.5 outline-none transition placeholder:text-muted/60 focus:ring-2 disabled:opacity-60 ${
    error ? "border-red-500 focus:ring-red-500/20" : "border-line focus:border-brand focus:ring-brand/20"
  }`;

export function Input({ label, hint, error, required, id, ...props }: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={required}>
      <input
        {...props}
        id={fid}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fid}-msg` : undefined}
        className={fieldClass(error)}
      />
    </FieldShell>
  );
}

export function Select({
  label,
  hint,
  error,
  required,
  options,
  placeholder = "Selecciona una opción",
  id,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps & { options: string[]; placeholder?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={required}>
      <select
        {...props}
        id={fid}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fid}-msg` : undefined}
        className={fieldClass(error)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** Monto con separador de miles. `value` y `onValue` trabajan con el número sin formato (como texto). */
export function MoneyInput({
  label,
  hint,
  error,
  required,
  value,
  onValue,
  prefix = "$",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & FieldProps & { value: string; onValue: (v: string) => void; prefix?: string }) {
  const id = useId();
  const shown = value ? new Intl.NumberFormat("es-CO").format(Number(value)) : "";
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{prefix}</span>
        <input
          {...props}
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={shown}
          // Quita ceros a la izquierda pero deja escribir un 0 solo (ej. "no tengo deudas")
          onChange={(e) => onValue(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          className={`${fieldClass(error)} tabular-nums ${prefix.length > 1 ? "pl-12" : "pl-7"}`}
        />
      </div>
    </FieldShell>
  );
}

const STRENGTH = [
  { label: "Muy débil", color: "bg-red-500" },
  { label: "Débil", color: "bg-red-500" },
  { label: "Aceptable", color: "bg-orange" },
  { label: "Buena", color: "bg-mint" },
  { label: "Excelente", color: "bg-mint" },
];

/** Contraseña con botón para mostrar u ocultar y, opcionalmente, medidor de seguridad. */
export function PasswordInput({
  label,
  hint,
  error,
  required,
  showStrength = false,
  value,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldProps & { showStrength?: boolean; value: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const strength = passwordStrength(value);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <div className="relative">
        <input
          {...props}
          id={id}
          value={value}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          className={`${fieldClass(error)} pr-20`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-muted hover:text-foreground"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {showStrength && value && (
        <div className="mt-2 flex items-center gap-2" aria-live="polite">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < strength ? STRENGTH[strength].color : "bg-line"}`} />
            ))}
          </div>
          <span className="w-20 text-right text-xs text-muted">{STRENGTH[strength].label}</span>
        </div>
      )}
    </FieldShell>
  );
}

/** Opciones grandes tipo tarjeta (selección única) */
export function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
  error,
  required,
  columns = 2,
}: {
  label: string;
  value: T | "";
  onChange: (v: T) => void;
  options: { id: T; title: string; sub?: string }[];
  error?: string | null;
  required?: boolean;
  columns?: 2 | 3;
}) {
  const id = useId();
  return (
    <div className="text-sm" role="radiogroup" aria-labelledby={`${id}-label`} aria-describedby={error ? `${id}-msg` : undefined}>
      <span id={`${id}-label`} className="mb-1 block font-medium">
        {label}
        {required && (
          <span className="text-red-500" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </span>
      <div className={`grid gap-2 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {options.map((o) => {
          const selected = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.id)}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
                selected ? "border-brand bg-brand-soft" : error ? "border-red-500/60" : "border-line hover:border-brand/50"
              }`}
            >
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-brand" : "border-line"}`}>
                {selected && <span className="h-2 w-2 rounded-full bg-brand" />}
              </span>
              <span>
                <span className="block font-medium">{o.title}</span>
                {o.sub && <span className="block text-xs text-muted">{o.sub}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p id={`${id}-msg`} className="mt-1 flex items-start gap-1 text-xs text-red-600 dark:text-red-400" role="alert">
          <span aria-hidden="true">●</span>
          {error}
        </p>
      )}
    </div>
  );
}
