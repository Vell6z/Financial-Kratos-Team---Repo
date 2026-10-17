import { Suspense } from "react";
import { AuthForm } from "./auth-form";

export default function LoginPage() {
  return (
    <div className="grid items-stretch gap-8 lg:grid-cols-2">
      <section className="relative hidden overflow-hidden rounded-2xl bg-[#0b0b0d] p-10 text-white lg:block">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#80409d] opacity-40 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[#7edfc8] opacity-25 blur-3xl" />
        <div className="relative space-y-6">
          <p className="text-sm uppercase tracking-widest text-[#7edfc8]">Inclusión financiera abierta</p>
          <h2 className="text-3xl font-semibold leading-tight">
            Bienvenido a la red que <span className="text-[#7edfc8]">invierte</span> y <span className="text-[#dcb4ee]">presta</span> sin fronteras.
          </h2>
          <ul className="space-y-3 text-sm text-white/80">
            <li>• Invierte desde cualquier país con tu wallet de Interledger.</li>
            <li>• Pide crédito sin historial bancario: evaluamos tus hábitos de pago.</li>
            <li>• Recibe y paga en pesos por Bre-B, desde cualquier banco.</li>
          </ul>
        </div>
      </section>
      <Suspense>
        <AuthForm />
      </Suspense>
    </div>
  );
}
