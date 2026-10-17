import Link from "next/link";
import { APP_NAME } from "@/lib/config";

/** Marca provisional: rombo con los colores de la paleta (no es el logo de Interledger). */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex shrink-0 items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="6" y="6" width="20" height="20" rx="4" transform="rotate(45 16 16)" fill="var(--brand)" />
        <rect x="11" y="11" width="10" height="10" rx="2" transform="rotate(45 16 16)" fill="var(--mint)" />
      </svg>
      <span className="text-lg">{APP_NAME}</span>
    </Link>
  );
}
