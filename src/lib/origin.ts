// Origen público de la petición: el host con el que el navegador entró (localhost, la IP de la red o el dominio).
// No se usa `request.url` directamente porque con `next dev -H 0.0.0.0` Next arma esa URL con 0.0.0.0,
// una dirección donde el servidor escucha pero a la que el navegador no puede volver (p. ej. al regresar de la wallet).
// Sin imports de servidor: lo usa también src/proxy.ts.

export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.replace(":", "");
  if (host) return `${proto}://${host.split(",")[0].trim()}`;
  // Sin cabecera Host: al menos no devolver 0.0.0.0
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return url.origin;
}
