import "server-only";
import { handle } from "./api";

/**
 * Responde un PDF armado por `build`. Si falla (sin sesión, sin permiso, no existe), responde el error en JSON como `handle`.
 * Con `?descargar` en la URL lo baja como archivo; si no, lo abre en el navegador.
 */
export async function pdfResponse(request: Request, build: () => Promise<{ body: Buffer; name: string }>) {
  let pdf: { body: Buffer; name: string } | null = null;
  const error = await handle(async () => {
    pdf = await build();
    return null;
  });
  if (!pdf) return error;
  const { body, name } = pdf as { body: Buffer; name: string };
  const download = new URL(request.url).searchParams.has("descargar");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
