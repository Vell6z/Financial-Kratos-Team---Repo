import type { ReactNode } from "react";

/** Contenedor estándar de las pantallas internas */
export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-8">{children}</div>;
}
