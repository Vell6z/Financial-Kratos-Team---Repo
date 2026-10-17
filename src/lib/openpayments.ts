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
import type { PendingVaultGrant, RecurringInvestment, VaultGrant } from "./db";
import { DEFAULT_RECURRING_INTERVAL, parseDuration } from "./recurring-interval";

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

/** Intervalo de las inversiones recurrentes (ISO 8601). OP_RECURRING_INTERVAL lo cambia, por ejemplo PT5M para mostrarlo en la demo */
export function recurringInterval() {
  const env = process.env.OP_RECURRING_INTERVAL?.trim();
  return env && parseDuration(env) ? env : DEFAULT_RECURRING_INTERVAL;
}

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
  /** Cobro (incoming payment) en la wallet que recibe: para confirmar lo que llegó y cerrarlo */
  incoming: IncomingRef;
  /** Inversión recurrente: el permiso cubre este monto en cada intervalo, desde `start` */
  recurring?: { interval: string; start: string; debitAmount: Amount };
}

type Amount = { value: string; assetCode: string; assetScale: number };

/** Lo necesario para consultar y cerrar el incoming payment después del pago */
export interface IncomingRef {
  url: string;
  accessToken: string;
  manageUrl: string;
  /** Lo que debe llegar: el monto que recibe según la cotización */
  expected: Amount;
}

/** Lo que confirmó la wallet que recibe (no lo que dice la que paga) */
export interface PaymentConfirmation {
  incomingPaymentId: string;
  outgoingPaymentId: string;
  expected: { value: number; assetCode: string };
  received: { value: number; assetCode: string };
  /** Llegó el monto completo */
  full: boolean;
  /** El cobro quedó cerrado: ya no acepta más pagos */
  closed: boolean;
  /** La wallet que paga seguía enviando cuando se consultó: el cobro queda abierto hasta que venza */
  inProgress: boolean;
  confirmedAt: number;
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
  /** Solo inversiones: el permiso queda abierto para debitar el mismo monto en cada intervalo */
  recurring?: boolean;
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

  // 3. Grant interactivo para el outgoing payment: el dueño de la wallet que paga debe aprobar.
  //    Si es recurrente, el límite se repite en cada intervalo (R/inicio/P1M): este pago usa el del primer intervalo
  const recurring =
    opts.recurring && opts.kind === "deposit" ? { interval: recurringInterval(), start: new Date().toISOString(), debitAmount: quote.debitAmount } : undefined;
  const opGrant = await client.grant.request(
    { url: sender.authServer },
    {
      access_token: {
        access: [
          {
            type: "outgoing-payment",
            actions: ["create", "read"],
            identifier: sender.id,
            limits: recurring ? { debitAmount: quote.debitAmount, interval: `R/${recurring.start}/${recurring.interval}` } : { debitAmount: quote.debitAmount },
          },
        ],
      },
      interact: { start: ["redirect"], finish: { method: "redirect", uri: opts.finishUrl, nonce: opts.nonce } },
    },
  );
  if (!isPendingGrant(opGrant)) throw new Error("Se esperaba un grant interactivo para el pago saliente");

  return {
    redirectUrl: opGrant.interact.redirect,
    recurring,
    incoming: {
      url: incoming.id,
      accessToken: ipGrant.access_token.value,
      manageUrl: ipGrant.access_token.manage,
      expected: quote.receiveAmount,
    },
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

/**
 * Consulta el incoming payment en la wallet que recibe hasta que llegue lo esperado, y lo cierra
 * (complete) para que no acepte más pagos. Así el pago se da por bueno con lo que confirma quien recibe.
 */
export async function confirmIncoming(ref: IncomingRef, outgoing: { id: string; done: boolean }): Promise<PaymentConfirmation> {
  const client = await getClient();
  const auth = { url: ref.url, accessToken: ref.accessToken };
  const withToken = async <T>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (err) {
      // Token vencido: se rota una vez
      if (!(err instanceof OpenPaymentsClientError) || err.status !== 401) throw err;
      const t = await client.token.rotate({ url: ref.manageUrl, accessToken: auth.accessToken });
      auth.accessToken = t.access_token.value;
      ref.manageUrl = t.access_token.manage;
      return fn();
    }
  };
  const expected = BigInt(ref.expected.value);
  let incoming = await withToken(() => client.incomingPayment.get(auth));
  // Lo que llega puede tardar un poco más que el aviso de la wallet que paga
  for (let i = 0; i < 10 && !incoming.completed && BigInt(incoming.receivedAmount.value) < expected; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    incoming = await withToken(() => client.incomingPayment.get(auth));
  }
  const full = BigInt(incoming.receivedAmount.value) >= expected;
  let closed = incoming.completed;
  // Solo se cierra si llegó todo o si la wallet que paga ya terminó: cerrarlo antes cortaría un pago en curso
  if (!closed && (full || outgoing.done)) {
    try {
      closed = (await withToken(() => client.incomingPayment.complete(auth))).completed;
    } catch (err) {
      // No cerrarlo no cambia lo recibido: vence solo
      console.error("No se pudo cerrar el incoming payment", err instanceof OpenPaymentsClientError ? err.status : err);
    }
  }
  return {
    incomingPaymentId: incoming.id,
    outgoingPaymentId: outgoing.id,
    expected: decimal(ref.expected),
    received: decimal(incoming.receivedAmount),
    full,
    closed,
    inProgress: !full && !outgoing.done,
    confirmedAt: Date.now(),
  };
}

/** Confirmación con lo que reporta la wallet que paga (cuando no se pudo consultar la que recibe) */
function senderConfirmation(
  payment: { id: string; failed?: boolean; sentAmount: Amount; debitAmount: Amount },
  incomingPaymentId: string,
  expected: { value: number; assetCode: string },
): PaymentConfirmation {
  const share = Number(payment.sentAmount.value) / Number(payment.debitAmount.value);
  return {
    incomingPaymentId,
    outgoingPaymentId: payment.id,
    expected,
    received: { ...expected, value: expected.value * share },
    full: share >= 1,
    closed: false,
    inProgress: !payment.failed && share < 1,
    confirmedAt: Date.now(),
  };
}

/**
 * Parte de lo esperado que se da por recibida (0 a 1). Si el pago seguía en curso, cuenta completo:
 * lo cotizado ya quedó comprometido en la wallet que paga.
 */
export const receivedShare = (c: PaymentConfirmation) =>
  c.full || c.inProgress ? 1 : c.expected.value > 0 ? Math.min(1, c.received.value / c.expected.value) : 0;

/**
 * Completa el pago después de que el usuario aprobó en su wallet, espera a que Interledger lo liquide
 * y confirma en la wallet que recibe cuánto llegó.
 */
export async function finishPayment(p: {
  continueUri: string;
  continueToken: string;
  interactRef: string;
  senderWallet: string;
  senderResourceServer: string;
  quoteId: string;
  incoming?: IncomingRef;
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
  if (payment.failed && payment.sentAmount.value === "0") throw new PaymentError("Interledger no pudo completar el pago. No se movió tu dinero.");
  // Pagos guardados antes de este cambio no tienen el cobro: no se pueden confirmar
  const done = payment.failed || payment.sentAmount.value === payment.debitAmount.value;
  let confirmation: PaymentConfirmation | null = null;
  if (p.incoming) {
    try {
      confirmation = await confirmIncoming(p.incoming, { id: payment.id, done });
    } catch (err) {
      // El dinero ya salió: si no se puede consultar quien recibe, se toma lo que reporta quien paga
      console.error("No se pudo confirmar el pago en la wallet que recibe", err instanceof OpenPaymentsClientError ? err.status : err);
      confirmation = senderConfirmation(payment, p.incoming.url, decimal(p.incoming.expected));
    }
  }
  if (confirmation && confirmation.received.value === 0 && !confirmation.inProgress)
    throw new PaymentError(`El pago no aparece en la wallet que recibe. Si se descontó de la tuya, escríbenos con este código: ${payment.id.split("/").pop()}`);
  // El token del permiso: en una inversión recurrente se guarda para los cobros siguientes
  const t = grant.access_token;
  const token = { accessToken: t.value, manageUrl: t.manage, tokenExpiresAt: t.expires_in ? Date.now() + t.expires_in * 1000 : null };
  return { payment, confirmation, token };
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
  const incomingRef: IncomingRef = { url: incoming.id, accessToken: ipGrant.access_token.value, manageUrl: ipGrant.access_token.manage, expected: debitAmount };

  // 2. Cotización en la bóveda por el monto exacto que sale de ella
  const quoteGrant = await client.grant.request({ url: vault.authServer }, { access_token: { access: [{ type: "quote", actions: ["create", "read"] }] } });
  if (!isFinalizedGrantWithAccessToken(quoteGrant)) throw new Error("No se obtuvo permiso para cotizar");
  const quote = await client.quote.create(
    { url: vault.resourceServer, accessToken: quoteGrant.access_token.value },
    { walletAddress: vault.id, receiver: incoming.id, method: "ilp", debitAmount },
  );
  incomingRef.expected = quote.receiveAmount;

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
  if (payment.failed && payment.sentAmount.value === "0")
    throw new PaymentError("Interledger no pudo completar el envío desde la bóveda. No se movió tu dinero.");
  // Lo que llegó lo confirma la wallet del inversionista; si la consulta falla, se toma lo que dice la bóveda
  let confirmation: PaymentConfirmation;
  try {
    confirmation = await confirmIncoming(incomingRef, { id: payment.id, done: payment.failed || payment.sentAmount.value === payment.debitAmount.value });
  } catch (err) {
    console.error("No se pudo confirmar el retiro en la wallet del inversionista", err instanceof OpenPaymentsClientError ? err.status : err);
    confirmation = senderConfirmation(payment, incoming.id, decimal(quote.receiveAmount));
  }
  updated.spent = String(BigInt(updated.spent) + BigInt(quote.debitAmount.value));

  return {
    grant: updated,
    confirmation,
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

// ======================================================================
// Inversiones recurrentes
// El inversionista aprueba UNA vez un permiso con intervalo (por ejemplo, hasta 268 USD cada mes).
// Cada intervalo la plataforma crea el pago desde su wallet hacia la bóveda con ese permiso, sin pasar por la wallet.
// ======================================================================

/** El permiso recurrente ya no sirve (revocado, vencido o sin cupo en este intervalo) */
export class RecurringGrantError extends PaymentError {}

/**
 * Cobra un intervalo de una inversión recurrente: debita de la wallet del inversionista el monto fijo
 * del permiso y confirma en la bóveda lo que llegó. Devuelve el permiso actualizado (token rotado).
 */
export async function chargeRecurring(sub: RecurringInvestment) {
  if (!sub.grant || !sub.debitAmount) throw new RecurringGrantError("Esta inversión recurrente no tiene permiso de Open Payments");
  const client = await getClient();
  const wallet = (url: string, who: string) =>
    client.walletAddress.get({ url }).catch(() => {
      throw new PaymentError(`No encontramos ${who} (${url}) en la red de Interledger.`);
    });
  const vault = await wallet(vaultUrl(), "la wallet de la bóveda");
  const investor = await wallet(normalizeWallet(sub.wallet), "la wallet del inversionista");
  const rate = await copRate(vault.assetCode);

  // 1. Incoming payment en la bóveda (sin monto: recibe lo que llegue del debitAmount fijo)
  const ipGrant = await client.grant.request(
    { url: vault.authServer },
    { access_token: { access: [{ type: "incoming-payment", actions: ["create", "read", "complete"] }] } },
  );
  if (!isFinalizedGrantWithAccessToken(ipGrant)) throw new Error("No se obtuvo permiso para crear el incoming payment");
  const incoming = await client.incomingPayment.create(
    { url: vault.resourceServer, accessToken: ipGrant.access_token.value },
    { walletAddress: vault.id, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
  );

  // 2. Cotización en la wallet del inversionista por el monto fijo que se le debita
  const quoteGrant = await client.grant.request({ url: investor.authServer }, { access_token: { access: [{ type: "quote", actions: ["create", "read"] }] } });
  if (!isFinalizedGrantWithAccessToken(quoteGrant)) throw new Error("No se obtuvo permiso para cotizar");
  const quote = await client.quote.create(
    { url: investor.resourceServer, accessToken: quoteGrant.access_token.value },
    { walletAddress: investor.id, receiver: incoming.id, method: "ilp", debitAmount: sub.debitAmount },
  );

  // 3. Pago saliente con el permiso recurrente (rota el token si venció)
  const grant = { ...sub.grant };
  const rotate = async () => {
    const t = await client.token.rotate({ url: grant.manageUrl, accessToken: grant.accessToken }).catch(() => {
      throw new RecurringGrantError("El permiso de tu wallet venció o fue revocado. Vuelve a activar la inversión recurrente.");
    });
    grant.accessToken = t.access_token.value;
    grant.manageUrl = t.access_token.manage;
    grant.tokenExpiresAt = t.access_token.expires_in ? Date.now() + t.access_token.expires_in * 1000 : null;
  };
  if (grant.tokenExpiresAt && grant.tokenExpiresAt < Date.now() + 30_000) await rotate();
  const create = () =>
    client.outgoingPayment.create({ url: investor.resourceServer, accessToken: grant.accessToken }, { walletAddress: investor.id, quoteId: quote.id });
  let payment;
  try {
    payment = await create();
  } catch (err) {
    const status = err instanceof OpenPaymentsClientError ? err.status : undefined;
    if (status === 401) {
      await rotate();
      payment = await create();
    } else if (status === 403) {
      throw new RecurringGrantError("Tu wallet no autorizó este cobro: el permiso fue revocado o ya se usó en este periodo.");
    } else throw err;
  }
  try {
    for (let i = 0; i < 10 && !payment.failed && payment.sentAmount.value !== payment.debitAmount.value; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      payment = await client.outgoingPayment.get({ url: payment.id, accessToken: grant.accessToken });
    }
  } catch (err) {
    console.error("No se pudo consultar el estado del cobro recurrente", err instanceof OpenPaymentsClientError ? err.status : err);
  }
  if (payment.failed && payment.sentAmount.value === "0")
    throw new PaymentError("Interledger no pudo cobrar este mes (¿saldo insuficiente en la wallet?). No se movió dinero.");

  const done = payment.failed || payment.sentAmount.value === payment.debitAmount.value;
  const ref: IncomingRef = { url: incoming.id, accessToken: ipGrant.access_token.value, manageUrl: ipGrant.access_token.manage, expected: quote.receiveAmount };
  let confirmation: PaymentConfirmation;
  try {
    confirmation = await confirmIncoming(ref, { id: payment.id, done });
  } catch (err) {
    console.error("No se pudo confirmar el cobro recurrente en la bóveda", err instanceof OpenPaymentsClientError ? err.status : err);
    confirmation = senderConfirmation(payment, incoming.id, decimal(quote.receiveAmount));
  }
  // Pesos que se abonan: lo que confirmó la bóveda, a la tasa del día
  const share = receivedShare(confirmation);
  const amountCop = Math.round(decimal(quote.receiveAmount).value * share * rate.copPerUnit);
  return {
    grant,
    amountCop,
    confirmation,
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

/** Revoca el token del permiso recurrente (si ya no existe, no pasa nada) */
export async function revokeRecurringGrant(sub: RecurringInvestment) {
  if (!sub.grant) return;
  const client = await getClient();
  await client.token.revoke({ url: sub.grant.manageUrl, accessToken: sub.grant.accessToken }).catch(() => {});
}
