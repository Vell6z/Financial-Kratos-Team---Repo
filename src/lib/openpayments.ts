import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { copRate, type CopRate } from "./fx";
import {
  AuthenticatedClient,
  createAuthenticatedClient,
  createUnauthenticatedClient,
  isFinalizedGrantWithAccessToken,
  isPendingGrant,
  OpenPaymentsClientError,
  type WalletAddress,
} from "@interledger/open-payments";
import type { PendingVaultGrant, VaultGrant } from "./db";

// Integración con Open Payments (Interledger).
// La plataforma firma las peticiones con la llave de su wallet (OP_PLATFORM_WALLET_ADDRESS)
// y el dinero de las inversiones entra a la bóveda (OP_VAULT_WALLET_ADDRESS), ambas en la red de prueba.
// Si no hay variables de entorno configuradas, la app funciona en modo simulado.

/** Wallet con la que la plataforma firma (acepta el nombre anterior OP_WALLET_ADDRESS) */
const platformUrl = () => process.env.OP_PLATFORM_WALLET_ADDRESS || process.env.OP_WALLET_ADDRESS;

export function isInterledgerEnabled() {
  return Boolean(platformUrl() && process.env.OP_KEY_ID && (process.env.OP_PRIVATE_KEY_PATH || process.env.OP_PRIVATE_KEY));
}

export const vaultUrl = () => process.env.OP_VAULT_WALLET_ADDRESS || platformUrl()!;

let clientPromise: Promise<AuthenticatedClient> | null = null;

function getClient() {
  clientPromise ??= createAuthenticatedClient({
    walletAddressUrl: platformUrl()!,
    keyId: process.env.OP_KEY_ID!,
    privateKey: process.env.OP_PRIVATE_KEY_PATH || process.env.OP_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  }).catch((err) => {
    clientPromise = null;
    throw err;
  });
  return clientPromise;
}

/** Normaliza "$ilp.interledger-test.dev/juan" o "https://..." a una URL de wallet address. */
export function normalizeWallet(input: string) {
  const s = input.trim();
  if (s.startsWith("$")) return `https://${s.slice(1)}`;
  if (!/^https?:\/\//.test(s)) return `https://${s}`;
  return s;
}

/** Comprueba que la wallet address exista en la red (consulta pública, sin firmar). */
export async function walletExists(url: string) {
  try {
    const client = await createUnauthenticatedClient({ logLevel: "silent" });
    await client.walletAddress.get({ url: normalizeWallet(url) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convierte pesos al activo de la bóveda con la tasa de mercado (src/lib/fx.ts).
 * La conversión entre la moneda del inversionista y la de la bóveda la hace Interledger en la cotización.
 */
function copToAmount(amountCop: number, wallet: WalletAddress, rate: CopRate) {
  const units = amountCop / rate.copPerUnit;
  return {
    value: String(Math.max(1, Math.round(units * 10 ** wallet.assetScale))),
    assetCode: wallet.assetCode,
    assetScale: wallet.assetScale,
  };
}

export function formatAmount(a: { value: string; assetCode: string; assetScale: number }) {
  return `${(Number(a.value) / 10 ** a.assetScale).toFixed(a.assetScale)} ${a.assetCode}`;
}

/** Moneda de la bóveda y tasa de los pesos, para mostrar la conversión antes de cotizar */
export async function vaultFx() {
  const client = await createUnauthenticatedClient({ logLevel: "silent" });
  const vault = await client.walletAddress.get({ url: vaultUrl() });
  return { assetCode: vault.assetCode, ...(await copRate(vault.assetCode)) };
}

/** Error de Open Payments con un mensaje que se le puede mostrar al usuario */
export class PaymentError extends Error {}

export interface StartedPayment {
  redirectUrl: string;
  senderWallet: string;
  senderResourceServer: string;
  quoteId: string;
  continueUri: string;
  continueToken: string;
  /** Para verificar el hash que devuelve el servidor de autorización al volver */
  clientNonce: string;
  interactNonce: string;
  authServer: string;
  debit: string;
  receive: string;
  /** Cotización de Interledger en números, para mostrar la tasa de cambio y los costos */
  quote: QuoteView;
}

export interface QuoteView {
  debit: { value: number; assetCode: string };
  receive: { value: number; assetCode: string };
  /** Pesos por unidad del activo de la bóveda (tasa de mercado) */
  copPerUnit: number;
  fxSource: CopRate["source"];
  fxUpdatedAt: string | null;
  /** Monto en pesos que pidió el usuario */
  amountCop: number;
  vaultAsset: string;
  expiresAt: string | null;
}

const decimal = (a: { value: string; assetCode: string; assetScale: number }) => ({ value: Number(a.value) / 10 ** a.assetScale, assetCode: a.assetCode });

/**
 * Prepara un pago sender → receiver y pide el permiso (grant interactivo) para el pago saliente.
 * - deposit: el inversionista (sender) le paga a la bóveda un monto fijo que recibe la bóveda.
 * - withdraw: la bóveda (sender) le envía al inversionista un monto fijo que debita la bóveda.
 * Devuelve la URL donde el dueño de la wallet que paga debe aprobar.
 */
export async function startPayment(opts: {
  kind: "deposit" | "withdraw";
  investorWallet: string;
  amountCop: number;
  finishUrl: string;
  nonce: string;
}): Promise<StartedPayment> {
  const client = await getClient();
  const wallet = (url: string, who: string) =>
    client.walletAddress.get({ url }).catch(() => {
      throw new PaymentError(`No encontramos ${who} (${url}) en la red de Interledger. Revisa la wallet address.`);
    });
  const vault = await wallet(vaultUrl(), "la wallet de la bóveda");
  const investor = await wallet(normalizeWallet(opts.investorWallet), "tu wallet");
  const [sender, receiver] = opts.kind === "deposit" ? [investor, vault] : [vault, investor];
  const rate = await copRate(vault.assetCode);
  const vaultAmount = copToAmount(opts.amountCop, vault, rate);

  // 1. Incoming payment en la wallet que recibe (grant no interactivo)
  const ipGrant = await client.grant.request(
    { url: receiver.authServer },
    { access_token: { access: [{ type: "incoming-payment", actions: ["create", "read", "complete"] }] } },
  );
  if (!isFinalizedGrantWithAccessToken(ipGrant)) throw new Error("No se obtuvo permiso para crear el incoming payment");
  const incoming = await client.incomingPayment.create(
    { url: receiver.resourceServer, accessToken: ipGrant.access_token.value },
    {
      walletAddress: receiver.id,
      ...(opts.kind === "deposit" ? { incomingAmount: vaultAmount } : {}),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  );

  // 2. Cotización en la wallet que paga: aquí Interledger define la tasa de cambio
  const quoteGrant = await client.grant.request(
    { url: sender.authServer },
    { access_token: { access: [{ type: "quote", actions: ["create", "read"] }] } },
  );
  if (!isFinalizedGrantWithAccessToken(quoteGrant)) throw new Error("No se obtuvo permiso para cotizar");
  const quote = await client.quote.create(
    { url: sender.resourceServer, accessToken: quoteGrant.access_token.value },
    opts.kind === "deposit"
      ? { walletAddress: sender.id, receiver: incoming.id, method: "ilp" }
      : { walletAddress: sender.id, receiver: incoming.id, method: "ilp", debitAmount: vaultAmount },
  );

  // 3. Grant interactivo para el outgoing payment: el dueño de la wallet que paga debe aprobar
  const opGrant = await client.grant.request(
    { url: sender.authServer },
    {
      access_token: {
        access: [
          {
            type: "outgoing-payment",
            actions: ["create", "read"],
            identifier: sender.id,
            limits: { debitAmount: quote.debitAmount },
          },
        ],
      },
      interact: { start: ["redirect"], finish: { method: "redirect", uri: opts.finishUrl, nonce: opts.nonce } },
    },
  );
  if (!isPendingGrant(opGrant)) throw new Error("Se esperaba un grant interactivo para el pago saliente");

  return {
    redirectUrl: opGrant.interact.redirect,
    senderWallet: sender.id,
    senderResourceServer: sender.resourceServer,
    quoteId: quote.id,
    continueUri: opGrant.continue.uri,
    continueToken: opGrant.continue.access_token.value,
    clientNonce: opts.nonce,
    interactNonce: opGrant.interact.finish,
    authServer: sender.authServer,
    debit: formatAmount(quote.debitAmount),
    receive: formatAmount(quote.receiveAmount),
    quote: {
      debit: decimal(quote.debitAmount),
      receive: decimal(quote.receiveAmount),
      copPerUnit: rate.copPerUnit,
      fxSource: rate.source,
      fxUpdatedAt: rate.updatedAt,
      amountCop: opts.amountCop,
      vaultAsset: vault.assetCode,
      expiresAt: quote.expiresAt ?? null,
    },
  };
}

/**
 * Verifica que la vuelta desde la wallet venga del servidor de autorización (GNAP):
 * hash = base64(SHA-256(nonce del cliente \n nonce de interacción \n interact_ref \n URL del grant)).
 * Los pendientes guardados antes de este cambio no tienen nonces y se aceptan sin verificar.
 */
export function verifyInteractHash(p: { clientNonce?: string; interactNonce?: string; authServer?: string }, interactRef: string, hash: string | null) {
  if (!p.clientNonce || !p.interactNonce || !p.authServer) return true;
  if (!hash) return false;
  // El último componente del hash (GNAP) es el "grant endpoint": el ORIGIN del servidor de
  // autorización con "/", no el authServer con su ruta de recurso. Probamos ambos por robustez.
  const withSlash = (s: string) => (s.endsWith("/") ? s : `${s}/`);
  let origin = p.authServer;
  try {
    origin = new URL(p.authServer).origin;
  } catch {
    // authServer no es una URL válida: se usa tal cual
  }
  // La red de prueba usa el origin del authServer con "/"; se prueban variantes por robustez.
  const candidates = [withSlash(origin), withSlash(p.authServer)];
  for (const endpoint of candidates) {
    const expected = createHash("sha256").update(`${p.clientNonce}\n${p.interactNonce}\n${interactRef}\n${endpoint}`).digest("base64");
    if (expected.length === hash.length && timingSafeEqual(Buffer.from(expected), Buffer.from(hash))) return true;
  }
  return false;
}

/** Completa el pago después de que el usuario aprobó en su wallet y espera a que Interledger lo liquide. */
export async function finishPayment(p: {
  continueUri: string;
  continueToken: string;
  interactRef: string;
  senderWallet: string;
  senderResourceServer: string;
  quoteId: string;
}) {
  const client = await getClient();
  const grant = await client.grant.continue({ url: p.continueUri, accessToken: p.continueToken }, { interact_ref: p.interactRef });
  if (!isFinalizedGrantWithAccessToken(grant)) throw new Error("El permiso del pago no quedó aprobado");
  const auth = { url: p.senderResourceServer, accessToken: grant.access_token.value };
  let payment = await client.outgoingPayment.create(auth, { walletAddress: p.senderWallet, quoteId: p.quoteId });
  // El pago es asíncrono: se consulta unos segundos hasta que se envíe todo o falle
  for (let i = 0; i < 10 && !payment.failed && payment.sentAmount.value !== payment.debitAmount.value; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    payment = await client.outgoingPayment.get({ url: payment.id, accessToken: auth.accessToken });
  }
  if (payment.failed) throw new Error("Interledger no pudo completar el pago. No se movió tu dinero.");
  return payment;
}

// ======================================================================
// Retiros automáticos desde la bóveda
// El operador aprueba UNA vez un permiso (grant) para pagar desde la bóveda hasta un tope total.
// Con ese permiso la plataforma envía cada retiro al inversionista sin pasar por la wallet.
// ======================================================================

/**
 * Tope total del permiso, en unidades del activo de la bóveda:
 * - OP_VAULT_GRANT_LIMIT_USD: en dólares, convertido a la moneda de la bóveda con la tasa de mercado del día;
 * - OP_VAULT_GRANT_LIMIT: directamente en la moneda de la bóveda;
 * - por defecto 1000.
 */
async function grantLimitUnits(assetCode: string) {
  const usd = Number(process.env.OP_VAULT_GRANT_LIMIT_USD);
  if (usd > 0) {
    if (assetCode === "USD") return usd;
    // USD → COP → moneda de la bóveda, con la tasa de mercado (src/lib/fx.ts)
    const [perUsd, perUnit] = await Promise.all([copRate("USD", { ignoreManual: true }), copRate(assetCode, { ignoreManual: true })]);
    return Math.floor((usd * perUsd.copPerUnit) / perUnit.copPerUnit);
  }
  return Number(process.env.OP_VAULT_GRANT_LIMIT) || 1000;
}

/** Pide al servidor de autorización de la bóveda un permiso para pagos salientes; el operador lo aprueba en la wallet. */
export async function startVaultGrant(finishUrl: string, nonce: string) {
  const client = await getClient();
  const vault = await client.walletAddress.get({ url: vaultUrl() });
  const limit = { value: String(Math.round((await grantLimitUnits(vault.assetCode)) * 10 ** vault.assetScale)), assetCode: vault.assetCode, assetScale: vault.assetScale };
  const grant = await client.grant.request(
    { url: vault.authServer },
    {
      access_token: {
        access: [{ type: "outgoing-payment", actions: ["create", "read", "list"], identifier: vault.id, limits: { debitAmount: limit } }],
      },
      interact: { start: ["redirect"], finish: { method: "redirect", uri: finishUrl, nonce } },
    },
  );
  if (!isPendingGrant(grant)) throw new Error("Se esperaba un permiso interactivo para la bóveda");
  const pending: PendingVaultGrant = {
    continueUri: grant.continue.uri,
    continueToken: grant.continue.access_token.value,
    clientNonce: nonce,
    interactNonce: grant.interact.finish,
    authServer: vault.authServer,
    limit,
    createdAt: Date.now(),
  };
  return { redirectUrl: grant.interact.redirect, pending };
}

/** El operador aprobó: se guarda el token del permiso */
export async function finishVaultGrant(p: PendingVaultGrant, interactRef: string): Promise<VaultGrant> {
  const client = await getClient();
  const grant = await client.grant.continue({ url: p.continueUri, accessToken: p.continueToken }, { interact_ref: interactRef });
  if (!isFinalizedGrantWithAccessToken(grant)) throw new Error("El permiso de la bóveda no quedó aprobado");
  const t = grant.access_token;
  return {
    accessToken: t.value,
    manageUrl: t.manage,
    tokenExpiresAt: t.expires_in ? Date.now() + t.expires_in * 1000 : null,
    limit: p.limit,
    spent: "0",
    grantedAt: Date.now(),
  };
}

/** Revoca el permiso en el servidor de autorización (si ya no existe, no pasa nada) */
export async function revokeVaultGrant(g: VaultGrant) {
  const client = await getClient();
  await client.token.revoke({ url: g.manageUrl, accessToken: g.accessToken }).catch(() => {});
}

/** El permiso ya no sirve (revocado, vencido o sin cupo): el operador debe autorizar de nuevo */
export class VaultGrantError extends PaymentError {}

/**
 * Envía un retiro desde la bóveda a la wallet del inversionista con el permiso guardado.
 * Devuelve el permiso actualizado (token rotado y lo gastado) para guardarlo, y la cotización para mostrarla.
 */
export async function sendFromVault(grant: VaultGrant, investorWallet: string, amountCop: number) {
  const client = await getClient();
  const wallet = (url: string, who: string) =>
    client.walletAddress.get({ url }).catch(() => {
      throw new PaymentError(`No encontramos ${who} (${url}) en la red de Interledger.`);
    });
  const vault = await wallet(vaultUrl(), "la wallet de la bóveda");
  const investor = await wallet(normalizeWallet(investorWallet), "tu wallet");
  const rate = await copRate(vault.assetCode);
  const debitAmount = copToAmount(amountCop, vault, rate);

  const left = BigInt(grant.limit.value) - BigInt(grant.spent);
  if (BigInt(debitAmount.value) > left)
    throw new VaultGrantError("El permiso de la bóveda no tiene cupo para este retiro. El operador debe renovarlo.");

  // 1. Incoming payment en la wallet del inversionista
  const ipGrant = await client.grant.request(
    { url: investor.authServer },
    { access_token: { access: [{ type: "incoming-payment", actions: ["create", "read", "complete"] }] } },
  );
  if (!isFinalizedGrantWithAccessToken(ipGrant)) throw new Error("No se obtuvo permiso para crear el incoming payment");
  const incoming = await client.incomingPayment.create(
    { url: investor.resourceServer, accessToken: ipGrant.access_token.value },
    { walletAddress: investor.id, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
  );

  // 2. Cotización en la bóveda por el monto exacto que sale de ella
  const quoteGrant = await client.grant.request({ url: vault.authServer }, { access_token: { access: [{ type: "quote", actions: ["create", "read"] }] } });
  if (!isFinalizedGrantWithAccessToken(quoteGrant)) throw new Error("No se obtuvo permiso para cotizar");
  const quote = await client.quote.create(
    { url: vault.resourceServer, accessToken: quoteGrant.access_token.value },
    { walletAddress: vault.id, receiver: incoming.id, method: "ilp", debitAmount },
  );

  // 3. Pago saliente con el permiso guardado (rota el token si venció)
  const updated: VaultGrant = { ...grant };
  const rotate = async () => {
    const t = await client.token.rotate({ url: updated.manageUrl, accessToken: updated.accessToken }).catch(() => {
      throw new VaultGrantError("El permiso de la bóveda venció o fue revocado. El operador debe autorizarlo de nuevo.");
    });
    updated.accessToken = t.access_token.value;
    updated.manageUrl = t.access_token.manage;
    updated.tokenExpiresAt = t.access_token.expires_in ? Date.now() + t.access_token.expires_in * 1000 : null;
  };
  if (updated.tokenExpiresAt && updated.tokenExpiresAt < Date.now() + 30_000) await rotate();
  const create = () =>
    client.outgoingPayment.create({ url: vault.resourceServer, accessToken: updated.accessToken }, { walletAddress: vault.id, quoteId: quote.id });
  let payment;
  try {
    payment = await create();
  } catch (err) {
    const status = err instanceof OpenPaymentsClientError ? err.status : undefined;
    if (status === 401) {
      await rotate();
      payment = await create();
    } else if (status === 403) {
      throw new VaultGrantError("El permiso de la bóveda no alcanza para este retiro o fue revocado. El operador debe renovarlo.");
    } else throw err;
  }
  // Ya se creó el pago: si la consulta de estado falla, no se deshace el retiro (el dinero pudo haber salido)
  try {
    for (let i = 0; i < 10 && !payment.failed && payment.sentAmount.value !== payment.debitAmount.value; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      payment = await client.outgoingPayment.get({ url: payment.id, accessToken: updated.accessToken });
    }
  } catch (err) {
    console.error("No se pudo consultar el estado del retiro", err);
  }
  if (payment.failed) throw new PaymentError("Interledger no pudo completar el envío desde la bóveda. No se movió tu dinero.");
  updated.spent = String(BigInt(updated.spent) + BigInt(quote.debitAmount.value));

  return {
    grant: updated,
    sent: formatAmount(quote.debitAmount),
    received: formatAmount(quote.receiveAmount),
    quote: {
      debit: decimal(quote.debitAmount),
      receive: decimal(quote.receiveAmount),
      copPerUnit: rate.copPerUnit,
      fxSource: rate.source,
      fxUpdatedAt: rate.updatedAt,
      amountCop,
      vaultAsset: vault.assetCode,
      expiresAt: null,
    } satisfies QuoteView,
  };
}
