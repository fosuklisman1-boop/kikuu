import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['framer-motion'],
  turbopack: {
    resolveAlias: {
      'framer-motion': 'framer-motion/dist/cjs/index.js',
      'zustand': 'zustand/index.js',
      'zustand/middleware': 'zustand/middleware.js',
    },
  },
};

export default nextConfig;
