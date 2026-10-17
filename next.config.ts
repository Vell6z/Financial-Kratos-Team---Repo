import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El SDK de Open Payments usa módulos de Node (pino, crypto); se carga sin empaquetar.
  serverExternalPackages: ["@interledger/open-payments"],
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
