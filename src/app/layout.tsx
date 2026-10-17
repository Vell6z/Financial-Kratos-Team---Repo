import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { ToastProvider } from "@/components/feedback";
import { NotificationBell } from "@/components/notification-bell";
import { UserMenu } from "@/components/user-menu";
import { currentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { HOME } from "@/lib/nav";
import "./globals.css";

const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${APP_NAME} · Crédito con Interledger`,
  description: "Inversión extranjera vía Interledger para dar crédito a personas no bancarizadas en Colombia.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="es" className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ToastProvider>
        <header className="sticky top-0 z-20 border-b border-line bg-background/85 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6">
            <Logo />
            <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap text-sm sm:gap-3">
              {user ? (
                <>
                  <Link href={HOME[user.role]} className="hidden text-muted hover:text-foreground sm:inline">
                    {user.role === "admin" ? "Panel" : "Inicio"}
                  </Link>
                  <NotificationBell />
                  <UserMenu firstName={user.firstName} lastName={user.lastName} email={user.email} role={user.role} />
                </>
              ) : (
                <>
                  <Link href="/login" className="px-1 text-muted hover:text-foreground">
                    Ingresar
                  </Link>
                  <Link href="/registro" className="rounded-lg bg-brand px-3 py-2 font-medium text-white hover:opacity-90">
                    Crear cuenta
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-muted">
            <span>
              {APP_NAME} · MVP hackathon Interledger · Colombia
            </span>
            <span>Pagos con Open Payments (Interledger) · Bre-B y conversión a COP simulados</span>
          </div>
        </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
