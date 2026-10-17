import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { APP_NAME, LEVEL_IDS, LEVELS } from "@/lib/config";
import { cop, pct } from "@/lib/finance";

const steps = [
  {
    n: "01",
    title: "Inviertes desde cualquier país",
    text: "El inversionista elige un nivel de riesgo y envía dinero desde su wallet. Interledger cotiza y convierte la moneda.",
    tag: "Interledger",
  },
  {
    n: "02",
    title: "Evaluamos sin historial bancario",
    text: "El solicitante hace un estudio con datos alternativos: servicios públicos, celular, arriendo, ahorro y preguntas psicométricas.",
    tag: "Scoring",
  },
  {
    n: "03",
    title: "Desembolsamos en pesos al instante",
    text: "Si aprueba, recibe el crédito en su llave Bre-B, en cualquier banco o billetera de Colombia.",
    tag: "Bre-B",
  },
  {
    n: "04",
    title: "Paga por quincenas y sube de nivel",
    text: "Paga sus cuotas por Bre-B. Cada crédito pagado a tiempo construye historial y mejora sus condiciones.",
    tag: "Bre-B",
  },
  {
    n: "05",
    title: "El inversionista recibe su rendimiento",
    text: "Su saldo crece con interés compuesto y lo retira cuando quiera, de vuelta a su wallet por Interledger.",
    tag: "Interledger",
  },
];

const tagColor: Record<string, string> = {
  Interledger: "bg-[#7edfc8]/15 text-mint",
  "Bre-B": "bg-[#ffb259]/15 text-[#c27410] dark:text-[#ffb259]",
  Scoring: "bg-[#959ff9]/15 text-[#5560d6] dark:text-[#959ff9]",
};

export default async function Home() {
  const user = await currentUser();
  const investHref = user ? "/invertir" : "/registro?rol=inversor";
  const creditHref = user ? "/credito" : "/registro?rol=acreditado";

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0b0b0d] text-white">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#80409d] opacity-40 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-[#7edfc8] opacity-15 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28">
          <div className="space-y-6">
            <p className="text-sm font-medium uppercase tracking-widest text-[#7edfc8]">Inversión global · Crédito local</p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Capital del mundo para quienes <span className="text-[#7edfc8]">el banco no ve</span>.
            </h1>
            <p className="max-w-xl text-lg text-white/75">
              {APP_NAME} conecta a inversionistas de cualquier país con colombianos no bancarizados. El dinero viaja por
              Interledger, se presta en pesos por Bre-B y cada pago construye historial crediticio.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={investHref} className="flex-1 rounded-lg bg-[#80409d] px-5 py-3 text-center sm:flex-none font-medium text-white hover:bg-[#8f4daf]">
                Quiero invertir
              </Link>
              <Link href={creditHref} className="flex-1 rounded-lg border border-white/25 px-5 py-3 text-center sm:flex-none font-medium text-white hover:bg-white/10">
                Quiero un crédito
              </Link>
            </div>
          </div>
          <FlowCard />
        </div>
      </section>

      {/* Problema */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-widest text-mint">El problema</p>
            <h2 className="text-3xl font-semibold leading-tight">Sin historial no hay crédito. Sin crédito no hay historial.</h2>
            <p className="text-muted">
              Millones de colombianos trabajan, pagan sus servicios y ahorran en natilleras, pero no existen para el sistema
              financiero. Cuando necesitan dinero, terminan en el &quot;gota a gota&quot;, con intereses abusivos y cobros violentos.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { t: "Personas invisibles", d: "Sin historial en centrales de riesgo, los bancos no tienen cómo evaluarlas." },
              { t: "Crédito informal", d: "El gota a gota llena el vacío con tasas fuera de la ley y sin ningún respaldo." },
              { t: "Capital que no llega", d: "Inversionistas en el exterior no tienen una vía simple y abierta para financiar en Colombia." },
              { t: "Nuestra respuesta", d: "Datos alternativos para evaluar, Interledger para mover el capital y Bre-B para la última milla.", highlight: true },
            ].map((c) => (
              <div key={c.t} className={`rounded-xl border p-5 ${c.highlight ? "border-brand bg-brand-soft" : "border-line bg-card"}`}>
                <h3 className="font-semibold">{c.t}</h3>
                <p className="mt-2 text-sm text-muted">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <p className="text-sm font-medium uppercase tracking-widest text-mint">Cómo funciona</p>
          <h2 className="mt-2 text-3xl font-semibold">El dinero da la vuelta completa</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {steps.map((s) => (
              <li key={s.n} className="flex flex-col rounded-xl border border-line bg-background p-5">
                <span className="text-sm font-semibold text-muted">{s.n}</span>
                <h3 className="mt-2 font-semibold leading-snug">{s.title}</h3>
                <p className="mt-2 flex-1 text-sm text-muted">{s.text}</p>
                <span className={`mt-4 self-start rounded-full px-2.5 py-0.5 text-xs font-medium ${tagColor[s.tag]}`}>{s.tag}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Para quién */}
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-20 lg:grid-cols-2">
        <Audience
          kicker="Para inversionistas"
          title="Rentabilidad con impacto, desde tu wallet"
          points={[
            "Elige tu perfil de riesgo: más riesgo, más rendimiento.",
            "Tu saldo crece con interés compuesto, como una cajita.",
            "Al cumplir el plazo de tu nivel retiras todo; antes, hasta el 50 %. Directo a tu wallet de Interledger.",
            "Cada peso financia a una persona real en Colombia.",
          ]}
          cta={{ href: investHref, label: "Empezar a invertir" }}
        />
        <Audience
          kicker="Para solicitantes"
          title="Tu primer crédito, sin papeleo ni banco"
          points={[
            "No necesitas historial bancario ni codeudor.",
            "Estudio en minutos con tus hábitos de pago reales.",
            "Recibe el dinero en tu llave Bre-B, en cualquier banco.",
            "Paga a tiempo y sube de nivel: más monto y menos tasa.",
          ]}
          cta={{ href: creditHref, label: "Hacer mi estudio" }}
          accent
        />
      </section>

      {/* Niveles */}
      <section className="border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <p className="text-sm font-medium uppercase tracking-widest text-mint">Niveles de riesgo</p>
          <h2 className="mt-2 text-3xl font-semibold">Transparente para ambos lados</h2>
          <p className="mt-2 max-w-2xl text-muted">
            La tasa que paga el solicitante es la que renta la cajita del inversionista de ese nivel.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {LEVEL_IDS.map((l) => {
              const c = LEVELS[l];
              return (
                <div key={l} className="rounded-xl border border-line bg-background p-6">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-xs text-muted">{c.risk}</span>
                  </div>
                  <div className="mt-4 text-4xl font-semibold text-mint">{pct(c.rateEA)}</div>
                  <div className="text-xs text-muted">efectivo anual</div>
                  <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-muted">
                    <li>Crédito hasta {cop(c.maxAmount)}</li>
                    <li>
                      Plazo de {c.minDays} a {c.maxDays} días
                    </li>
                    <li>Cuotas quincenales</li>
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tecnología */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className="text-sm font-medium uppercase tracking-widest text-mint">Tecnología abierta</p>
        <h2 className="mt-2 text-3xl font-semibold">Dos redes de pago, un solo flujo</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-card p-6">
            <h3 className="text-lg font-semibold">Interledger · Open Payments</h3>
            <p className="mt-2 text-sm text-muted">
              Protocolo abierto para mover dinero entre wallets y monedas distintas. El inversionista autoriza cada pago en su
              propia wallet y la tasa de cambio la define la cotización de la red.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-card p-6">
            <h3 className="text-lg font-semibold">Bre-B</h3>
            <p className="mt-2 text-sm text-muted">
              El sistema de pagos inmediatos de Colombia. Desembolsamos y recibimos las cuotas con una llave (celular, cédula
              o correo), sin importar el banco o la billetera del usuario.
            </p>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 pb-20">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl bg-[#0b0b0d] px-8 py-14 text-center text-white">
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#80409d] opacity-40 blur-3xl" />
          <div className="absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-[#7edfc8] opacity-20 blur-3xl" />
          <div className="relative space-y-5">
            <h2 className="text-3xl font-semibold">Hagamos que Interledger llegue a cada colombiano</h2>
            <p className="mx-auto max-w-xl text-white/75">Invierte con impacto desde tu wallet o pide tu primer crédito sin historial bancario.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href={user ? "/inicio" : "/registro"} className="w-full rounded-lg bg-[#80409d] px-5 py-3 font-medium hover:bg-[#8f4daf] sm:w-auto">
                {user ? "Ir a mi cuenta" : "Crear cuenta"}
              </Link>
              {!user && (
                <Link href="/login" className="w-full rounded-lg border border-white/25 px-5 py-3 font-medium hover:bg-white/10 sm:w-auto">
                  Ya tengo cuenta
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FlowCard() {
  const node = "rounded-xl border border-white/10 bg-white/5 px-4 py-3";
  const arrow = (label: string, color: string) => (
    <div className="flex items-center gap-2 pl-6 text-xs">
      <span className="h-6 w-px" style={{ background: color }} />
      <span style={{ color }}>{label}</span>
    </div>
  );
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
      <div className={node}>
        <div className="text-xs text-white/60">Inversionista · USD, EUR, MXN…</div>
        <div className="font-medium">Wallet de Interledger</div>
      </div>
      {arrow("Open Payments", "#7edfc8")}
      <div className={`${node} border-[#80409d]/60 bg-[#80409d]/20`}>
        <div className="text-xs text-white/60">{APP_NAME}</div>
        <div className="font-medium">Bóveda · cajitas por nivel</div>
      </div>
      {arrow("Bre-B · desembolso en COP", "#ffb259")}
      <div className={node}>
        <div className="text-xs text-white/60">Solicitante no bancarizado</div>
        <div className="font-medium">Crédito con cuotas quincenales</div>
      </div>
      <div className="mt-4 rounded-lg bg-[#7edfc8]/10 px-3 py-2 text-xs text-[#7edfc8]">
        ↺ Las cuotas vuelven a la bóveda por Bre-B y el rendimiento al inversionista por Interledger.
      </div>
    </div>
  );
}

function Audience({
  kicker,
  title,
  points,
  cta,
  accent,
}: {
  kicker: string;
  title: string;
  points: string[];
  cta: { href: string; label: string };
  accent?: boolean;
}) {
  return (
    <div className={`flex flex-col rounded-2xl border p-8 ${accent ? "border-brand bg-brand-soft" : "border-line bg-card"}`}>
      <p className="text-sm font-medium uppercase tracking-widest text-mint">{kicker}</p>
      <h3 className="mt-2 text-2xl font-semibold">{title}</h3>
      <ul className="mt-6 flex-1 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex gap-3 text-sm">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mint" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <Link href={cta.href} className="mt-8 w-full self-start rounded-lg text-center sm:w-auto bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90">
        {cta.label}
      </Link>
    </div>
  );
}
