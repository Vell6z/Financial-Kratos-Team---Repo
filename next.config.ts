import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El SDK de Open Payments usa módulos de Node (pino, crypto); se carga sin empaquetar.
  serverExternalPackages: ["@interledger/open-payments"],
  // El SDK lee sus especificaciones OpenAPI (.yaml) del disco al crear el cliente. El rastreo de archivos de Next no
  // las detecta y en Vercel faltan (ENOENT en /var/task/...): se incluyen a mano en las funciones del servidor.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@interledger/open-payments/dist/openapi/specs/*.yaml"],
    "/**": ["./node_modules/@interledger/open-payments/dist/openapi/specs/*.yaml"],
  },
  // `npm run dev:https` desde el celular entra por la IP de la red local (por ejemplo, https://192.168.1.18:3000).
  // Sin esto, Next bloquea con 403 los recursos de desarrollo (recarga en caliente) pedidos desde esa IP. Solo aplica en desarrollo.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
