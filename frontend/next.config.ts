import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow loading images from any origin (for future avatar/asset support)
  images: { unoptimized: true },
};

export default nextConfig;
