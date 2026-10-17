import type { AccountRole } from "./registration";

export type IconName = "home" | "invest" | "credit" | "card" | "vault" | "list" | "study";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: IconName;
}

// Opciones de cada rol. Los usuarios solo ven sus propios datos; la bóveda es exclusiva del operador.
export const NAV: Record<AccountRole, NavItem[]> = {
  inversor: [
    { href: "/inicio", label: "Inicio", description: "Resumen de tu cuenta", icon: "home" },
    { href: "/invertir", label: "Mis inversiones", description: "Invertir, ver cajitas y retirar", icon: "invest" },
    { href: "/movimientos", label: "Movimientos", description: "Tus inversiones y retiros", icon: "list" },
  ],
  acreditado: [
    { href: "/inicio", label: "Inicio", description: "Resumen de tu cuenta", icon: "home" },
    { href: "/estudio", label: "Mi estudio", description: "Tu puntaje y cómo mejorarlo", icon: "study" },
    { href: "/credito", label: "Pedir crédito", description: "Monto, plazo y desembolso", icon: "credit" },
    { href: "/mi-credito", label: "Mi crédito", description: "Cuotas y pagos por Bre-B", icon: "card" },
    { href: "/movimientos", label: "Movimientos", description: "Desembolsos y pagos", icon: "list" },
  ],
  admin: [{ href: "/boveda", label: "Panel del operador", description: "Cartera, usuarios, inversiones y auditoría", icon: "vault" }],
};

export const ROLE_LABEL: Record<AccountRole, string> = {
  inversor: "Inversionista",
  acreditado: "Acreditado",
  admin: "Operador",
};

/** Pantalla de inicio de cada rol */
export const HOME: Record<AccountRole, string> = { inversor: "/inicio", acreditado: "/inicio", admin: "/boveda" };
