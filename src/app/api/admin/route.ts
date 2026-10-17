import { handle } from "@/lib/api";
import { actorOf, audit, requestIp } from "@/lib/audit";
import { requireAdmin, requireUser } from "@/lib/auth";
import { emptyDB, withDB } from "@/lib/db";
import { demoDayLoaded, seedDemoDay } from "@/lib/demo-day-seed";
import { cancelRecurring, processRecurring } from "@/lib/recurring";
import { accrueAll, BusinessError } from "@/lib/services";

/**
 * Acciones del operador. Todas quedan en la bitácora de auditoría (src/lib/audit.ts) con quién, cuándo y por qué.
 * - advance / reset: reloj y reinicio de la demo;
 * - face-approve / face-reject: cola de revisión de la verificación facial;
 * - suspend / reactivate: suspender o reactivar una cuenta (con motivo obligatorio al suspender);
 * - cancel-recurring: cancelar la inversión recurrente de un inversionista (revoca el permiso en su wallet).
 */
export async function POST(request: Request) {
  const { action, days, userId, reason, recurringId } = await request.json();
  const ip = requestIp(request);
  const why = typeof reason === "string" ? reason.trim().slice(0, 200) : "";
  return handle(async () => {
    if (action === "cancel-recurring") {
      const admin = await withDB(async (db) => {
        const a = await requireUser(db);
        requireAdmin(a);
        return a;
      });
      if (!why) throw new BusinessError("Escribe el motivo de la cancelación");
      await cancelRecurring(null, String(recurringId ?? ""), actorOf(admin), why);
      return { ok: true };
    }

    const result = await withDB(async (db) => {
      const admin = await requireUser(db);
      requireAdmin(admin);
      const actor = actorOf(admin);
      const target = () => {
        const u = db.users.find((x) => x.id === userId);
        if (!u) throw new BusinessError("Usuario no encontrado");
        return u;
      };

      if (action === "advance") {
        const d = Number(days);
        if (!(d > 0 && d <= 3650)) throw new BusinessError("Días inválidos");
        accrueAll(db);
        db.clockOffsetMs += d * 86_400_000;
        accrueAll(db);
        audit(db, { category: "demo", action: "reloj_adelantado", actor, entity: { type: "demo", id: "reloj" }, summary: `Adelantó el reloj de la demo ${d} días`, data: { dias: d }, ip });
      } else if (action === "reset") {
        // Conserva las cuentas, sus sesiones, el permiso de la bóveda y la bitácora; borra el resto de la demo.
        // Sin las marcas de versión, al cargar la base se vuelven a precargar los datos de las cuentas demo con la fecha de hoy
        Object.assign(db, {
          ...emptyDB(),
          users: db.users,
          sessions: db.sessions,
          vaultGrant: db.vaultGrant,
          audit: db.audit,
          auditFormat: db.auditFormat,
          demoSeeded: undefined,
          demoBorrowerSeeded: undefined,
          demoDaySeeded: undefined,
        });
        audit(db, { category: "demo", action: "demo_reiniciada", actor, entity: { type: "demo", id: "base" }, summary: "Reinició la demo: se borraron inversiones, créditos y movimientos", ip });
        // Vuelve a cargar el día de demo con la fecha de hoy
        const r = seedDemoDay(db);
        audit(db, { category: "demo", action: "dia_demo_cargado", actor, entity: { type: "demo", id: "dia" }, summary: `Cargó el día de demo: ${r.investors} inversionistas, ${r.borrowers} acreditados y ${r.loans} créditos`, ip });
      } else if (action === "seed-day") {
        if (demoDayLoaded(db)) throw new BusinessError("El día de demo ya está cargado. Reinicia la demo para volver a cargarlo con la fecha de hoy.");
        const r = seedDemoDay(db);
        audit(db, { category: "demo", action: "dia_demo_cargado", actor, entity: { type: "demo", id: "dia" }, summary: `Cargó el día de demo: ${r.investors} inversionistas, ${r.borrowers} acreditados y ${r.loans} créditos`, ip });
      } else if (action === "face-approve" || action === "face-reject") {
        const user = target();
        if (user.faceVerification !== "pendiente") throw new BusinessError("Esta verificación facial ya se resolvió");
        if (action === "face-reject") {
          // Rechazo por duplicado/identidad: la cuenta queda bloqueada y se borra el dato biométrico
          user.faceVerification = "rechazada";
          delete user.faceDescriptor;
        } else {
          user.faceVerification = "aprobada";
        }
        audit(db, {
          category: "identidad",
          action: action === "face-approve" ? "identidad_aprobada" : "identidad_rechazada",
          actor,
          entity: { type: "usuario", id: user.id },
          summary: `${action === "face-approve" ? "Aprobó" : "Rechazó"} la verificación de identidad de ${user.name} (CC ${user.cedula})${why ? ` · ${why}` : ""}`,
          data: { motivoRevision: user.faceCheck?.reviewReason ?? null },
          ip,
        });
      } else if (action === "suspend") {
        const user = target();
        if (user.role === "admin") throw new BusinessError("No se puede suspender una cuenta de operador");
        if (user.suspended) throw new BusinessError("La cuenta ya está suspendida");
        if (!why) throw new BusinessError("Escribe el motivo de la suspensión");
        user.suspended = { at: Date.now(), reason: why, by: admin.name };
        // Cierra sus sesiones abiertas
        db.sessions = db.sessions.filter((s) => s.userId !== user.id);
        audit(db, { category: "operador", action: "cuenta_suspendida", actor, entity: { type: "usuario", id: user.id }, summary: `Suspendió la cuenta de ${user.name}: ${why}`, ip });
      } else if (action === "reactivate") {
        const user = target();
        if (!user.suspended) throw new BusinessError("La cuenta no está suspendida");
        delete user.suspended;
        audit(db, {
          category: "operador",
          action: "cuenta_reactivada",
          actor,
          entity: { type: "usuario", id: user.id },
          summary: `Reactivó la cuenta de ${user.name}${why ? `: ${why}` : ""}`,
          ip,
        });
      } else {
        throw new BusinessError("Acción inválida");
      }
      return { ok: true };
    });
    // Al adelantar el reloj, las inversiones recurrentes simuladas que vencieron se cobran de una vez
    if (action === "advance") await processRecurring();
    return result;
  });
}
