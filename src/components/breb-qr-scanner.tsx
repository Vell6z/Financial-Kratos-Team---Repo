"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Alert, Button } from "@/components/ui";
import { BREB_KEY_TYPES } from "@/lib/breb-keys";
import { BrebQrError, parseBrebQr, type BrebQr } from "@/lib/breb-qr";

// Escáner de QR Bre-B: la cámara (o una foto) solo entrega texto; el lector EMVCo (src/lib/breb-qr.ts)
// valida estructura, CRC y namespace y extrae la llave. La consulta al directorio Bre-B la hace quien lo usa.
// El contenido del QR no se guarda ni se registra en logs.

type Mode = "camara" | "foto";

/** Busca un QR en una imagen, probando varios tamaños (las fotos grandes o muy pequeñas fallan a veces) */
function decodeImage(img: CanvasImageSource & { width: number; height: number }) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  for (const max of [1200, 800, 1800, 500]) {
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(data.data, data.width, data.height, { inversionAttempts: "attemptBoth" });
    if (code?.data) return code.data;
  }
  return null;
}

export function BrebQrScanner({ onClose, onUse }: { onClose: () => void; onUse: (qr: BrebQr) => void }) {
  const [mode, setMode] = useState<Mode>("camara");
  const [error, setError] = useState("");
  const [result, setResult] = useState<BrebQr | null>(null);
  const [cameraState, setCameraState] = useState<"iniciando" | "escaneando" | "sin-camara">("iniciando");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  // Bloquea lecturas repetidas mientras se procesa un QR
  const busyRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /** Valida el texto del QR. Devuelve true si es un QR Bre-B válido */
  const handleText = useCallback((text: string) => {
    try {
      setResult(parseBrebQr(text));
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof BrebQrError ? e.message : "No pudimos leer ese QR.");
      return false;
    }
  }, []);

  // Cámara: lee cuadros del video hasta encontrar un QR válido
  useEffect(() => {
    if (mode !== "camara" || result) return;
    let cancelled = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        // La cámara solo funciona en https o localhost (por ejemplo, no en http://192.168…)
        setCameraState("sin-camara");
        setError("Este navegador no permite usar la cámara aquí (necesita https). Usa «Subir foto».");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setCameraState("escaneando");
        const tick = () => {
          if (cancelled) return;
          if (!busyRef.current && video.readyState === video.HAVE_ENOUGH_DATA) {
            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (code?.data) {
              busyRef.current = true;
              if (handleText(code.data)) {
                stopCamera();
                return;
              }
              // QR inválido: muestra el error y sigue escaneando después de una pausa
              setTimeout(() => (busyRef.current = false), 1500);
            }
          }
          frameRef.current = requestAnimationFrame(tick);
        };
        frameRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setCameraState("sin-camara");
        const name = (e as DOMException).name;
        setError(
          name === "NotAllowedError"
            ? "No diste permiso para usar la cámara. Actívalo en el navegador o usa «Subir foto»."
            : "No encontramos una cámara disponible. Usa «Subir foto».",
        );
      }
    }
    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [mode, result, handleText, stopCamera]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError("");
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const text = decodeImage(img);
      if (!text) setError("No encontramos un QR en la foto. Toma la foto de frente, con buena luz y que el QR se vea completo.");
      else handleText(text);
    } catch {
      setError("No pudimos abrir esa imagen.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function again() {
    busyRef.current = false;
    setResult(null);
    setError("");
    setCameraState("iniciando");
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="qr-title" className="toast-in w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 id="qr-title" className="text-sm font-semibold">
            Escanear QR Bre-B
          </h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5">
          {!result && (
            <>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-brand-soft p-1 text-sm" role="tablist">
                {(["camara", "foto"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => (setMode(m), setError(""))}
                    className={`min-h-9 rounded-md transition ${mode === m ? "bg-card font-medium shadow-sm" : "text-muted"}`}
                  >
                    {m === "camara" ? "Cámara" : "Subir foto"}
                  </button>
                ))}
              </div>

              {mode === "camara" ? (
                <div className="relative aspect-square overflow-hidden rounded-xl bg-black">
                  <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                  {cameraState === "escaneando" && (
                    <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" aria-hidden="true" />
                  )}
                  <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/90">
                    {cameraState === "iniciando" ? "Abriendo la cámara…" : cameraState === "escaneando" ? "Apunta al QR Bre-B de tu banco" : ""}
                  </p>
                </div>
              ) : (
                <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-center text-sm hover:border-brand/50">
                  <span className="text-3xl" aria-hidden="true">
                    ⌗
                  </span>
                  <span className="font-medium">Toma o elige una foto del QR</span>
                  <span className="px-6 text-xs text-muted">El QR de cobro Bre-B que te da tu banco o billetera</span>
                  {/* capture abre la cámara del celular directamente; funciona también sin https */}
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
                </label>
              )}
              {error && <Alert tone="error" title="QR no válido">{error}</Alert>}
            </>
          )}

          {result && (
            <>
              <div className="space-y-1 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-mint/15 text-xl text-mint">✓</div>
                <div className="font-semibold">QR Bre-B leído</div>
                <p className="text-xs text-muted">Ahora consultamos la llave en el directorio Bre-B para ver a nombre de quién está.</p>
              </div>
              <dl className="space-y-1.5 rounded-lg bg-brand-soft p-3 text-sm">
                <Row k="Llave" v={result.key} strong />
                <Row k="Tipo" v={BREB_KEY_TYPES[result.keyType]} />
                <Row k="Esquema" v={`${result.namespace} ✓`} />
                <Row k="Verificación (CRC)" v="Correcta ✓" />
                {result.merchantName && <Row k="Nombre en el QR" v={result.merchantName} />}
              </dl>
              {result.amount !== null && (
                <p className="text-[11px] text-muted">El QR trae un monto ({result.amount.toLocaleString("es-CO")}): no se usa, se desembolsa lo aprobado.</p>
              )}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted">Cómo se leyó el QR</summary>
                <table className="mt-2 w-full font-mono text-[11px]">
                  <tbody>
                    {result.fields.map((f) => (
                      <tr key={f.tag} className="border-t border-line align-top">
                        <td className="w-8 py-1 text-muted">{f.tag}</td>
                        <td className="whitespace-pre-wrap break-all py-1">
                          {f.tag === result.brebTag ? result.breb.map((b) => `${result.brebTag}.${b.tag} = ${b.value}`).join("\n") : f.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={again}>
                  Escanear otro
                </Button>
                <Button className="flex-1" onClick={() => onUse(result)}>
                  Verificar esta llave
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className={`min-w-0 break-all text-right ${strong ? "font-semibold" : "font-medium"}`}>{v}</dd>
    </div>
  );
}
