import { handle } from "@/lib/api";
import { login, setSessionCookie, toPublic } from "@/lib/auth";
import { actorOf, audit, requestIp, SYSTEM } from "@/lib/audit";
import { withDB } from "@/lib/db";
import { BusinessError } from "@/lib/services";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  return handle(async () => {
    const ip = requestIp(request);
    let session;
    try {
      session = await withDB((db) => {
        const r = login(db, String(email ?? ""), String(password ?? ""));
        audit(db, { category: "acceso", action: "sesion_iniciada", actor: actorOf(r.user), entity: { type: "usuario", id: r.user.id }, summary: "Inició sesión", ip });
        return r;
      });
    } catch (err) {
      // Intento fallido: se registra aparte (el login no guarda nada). Solo el correo escrito, nunca la contraseña
      if (err instanceof BusinessError)
        await withDB((db) =>
          audit(db, {
            category: "acceso",
            action: "inicio_fallido",
            actor: SYSTEM,
            summary: `Intento de inicio de sesión fallido: ${err.message}`,
            data: { correo: String(email ?? "").trim().toLowerCase().slice(0, 80) },
            ip,
          }),
        );
      throw err;
    }
    const { user, token } = session;
    await setSessionCookie(token);
    return toPublic(user);
  });
}
