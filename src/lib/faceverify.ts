import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Verificación facial en el registro. Sigue el patrón de src/lib/breb.ts:
// config() decide el modo según variables de entorno, el verificador NUNCA lanza
// (devuelve resultados tipados) y hay un modo gratuito por defecto.
//
// Modo "local" (por defecto, gratis): el cliente captura la cara con MediaPipe y manda
//   - los frames del reto de giro de cabeza (para el liveness)
//   - un descriptor geométrico derivado de los landmarks del rostro (para 1:1 y 1:N)
// El servidor compara descriptores con distancia euclídea. No se envía nada a terceros
// ni se guarda la imagen: solo el descriptor (un vector de números).
//
// Modo "provider" (opcional, con FACE_PROVIDER_*): se delega a un IDV de pago (Truora
// como primera opción para Colombia). Cumple la misma interfaz, el resto no cambia.
//
// Límite honesto: el modo local no es anti-fraude de grado banco (un video podría pasar
// el liveness y no valida la cédula contra fuentes oficiales). Suficiente para MVP/piloto.

export type FaceMode = "local" | "provider";

/** Distancia euclídea por debajo de la cual dos descriptores se consideran la misma persona (1:1). */
export const THRESHOLD_MATCH = 0.6;
/** Por debajo = duplicado probable (1:N). Más estricto que el match. */
export const THRESHOLD_DEDUP = 0.5;
/** Zona gris de deduplicación: entre DEDUP y MATCH va a revisión manual del admin. */
export const THRESHOLD_REVIEW = THRESHOLD_MATCH;

/** Un frame del reto de liveness: el ángulo horizontal (yaw) de la cabeza en ese instante. */
export interface LivenessFrame {
  /** Yaw en grados. Negativo = mira a un lado, positivo = al otro. */
  yaw: number;
  /** ¿Se detectó un rostro en este frame? */
  faceDetected: boolean;
}

export interface LivenessCapture {
  frames: LivenessFrame[];
}

export interface LivenessResult {
  ok: boolean;
  challenge: "turn_head";
  /** Giro máximo detectado, en grados (para auditar) */
  yawRange: number;
  reason?: "no_face" | "no_movement" | "too_few_frames";
  message?: string;
}

export interface MatchResult {
  /** Distancia euclídea entre descriptores (menor = más parecidos). */
  distance: number;
  isMatch: boolean;
}

export interface DuplicateResult {
  userId: string;
  cedula: string;
  distance: number;
  /** true = duplicado claro (rechazar); false = zona gris (revisión manual). */
  certain: boolean;
}

export interface KnownFace {
  userId: string;
  cedula: string;
  descriptor: number[];
}

export interface FaceVerifier {
  readonly mode: FaceMode;
  /** Verifica el reto de giro de cabeza con los frames capturados en el cliente. */
  checkLiveness(capture: LivenessCapture): LivenessResult;
  /** 1:1 — descriptor de la selfie contra el descriptor del documento (idFront). */
  matchToDocument(selfie: number[], idPhoto: number[]): MatchResult;
  /** 1:N — descriptor nuevo contra los ya registrados. null = nadie parecido. */
  findDuplicate(descriptor: number[], known: KnownFace[]): DuplicateResult | null;
}

// ----------------------------------------------------------------------
// Utilidades
// ----------------------------------------------------------------------

/** Distancia euclídea entre dos descriptores. Devuelve Infinity si no son comparables. */
export function euclidean(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Un descriptor es válido si es un vector de números finitos no vacío. */
export function isValidDescriptor(d: unknown): d is number[] {
  return Array.isArray(d) && d.length > 0 && d.every((x) => typeof x === "number" && Number.isFinite(x));
}

// ----------------------------------------------------------------------
// Modo local (gratis): liveness por giro de cabeza + distancia euclídea
// ----------------------------------------------------------------------

/** Giro mínimo (grados) que debe hacer la cabeza para dar por válido el reto. */
const MIN_YAW_RANGE = 25;
/** Mínimo de frames con rostro para confiar en la medición. */
const MIN_FACE_FRAMES = 5;

const localVerifier: FaceVerifier = {
  mode: "local",

  checkLiveness(capture) {
    const frames = capture?.frames ?? [];
    const withFace = frames.filter((f) => f?.faceDetected);
    if (withFace.length < MIN_FACE_FRAMES)
      return { ok: false, challenge: "turn_head", yawRange: 0, reason: "too_few_frames", message: "No pudimos ver tu rostro con claridad. Acércate a la cámara con buena luz." };

    const yaws = withFace.map((f) => f.yaw).filter((y) => Number.isFinite(y));
    if (!yaws.length)
      return { ok: false, challenge: "turn_head", yawRange: 0, reason: "no_face", message: "No detectamos tu rostro. Mira a la cámara e inténtalo de nuevo." };

    const yawRange = Math.max(...yaws) - Math.min(...yaws);
    if (yawRange < MIN_YAW_RANGE)
      return { ok: false, challenge: "turn_head", yawRange, reason: "no_movement", message: "Gira la cabeza hacia un lado y vuelve al centro para confirmar que eres una persona real." };

    return { ok: true, challenge: "turn_head", yawRange };
  },

  matchToDocument(selfie, idPhoto) {
    const distance = euclidean(selfie, idPhoto);
    return { distance, isMatch: distance <= THRESHOLD_MATCH };
  },

  findDuplicate(descriptor, known) {
    let best: DuplicateResult | null = null;
    for (const k of known) {
      const distance = euclidean(descriptor, k.descriptor);
      if (distance >= THRESHOLD_REVIEW) continue; // persona distinta
      if (!best || distance < best.distance)
        best = { userId: k.userId, cedula: k.cedula, distance, certain: distance < THRESHOLD_DEDUP };
    }
    return best;
  },
};

// ----------------------------------------------------------------------
// Modo provider (IDV de pago, p. ej. Truora) — pendiente de integrar
// ----------------------------------------------------------------------

function providerConfig() {
  const url = process.env.FACE_PROVIDER_URL;
  const key = process.env.FACE_PROVIDER_API_KEY;
  return { url, key, configured: Boolean(url && key) };
}

/** Modo activo según las variables de entorno. */
export function faceMode(): FaceMode {
  return providerConfig().configured ? "provider" : "local";
}

/**
 * Devuelve el verificador activo. Hoy siempre `local`: cuando se integre un IDV de pago,
 * aquí se devolverá un verificador `provider` que cumpla la MISMA interfaz FaceVerifier.
 */
export function getFaceVerifier(): FaceVerifier {
  // El adaptador provider aún no está implementado; con variables presentes se documenta la intención
  // pero se sigue usando el modo local para no romper el registro.
  return localVerifier;
}

// ----------------------------------------------------------------------
// Cifrado del descriptor en reposo (dato biométrico sensible)
// ----------------------------------------------------------------------

/** Clave de 32 bytes derivada de FACE_DESCRIPTOR_SECRET (o una por defecto solo para local/demo). */
function descriptorKey() {
  const secret = process.env.FACE_DESCRIPTOR_SECRET || "kratos-local-face-descriptor-key";
  return createHash("sha256").update(secret).digest();
}

/** Cifra el descriptor (AES-256-GCM) para guardarlo. Formato: iv:tag:ciphertext en base64. */
export function encryptDescriptor(descriptor: number[]): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", descriptorKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(descriptor), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

/** Descifra un descriptor guardado. Devuelve [] si el dato está corrupto o la clave cambió. */
export function decryptDescriptor(stored: string | undefined): number[] {
  if (!stored) return [];
  try {
    const [ivB64, tagB64, dataB64] = stored.split(":");
    if (!ivB64 || !tagB64 || !dataB64) return [];
    const decipher = createDecipheriv("aes-256-gcm", descriptorKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const out = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(out);
    return isValidDescriptor(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
