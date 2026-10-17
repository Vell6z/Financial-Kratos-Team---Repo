"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TONE_STYLES, ToneIcon, type Tone } from "./ui";

interface Item {
  id: string;
  tone: Tone;
  title: string;
  body: string;
  at: number;
  href?: string;
  unread: boolean;
}

function ago(at: number, items: Item[]) {
  // Relativo a la notificación más reciente para que funcione con el reloj simulado de la demo
  const ref = Math.max(...items.map((i) => i.at), at);
  const days = Math.floor((ref - at) / 86_400_000);
  if (days <= 0) return "Reciente";
  if (days === 1) return "Hace 1 día";
  if (days > 30) return new Date(at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  return `Hace ${days} días`;
}

/** Campana con contador de notificaciones sin leer */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items);
    setUnread(data.unread);
  }, []);

  // Se actualiza al navegar y cada 20 segundos
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load, pathname]);

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

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      void fetch("/api/notifications", { method: "POST" });
    }
    if (!next) setItems((list) => list.map((i) => ({ ...i, unread: false })));
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notificaciones, ${unread} sin leer` : "Notificaciones"}
        aria-expanded={open}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full border border-line text-muted transition hover:text-foreground ${open ? "bg-brand-soft text-foreground" : ""}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <div
        className={`fixed inset-x-4 top-16 origin-top sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[22rem] sm:origin-top-right rounded-xl border border-line bg-card shadow-xl transition duration-150 ${
          open ? "visible translate-y-0 scale-100 opacity-100" : "invisible -translate-y-2 scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-semibold">Notificaciones</span>
          <span className="text-xs text-muted">{items.length ? `${items.length} en total` : ""}</span>
        </div>
        <ul className="max-h-96 overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No tienes notificaciones.</li>}
          {items.map((n) => {
            const content = (
              <div className={`flex gap-3 rounded-lg px-3 py-2.5 transition ${n.href ? "hover:bg-brand-soft" : ""}`}>
                <ToneIcon tone={n.tone} className={`mt-0.5 h-5 w-5 ${TONE_STYLES[n.tone].icon}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm ${n.unread ? "font-semibold" : "font-medium"}`}>{n.title}</span>
                    {n.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mint" aria-label="Sin leer" />}
                  </div>
                  <p className="text-xs text-muted">{n.body}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{ago(n.at, items)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {n.href ? (
                  <Link href={n.href} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
