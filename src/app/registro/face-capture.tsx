"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button } from "@/components/ui";
import { estimateYaw, landmarksToDescriptor, type Landmark } from "@/lib/face-descriptor";

// Captura facial del registro (modo local, gratis). Usa MediaPipe Face Landmarker cargado
// por CDN para:
//  1. Detectar el rostro y medir el giro de cabeza (liveness).
//  2. Extraer un descriptor geométrico (src/lib/face-descriptor.ts) que se envía al servidor.
// No se guarda ni se envía la imagen: solo el descriptor (números) y la serie de ángulos.

/** Lo que el wizard necesita para enviar al servidor. */
export interface FaceCaptureResult {
  /** Descriptor geométrico de la cara (vector de proporciones), tomado de frente. */
  descriptor: number[];
  /** Serie de frames del reto: ángulo de giro y si había rostro. */
  frames: { yaw: number; faceDetected: boolean }[];
  /** No tiene cámara: la cuenta queda en revisión del operador */
  skipped?: boolean;
}

const MIN_YAW_RANGE = 25;
/** Solo se toma el descriptor con la cara de frente: girada, las proporciones se deforman */
const FRONTAL_MAX_YAW = 8;
/** Frames de frente necesarios; el descriptor final es la mediana de todos (más estable que uno solo) */
const MIN_FRONTAL = 5;
const MAX_FRONTAL = 30;

/** Mediana por dimensión de varios descriptores */
function medianDescriptor(list: number[][]) {
  return list[0].map((_, i) => {
    const v = list.map((d) => d[i]).sort((a, b) => a - b);
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  });
}
const MODELS_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type Phase = "idle" | "loading" | "ready" | "capturing" | "done" | "error";

// El tipo del landmarker de MediaPipe no está disponible sin instalar el paquete; se carga dinámico.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Landmarker = any;

export function FaceCapture({
  onCapture,
  onClear,
  done,
  skipped,
}: {
  onCapture: (r: FaceCaptureResult) => void;
  onClear: () => void;
  done: boolean;
  skipped?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<Landmarker>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const framesRef = useRef<{ yaw: number; faceDetected: boolean }[]>([]);
  const frontalRef = useRef<number[][]>([]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [yaw, setYaw] = useState(0);
  const [yawRange, setYawRange] = useState(0);
  const [frontalCount, setFrontalCount] = useState(0);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  /** Carga MediaPipe (dinámico desde CDN), pide la cámara y arranca el reto. */
  async function start() {
    setError("");
    setPhase("loading");
    framesRef.current = [];
    frontalRef.current = [];
    setFrontalCount(0);
    setYawRange(0);
    try {
      // Import dinámico para no incluir MediaPipe en el bundle del servidor
      const vision = await import(/* webpackIgnore: true */ "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs" as string);
      const fileset = await vision.FilesetResolver.forVisionTasks(MODELS_BASE);
      landmarkerRef.current = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "VIDEO",
        numFaces: 1,
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480, height: 480 } });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setPhase("capturing");
      loop();
    } catch (e) {
      stopCamera();
      setPhase("error");
      const msg = (e as Error).message || "";
      if (/Permission|NotAllowed|denied/i.test(msg)) setError("No pudimos usar la cámara. Dale permiso en el navegador e inténtalo de nuevo.");
      else if (/NotFound|device/i.test(msg)) setError("No encontramos una cámara en este dispositivo.");
      else setError("No pudimos iniciar la verificación facial. Revisa tu conexión e inténtalo de nuevo.");
    }
  }

  /** Bucle de análisis: mide el giro frame a frame hasta completar el reto. */
  function loop() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;

    // MediaPipe en modo VIDEO exige timestamps estrictamente crecientes.
    let lastTs = 0;
    let failures = 0;

    const tick = () => {
      // El video puede no tener dimensiones aún en los primeros frames: esperar sin llamar a MediaPipe.
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      try {
        let ts = performance.now();
        if (ts <= lastTs) ts = lastTs + 1; // garantiza monotonía estricta
        lastTs = ts;
        const result = landmarker.detectForVideo(video, ts);
        const faces = result?.faceLandmarks as Landmark[][] | undefined;
        const faceDetected = Boolean(faces && faces.length && faces[0]?.length >= 468);

        if (faceDetected) {
          const lm = faces![0];
          const currentYaw = estimateYaw(lm);
          framesRef.current.push({ yaw: currentYaw, faceDetected: true });
          if (Math.abs(currentYaw) <= FRONTAL_MAX_YAW && frontalRef.current.length < MAX_FRONTAL) {
            const d = landmarksToDescriptor(lm);
            if (d.length) {
              frontalRef.current.push(d);
              setFrontalCount(frontalRef.current.length);
            }
          }
          setYaw(currentYaw);

          const yaws = framesRef.current.filter((f) => f.faceDetected).map((f) => f.yaw);
          const range = yaws.length ? Math.max(...yaws) - Math.min(...yaws) : 0;
          setYawRange(range);

          if (range >= MIN_YAW_RANGE && frontalRef.current.length >= MIN_FRONTAL) {
            finish();
            return;
          }
        } else {
          framesRef.current.push({ yaw: 0, faceDetected: false });
        }
        failures = 0;
      } catch (e) {
        // Un frame suelto puede fallar; si falla muchas veces seguidas, se aborta con mensaje.
        failures++;
        if (failures >= 30) {
          stopCamera();
          setPhase("error");
          setError("La verificación facial no pudo analizar el video en este dispositivo. Prueba en otro navegador o dispositivo.");
          console.error("face-capture detectForVideo", e);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function finish() {
    stopCamera();
    setPhase("done");
    onCapture({ descriptor: medianDescriptor(frontalRef.current), frames: framesRef.current.slice() });
  }

  function retry() {
    onClear();
    frontalRef.current = [];
    setFrontalCount(0);
    setPhase("idle");
    setError("");
  }

  const progress = Math.min(100, Math.round((yawRange / MIN_YAW_RANGE) * 100));

  if (skipped) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-orange/40 bg-orange/5 p-4">
        <div>
          <div className="text-sm font-medium">Sin verificación facial</div>
          <div className="text-xs text-muted">
            Nuestro equipo verificará tu identidad por otro medio. Mientras tanto podrás usar la app, pero no pedir crédito ni invertir.
          </div>
        </div>
        <Button type="button" variant="ghost" onClick={retry}>
          Hacerla ahora
        </Button>
      </div>
    );
  }

  if (done && phase === "done") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-mint bg-mint/5 p-4">
        <div>
          <div className="text-sm font-medium">Verificación facial lista ✓</div>
          <div className="text-xs text-muted">Confirmamos que eres una persona real. Tu selfie no se guarda.</div>
        </div>
        <Button type="button" variant="ghost" onClick={retry}>
          Repetir
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-line p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Verificación facial</div>
          <div className="text-xs text-muted">Confirmamos que eres una persona real y que no tienes otra cuenta.</div>
        </div>
        <Badge tone="neutral">Local y gratuito</Badge>
      </div>

      {(phase === "capturing" || phase === "loading") && (
        <div className="space-y-2">
          <div className="relative mx-auto aspect-square w-48 overflow-hidden rounded-full border-2 border-brand bg-black/5">
            {/* La imagen de la cámara no sale del navegador */}
            <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            {phase === "loading" && <div className="absolute inset-0 grid place-items-center text-xs text-muted">Cargando cámara…</div>}
          </div>
          <p className="text-center text-sm font-medium">
            {frontalCount < MIN_FRONTAL ? "Mira de frente a la cámara…" : "Ahora gira lentamente la cabeza hacia un lado"}
          </p>
          <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-mint transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-center text-[11px] text-muted">
            Giro detectado: {Math.round(Math.abs(yaw))}° · meta {MIN_YAW_RANGE}°
          </p>
        </div>
      )}

      {phase === "error" && error && (
        <Alert tone="error" title="No pudimos verificar">
          {error}
        </Alert>
      )}

      {(phase === "idle" || phase === "error") && (
        <>
          <p className="text-[11px] text-muted">
            Al continuar autorizas el uso de tu cámara para una verificación biométrica facial. No almacenamos tu imagen: solo un
            código matemático para evitar cuentas duplicadas (dato sensible, Ley 1581 de 2012).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={start}>
              {phase === "error" ? "Reintentar" : "Iniciar verificación"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onCapture({ descriptor: [], frames: [], skipped: true })}>
              No tengo cámara
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
