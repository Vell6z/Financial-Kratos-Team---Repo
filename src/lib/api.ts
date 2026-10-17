import "server-only";
import { ForbiddenError, UnauthorizedError } from "./auth";
import { PaymentError } from "./openpayments";
import { BusinessError } from "./services";

/** Envuelve un handler y convierte errores en respuestas JSON legibles. */
export async function handle(fn: () => Promise<unknown>) {
  try {
    return Response.json(await fn());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof UnauthorizedError) return Response.json({ error: message }, { status: 401 });
    if (err instanceof ForbiddenError) return Response.json({ error: message }, { status: 403 });
    const expected = err instanceof BusinessError || err instanceof PaymentError;
    if (!expected) console.error(err);
    return Response.json({ error: message }, { status: expected ? 400 : 500 });
  }
}

export function parseLevel(value: unknown) {
  const n = Number(value);
  if (n !== 1 && n !== 2 && n !== 3) throw new BusinessError("Nivel inválido");
  return n as 1 | 2 | 3;
}
