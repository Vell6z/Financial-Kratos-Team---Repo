import { handle } from "@/lib/api";
import { audit, actorOf, toCsv, verifyAuditChain, type AuditEvent } from "@/lib/audit";
import { requireAdmin, requireUser } from "@/lib/auth";
import { withDB } from "@/lib/db";

/**
 * Bitácora de auditoría para el operador, con filtros: categoría, texto (en resumen, acción, actor o entidad)
 * y entidad (tipo:id). Con ?formato=csv descarga el archivo; la descarga también queda registrada.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const category = q.get("categoria") || "";
  const text = (q.get("q") || "").trim().toLowerCase();
  const entity = q.get("entidad") || "";
  const csv = q.get("formato") === "csv";

  let rows: AuditEvent[] = [];
  let broken: ReturnType<typeof verifyAuditChain> = null;
  let total = 0;
  const error = await handle(async () => {
    await withDB(async (db) => {
      const admin = await requireUser(db);
      requireAdmin(admin);
      const log = db.audit ?? [];
      total = log.length;
      broken = verifyAuditChain(log);
      rows = log
        .filter((e) => !category || e.category === category)
        .filter((e) => !entity || (e.entity && `${e.entity.type}:${e.entity.id}` === entity))
        .filter(
          (e) =>
            !text ||
            [e.summary, e.action, e.actor.name ?? "", e.entity?.id ?? "", e.data ? JSON.stringify(e.data) : ""].some((s) => s.toLowerCase().includes(text)),
        )
        // Más recientes primero por hora (los datos de demostración con historia se agregan después con fechas pasadas)
        .sort((x, y) => y.at - x.at || y.seq - x.seq);
      if (csv)
        audit(db, {
          category: "operador",
          action: "bitacora_exportada",
          actor: actorOf(admin),
          summary: `Exportó la bitácora a CSV (${rows.length} eventos${category ? `, categoría ${category}` : ""}${text ? `, búsqueda "${text}"` : ""})`,
        });
    });
    return null;
  });
  if (error.status !== 200) return error;

  if (csv)
    return new Response(
      toCsv(
        rows.map((e) => ({
          seq: e.seq,
          fecha: new Date(e.at).toISOString(),
          fecha_demo: new Date(e.demoAt).toISOString(),
          categoria: e.category,
          accion: e.action,
          actor_tipo: e.actor.type,
          actor: e.actor.name ?? "",
          actor_id: e.actor.id ?? "",
          entidad: e.entity ? `${e.entity.type}:${e.entity.id}` : "",
          resumen: e.summary,
          datos: e.data ? JSON.stringify(e.data) : "",
          ip: e.ip ?? "",
          hash: e.hash,
          hash_anterior: e.prevHash,
        })),
      ),
      { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bitacora-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } },
    );
  return Response.json({ total, broken, events: rows.slice(0, 500) });
}
