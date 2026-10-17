import type { User } from "./db";
import { newPasswordHash } from "./password";

// Cuentas de prueba para la demo. Se crean solas cuando la base está vacía (primer arranque o al borrar data/).
// Solo para entorno local / hackathon: no usar en producción.

export const DEMO_ACCOUNTS = [
  { email: "inversor@demo.kratos.test", password: "InvDemo#2026", role: "inversor" },
  { email: "acreditado@demo.kratos.test", password: "CredDemo#2026", role: "acreditado" },
  { email: "operador@demo.kratos.test", password: "OpsDemo#2026", role: "admin" },
] as const;

const base = {
  phone: "3000000000",
  age: 30,
  faceVerification: "aprobada" as const,
  documents: { idFront: "(demo)", idBack: "(demo)" },
};

export function demoUsers(): User[] {
  const [inv, acr, ops] = DEMO_ACCOUNTS;
  const createdAt = Date.now();
  return [
    {
      ...base,
      ...newPasswordHash(inv.password),
      createdAt,
      id: "demo-inv",
      role: "inversor",
      firstName: "Sofía",
      lastName: "Inversionista",
      name: "Sofía Inversionista",
      email: inv.email,
      cedula: "DEMO-INV-001",
      nationality: "Estadounidense",
      sex: "Femenino",
      address: "Austin, Texas, EE. UU.",
      // Wallet real de la red de prueba si está configurada (ver .env.example), si no una de ejemplo
      wallet: process.env.OP_DEMO_INVESTOR_WALLET || "https://ilp.interledger-test.dev/demo-inversor",
      investorProfile: { monthlyIncome: 6000, currency: "USD", incomeSource: "Salario", employment: "asalariado" },
    },
    {
      ...base,
      ...newPasswordHash(acr.password),
      createdAt,
      id: "demo-acr",
      role: "acreditado",
      firstName: "Andrés",
      lastName: "Acreditado",
      name: "Andrés Acreditado",
      email: acr.email,
      cedula: "1000000001",
      nationality: "Colombiana",
      sex: "Masculino",
      address: "Calle 10 # 5-20, Barranquilla",
      borrowerProfile: { incomeSource: "Ventas o comercio", monthlyIncomeCop: 1_400_000, llaveBreb: "3000000000" },
    },
    {
      ...base,
      ...newPasswordHash(ops.password),
      createdAt,
      id: "demo-ops",
      role: "admin",
      firstName: "Operador",
      lastName: "La Bodeguita",
      name: "Operador La Bodeguita",
      email: ops.email,
      cedula: "DEMO-OPS-001",
      nationality: "Colombiana",
      sex: "Prefiero no decir",
      address: "Oficina La Bodeguita, Medellín",
      faceVerification: "aprobada",
    },
  ];
}
