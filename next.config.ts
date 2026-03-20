import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "i.annihil.us" },
      { protocol: "https", hostname: "i.ebayimg.com" },
      { protocol: "https", hostname: "comicvine.gamespot.com" },
    ],
  },
};

export default nextConfig;
