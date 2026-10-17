import { Page } from "@/components/page";
import { requirePageRole } from "@/lib/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["inversor", "acreditado"], "/movimientos", { needsStudy: true });
  return <Page>{children}</Page>;
}
