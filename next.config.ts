import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },

  // WICHTIG für Deploy in Unterordner:
  basePath: "/app-static",
  assetPrefix: "/app-static",
};

export default nextConfig;
