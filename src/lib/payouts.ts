import "server-only";
import { resolveBrebKey } from "./breb";
import type { BrebKeyType } from "./breb-keys";
import { withDB } from "./db";
import { completeDisbursement, loansAwaitingPayout, rejectDisbursement } from "./services";

// Desembolso "real" simulado:
// 1. Justo antes de pagar se vuelve a consultar la llave en el directorio Bre-B (producción, solo lectura).
// 2. Si sigue activa y con el mismo titular, se arma el payout exacto para Wompi (referencia = id del crédito),
//    pero NO se envía: no se mueve dinero real.
// 3. Si la llave no existe, está inactiva o cambió de titular, no se paga y el capital vuelve al pool.
// Si el directorio no responde, el crédito queda reservado y se reintenta en la próxima llamada.

let running: Promise<void> | null = null;

export function processPayouts() {
  // Una sola corrida a la vez: evita consultar dos veces la misma llave
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run() {
  const pending = await withDB((db) => loansAwaitingPayout(db).map((l) => ({ id: l.id, key: l.llaveBreb, keyType: l.breb?.keyType, verified: l.breb })));
  for (const p of pending) {
    if (!p.keyType || !p.verified) {
      await withDB((db) => rejectDisbursement(db, p.id, "El crédito no tiene una llave Bre-B verificada."));
      continue;
    }
    const r = await resolveBrebKey(p.key, p.keyType as BrebKeyType);
    if (!r.ok) {
      // Resultado incierto (timeout / servicio caído): se reintenta después, sin pagar
      if (r.reason === "uncertain" || r.reason === "unavailable" || r.reason === "config") continue;
      await withDB((db) => rejectDisbursement(db, p.id, r.message));
      continue;
    }
    // Mismo titular y misma entidad que el usuario confirmó al pedir el crédito
    const sameHolder = r.holderName === p.verified.holderName && r.financialEntity.code === p.verified.financialEntity.code;
    if (!sameHolder) {
      await withDB((db) => rejectDisbursement(db, p.id, "La llave cambió de titular o de banco desde que la confirmaste. Verifícala de nuevo."));
      continue;
    }
    await withDB((db) => completeDisbursement(db, p.id, { directory: r.mode, holderName: r.holderName, financialEntity: r.financialEntity }));
  }
}
