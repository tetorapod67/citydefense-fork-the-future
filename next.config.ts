import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The bundled city art is already sized for the UI and is served directly.
  // This keeps local verification independent from a Cloudflare Images binding.
  images: { unoptimized: true },
};

export default nextConfig;
