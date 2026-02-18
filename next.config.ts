/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,

  // wichtig bei Subpath
  basePath: "/app-static",
  assetPrefix: "/app-static",

  images: { unoptimized: true },

  // RSC / App Router fetches vermeiden
  experimental: {
    // verhindert solche __PAGE__.txt RSC fetches in manchen Setups
    // (falls Next Version das unterstützt)
    ppr: false,
  },
};

module.exports = nextConfig;
