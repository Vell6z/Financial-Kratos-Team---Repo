import Link from "next/link";
import { APP_NAME } from "@/lib/config";

/** Marca: el logo de public/favicon-48.png junto al nombre (decorativo: el nombre ya va en texto). */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex shrink-0 items-center gap-2 font-semibold tracking-tight ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/favicon-48.png" alt="" width={28} height={28} className="h-7 w-7" />
      <span className="text-lg">{APP_NAME}</span>
    </Link>
  );
}
