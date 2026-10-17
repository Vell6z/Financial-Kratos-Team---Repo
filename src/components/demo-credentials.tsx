import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";

// Cuentas de prueba visibles para el jurado y los mentores: solo texto para copiar y pegar, con el rol al lado.
// Componente de servidor (las credenciales viven en src/lib/demo-accounts.ts).

const ROLE: Record<(typeof DEMO_ACCOUNTS)[number]["role"], { label: string; tone: string }> = {
  inversor: { label: "Inversionista", tone: "bg-[#7edfc8]/15 text-mint" },
  acreditado: { label: "Acreditado", tone: "bg-[#ffb259]/15 text-[#c27410] dark:text-[#ffb259]" },
  admin: { label: "Operador (admin)", tone: "bg-brand-soft text-brand-strong" },
};

export function DemoCredentials({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-card p-5 ${className}`}>
      <h2 className="font-semibold">Cuentas de prueba</h2>
      <p className="mt-1 text-sm text-muted">Copia el correo y la contraseña de la cuenta que quieras probar e inicia sesión.</p>
      <ul className="mt-4 divide-y divide-line text-sm">
        {DEMO_ACCOUNTS.map((a) => (
          <li key={a.email} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
            <span className={`w-36 shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-medium ${ROLE[a.role].tone}`}>{ROLE[a.role].label}</span>
            <span className="min-w-0 break-all">
              <span className="text-xs text-muted">Correo </span>
              <span className="select-all font-mono">{a.email}</span>
            </span>
            <span>
              <span className="text-xs text-muted">Contraseña </span>
              <span className="select-all font-mono">{a.password}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
