import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@juego/shared"],
  // La raíz del monorepo, para que Next encuentre las dependencias compartidas.
  turbopack: { root: path.join(__dirname, "../..") },
};

export default nextConfig;
