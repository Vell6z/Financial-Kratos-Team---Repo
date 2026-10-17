"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { NAV, ROLE_LABEL } from "@/lib/nav";
import type { AccountRole } from "@/lib/registration";

interface Props {
  firstName: string;
  lastName: string;
  email: string;
  role: AccountRole;
}

/** Círculo con las iniciales del usuario que despliega sus opciones. */
export function UserMenu({ firstName, lastName, email, role }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Abrir menú de la cuenta"
        className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#80409d] to-[#1e9c80] text-sm font-semibold text-white ring-offset-2 ring-offset-background transition hover:ring-2 hover:ring-brand ${open ? "ring-2 ring-brand" : ""}`}
      >
        {initials}
      </button>

      <div
        role="menu"
        className={`fixed inset-x-4 top-16 origin-top sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-72 sm:origin-top-right rounded-xl border border-line bg-card p-2 shadow-xl transition duration-150 ${
          open ? "visible translate-y-0 scale-100 opacity-100" : "invisible -translate-y-2 scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-line px-3 pb-3 pt-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#80409d] to-[#1e9c80] text-sm font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">
              {firstName} {lastName}
            </div>
            <div className="truncate text-xs text-muted">{email}</div>
            <div className="mt-1 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-strong">
              {ROLE_LABEL[role]}
            </div>
          </div>
        </div>
        <nav className="py-1">
          {NAV[role].map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-brand-soft" : "hover:bg-brand-soft"}`}
              >
                <span className={active ? "text-mint" : "text-muted"}>
                  <Icon name={item.icon} />
                </span>
                <span>
                  <span className="block font-medium">{item.label}</span>
                  <span className="block text-xs text-muted">{item.description}</span>
                </span>
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          role="menuitem"
          tabIndex={open ? 0 : -1}
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg border-t border-line px-3 py-2.5 text-sm text-muted hover:text-foreground"
        >
          <Icon name="logout" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
