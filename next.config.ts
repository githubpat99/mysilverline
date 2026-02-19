/** @type {import('next').NextConfig} */

const basePath = process.env.NODE_ENV === "production"
  ? "/app-static"
  : (process.env.NEXT_PUBLIC_BASE_PATH || "");

const nextConfig = {
  output: "export",
  trailingSlash: true,

  ...(basePath ? { basePath, assetPrefix: basePath } : {}),

  images: { unoptimized: true },

  experimental: {
    ppr: false,
  },
};

module.exports = nextConfig;
