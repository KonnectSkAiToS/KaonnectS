import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a production build check write elsewhere (NEXT_DIST_DIR=.next-build) without
  // clobbering the .next folder a running dev server uses.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
