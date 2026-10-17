// Descriptor facial geométrico a partir de los landmarks de MediaPipe Face Landmarker.
// Se usa en el CLIENTE para construir el descriptor que se envía al servidor, y el servidor
// solo compara descriptores (src/lib/faceverify.ts). No depende del navegador ni del servidor,
// así que lo pueden importar ambos. No guarda ni envía imágenes: solo números.

/** Un punto 3D normalizado (0..1) como los entrega MediaPipe. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

// Índices de puntos estables del malla facial de MediaPipe (468 puntos).
// Se eligen puntos de ojos, nariz, boca y contorno para medir proporciones del rostro.
const POINTS = {
  leftEyeOuter: 33,
  leftEyeInner: 133,
  rightEyeInner: 362,
  rightEyeOuter: 263,
  noseTip: 1,
  noseBridge: 168,
  mouthLeft: 61,
  mouthRight: 291,
  mouthTop: 13,
  mouthBottom: 14,
  chin: 152,
  foreheadTop: 10,
  leftCheek: 234,
  rightCheek: 454,
} as const;

/** Distancia euclídea 3D entre dos landmarks. */
function dist(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Convierte los 468 landmarks en un vector de proporciones faciales invariantes a escala.
 * Todas las distancias se normalizan por el ancho entre ojos, de modo que el descriptor no
 * dependa de qué tan cerca esté la cara de la cámara. El resultado es estable para la misma
 * persona y distinto entre personas diferentes.
 */
export function landmarksToDescriptor(landmarks: Landmark[]): number[] {
  if (!landmarks || landmarks.length < 468) return [];
  const p = (i: number) => landmarks[i];

  // Referencia de escala: distancia entre los bordes externos de los ojos
  const eyeSpan = dist(p(POINTS.leftEyeOuter), p(POINTS.rightEyeOuter));
  if (!(eyeSpan > 0)) return [];
  const n = (a: number, b: number) => dist(p(a), p(b)) / eyeSpan;

  return [
    n(POINTS.leftEyeInner, POINTS.rightEyeInner), // separación interna de ojos
    n(POINTS.leftEyeOuter, POINTS.leftEyeInner), // ancho ojo izquierdo
    n(POINTS.rightEyeInner, POINTS.rightEyeOuter), // ancho ojo derecho
    n(POINTS.noseBridge, POINTS.noseTip), // largo del puente nasal
    n(POINTS.mouthLeft, POINTS.mouthRight), // ancho de la boca
    n(POINTS.mouthTop, POINTS.mouthBottom), // alto de la boca
    n(POINTS.noseTip, POINTS.mouthTop), // nariz a boca
    n(POINTS.foreheadTop, POINTS.chin), // alto del rostro
    n(POINTS.leftCheek, POINTS.rightCheek), // ancho del rostro
    n(POINTS.leftEyeOuter, POINTS.mouthLeft), // ojo izq a comisura izq
    n(POINTS.rightEyeOuter, POINTS.mouthRight), // ojo der a comisura der
    n(POINTS.noseTip, POINTS.chin), // nariz a mentón
    n(POINTS.leftEyeInner, POINTS.noseTip), // ojo interno izq a nariz
    n(POINTS.rightEyeInner, POINTS.noseTip), // ojo interno der a nariz
    n(POINTS.foreheadTop, POINTS.noseBridge), // frente a puente
  ];
}

/**
 * Estima el yaw (giro horizontal de la cabeza) en grados a partir de los landmarks.
 * Compara la posición horizontal de la punta de la nariz respecto al centro entre ojos:
 * si la nariz se corre hacia un lado, la cabeza está girada. Aproximación suficiente para
 * el reto de liveness (no requiere pose 3D completa).
 */
export function estimateYaw(landmarks: Landmark[]): number {
  if (!landmarks || landmarks.length < 468) return 0;
  const p = (i: number) => landmarks[i];
  const leftEye = p(POINTS.leftEyeOuter);
  const rightEye = p(POINTS.rightEyeOuter);
  const nose = p(POINTS.noseTip);
  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  const eyeSpan = Math.abs(rightEye.x - leftEye.x);
  if (!(eyeSpan > 0)) return 0;
  // Offset relativo de la nariz respecto al centro de los ojos, escalado a grados.
  const offset = (nose.x - eyeCenterX) / eyeSpan;
  return offset * 90; // ~[-45, 45] en uso normal
}
