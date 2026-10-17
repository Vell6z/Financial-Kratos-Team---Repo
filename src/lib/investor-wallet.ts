import "server-only";
import { isInterledgerEnabled, normalizeWallet, vaultUrl, walletExists } from "./openpayments";
import { BusinessError } from "./services";
import { validateWallet } from "./validators";

/** La bóveda no se puede pagar a sí misma: la wallet del inversionista debe ser otra */
export function assertNotVault(wallet: string) {
  if (isInterledgerEnabled() && normalizeWallet(wallet) === normalizeWallet(vaultUrl()))
    throw new BusinessError("Esa es la wallet de la bóveda de la plataforma. Usa tu propia wallet de Interledger.");
}

/** Valida, normaliza y comprueba en la red la wallet de un inversionista. Devuelve la URL normalizada */
export async function checkInvestorWallet(input: string) {
  const error = validateWallet(input);
  if (error) throw new BusinessError(error);
  const wallet = normalizeWallet(input);
  assertNotVault(wallet);
  if (isInterledgerEnabled() && !(await walletExists(wallet))) throw new BusinessError("No encontramos esa wallet address en Interledger. Revísala.");
  return wallet;
}
