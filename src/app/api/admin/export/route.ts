import { handle } from "@/lib/api";
import { actorOf, audit, toCsv } from "@/lib/audit";
import { requireAdmin, requireUser } from "@/lib/auth";
import { withDB } from "@/lib/db";
import { BusinessError, loanView } from "@/lib/services";

const TYPES = ["movimientos", "cartera", "usuarios"] as const;
type ExportType = (typeof TYPES)[number];

/** Exporta a CSV (Excel en español) movimientos, cartera o usuarios. Cada exportación queda en la bitácora */
export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("tipo") as ExportType;
  let body = "";
  const error = await handle(async () => {
    if (!TYPES.includes(type)) throw new BusinessError("Tipo de exportación inválido");
    await withDB(async (db) => {
      const admin = await requireUser(db);
      requireAdmin(admin);
      const rows =
        type === "movimientos"
          ? db.txs.map((t) => ({
              id: t.id,
              fecha: new Date(t.at).toISOString(),
              tipo: t.kind,
              nivel: t.level,
              monto_cop: Math.round(t.amountCop),
              modo: t.mode,
              detalle: t.detail,
              credito: t.loanId ?? "",
            }))
          : type === "cartera"
            ? db.loans.map((l) => {
                const v = loanView(db, l);
                return {
                  credito: l.id,
                  titular: l.name,
                  cedula: l.cedula,
                  nivel: l.level,
                  tasa_ea: l.rateEA,
                  monto: l.amount,
                  cuotas: l.installments,
                  destino: l.purpose ?? "",
                  estado: l.chargedOffAt ? "castigado" : l.status,
                  desembolso: l.disbursedAt ? new Date(l.disbursedAt).toISOString().slice(0, 10) : "",
                  cuotas_pagadas: l.schedule.filter((i) => i.paidAt).length,
                  saldo: Math.round(v.owed),
                  dias_mora: v.daysLate,
                  reporte: l.creditReport?.status ?? "",
                };
              })
            : db.users.map((u) => ({
                id: u.id,
                nombre: u.name,
                correo: u.email,
                cedula: u.cedula,
                rol: u.role,
                registro: new Date(u.createdAt).toISOString().slice(0, 10),
                verificacion_facial: u.faceVerification,
                suspendida: u.suspended ? `sí: ${u.suspended.reason}` : "no",
                wallet: u.wallet ?? "",
              }));
      body = toCsv(rows);
      audit(db, { category: "operador", action: "datos_exportados", actor: actorOf(admin), summary: `Exportó ${type} a CSV (${rows.length} filas)` });
    });
    return null;
  });
  if (error.status !== 200) return error;
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
