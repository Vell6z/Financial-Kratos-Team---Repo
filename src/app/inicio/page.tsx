import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icons";
import { Alert, Badge, Card, Stat, fmtDate } from "@/components/ui";
import { UnauthorizedError } from "@/lib/auth";
import { LEVELS } from "@/lib/config";
import { getDashboard } from "@/lib/dashboard";
import { cop, pct } from "@/lib/finance";
import { NAV } from "@/lib/nav";
import { walletLabel } from "@/lib/validators";

export default async function HomePage() {
  const data = await getDashboard().catch((err) => {
    if (err instanceof UnauthorizedError) redirect("/login?next=/inicio");
    throw err;
  });
  const actions = NAV[data.role].filter((n) => n.href !== "/inicio");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">{data.role === "inversor" ? "Inversionista" : "Acreditado"}</p>
        <h1 className="text-3xl font-semibold">Hola, {data.firstName} 👋</h1>
      </div>

      <Notices data={data} />

      {data.role === "inversor" ? (
        <Card className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <Stat label="Saldo total" value={cop(data.balance)} />
          <Stat label="Rendimiento" value={<span className="text-mint">{cop(data.gains)}</span>} />
          <div className="col-span-2 sm:col-span-1">
            <Stat label="Wallet Interledger" value={<span className="break-all text-sm font-medium">{data.wallet ? walletLabel(data.wallet) : "Sin asignar"}</span>} />
          </div>
          {data.positions.length > 0 && (
            <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-3">
              {data.positions.map((p) => (
                <Badge key={p.level}>
                  {LEVELS[p.level].name} · {pct(p.rate)} EA · {cop(p.balance)}
                </Badge>
              ))}
            </div>
          )}
          {data.positions.length === 0 && <p className="col-span-2 text-sm text-muted sm:col-span-3">Aún no tienes inversiones. Empieza eligiendo un nivel de riesgo.</p>}
        </Card>
      ) : (
        <Card className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <Stat
            label="Tu nivel"
            value={data.level ? LEVELS[data.level].name : data.evaluated ? "No aprobado aún" : "Sin estudio"}
            sub={data.score !== null ? `Puntaje ${data.score}/100` : "Haz tu estudio de crédito"}
          />
          <div className="order-last col-span-2 sm:order-none sm:col-span-1">
          <Stat
            label="Crédito actual"
            value={data.activeLoan ? cop(data.activeLoan.amount) : "Ninguno"}
            sub={
              data.activeLoan?.status === "en_espera"
                ? "En espera de fondeo"
                : data.activeLoan?.nextInstallment
                  ? `${data.activeLoan.overdue ? "Cuota vencida" : "Próxima cuota"} ${cop(data.activeLoan.nextDue ?? data.activeLoan.nextInstallment.payment)} · ${fmtDate(data.activeLoan.nextInstallment.dueAt)}`
                  : undefined
            }
          />
          </div>
          <Stat label="Pagados a tiempo" value={data.paidOnTime} sub="Cada uno te sube un nivel" />
        </Card>
      )}

      <section>
        <h2 className="mb-3 font-semibold">¿Qué quieres hacer?</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="group rounded-xl border border-line bg-card p-5 transition hover:border-brand">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                <Icon name={a.icon} />
              </span>
              <div className="mt-3 font-semibold group-hover:text-mint">{a.label}</div>
              <div className="text-sm text-muted">{a.description}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

/** Avisos importantes arriba del resumen */
function Notices({ data }: { data: Dashboard }) {
  const link = (href: string, label: string) => (
    <Link href={href} className="inline-block rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
      {label}
    </Link>
  );
  if (data.role === "inversor") {
    if (!data.wallet)
      return (
        <Alert tone="warning" title="Asigna tu wallet de Interledger" action={link("/invertir", "Asignar wallet")}>
          La necesitas para invertir y recibir tus retiros.
        </Alert>
      );
    return null;
  }
  const loan = data.activeLoan;
  const next = loan?.nextInstallment;
  if (loan?.overdue && next)
    return (
      <Alert tone="error" title={`Tienes una cuota vencida hace ${loan.daysLate} ${loan.daysLate === 1 ? "día" : "días"}`} action={link("/mi-credito", "Pagar ahora")}>
        Paga {cop(loan.nextDue ?? next.payment)} cuanto antes: los atrasos te impiden subir de nivel.
      </Alert>
    );
  if (loan && next && loan.daysToNext !== null && loan.daysToNext <= 3)
    return (
      <Alert
        tone="warning"
        title={loan.daysToNext <= 0 ? "Tu cuota vence hoy" : `Tu cuota vence en ${loan.daysToNext} ${loan.daysToNext === 1 ? "día" : "días"}`}
        action={link("/mi-credito", "Pagar cuota")}
      >
        {cop(loan.nextDue ?? next.payment)} el {fmtDate(next.dueAt)}.
      </Alert>
    );
  if (!data.evaluated)
    return (
      <Alert tone="info" title="Empieza por tu estudio de crédito" action={link("/credito", "Hacer estudio")}>
        Son 12 preguntas y no necesitas historial bancario.
      </Alert>
    );
  return null;
}
