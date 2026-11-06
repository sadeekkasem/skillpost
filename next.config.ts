import type { NextConfig } from "next";
const config: NextConfig = {
  allowedDevOrigins: ["192.168.100.10"],
  async redirects() {
    return [
      { source: "/plans", destination: "/pricing", permanent: true },
      { source: "/upgrade", destination: "/pricing", permanent: true },
      { source: "/projects", destination: "/", permanent: true },
      { source: "/posts", destination: "/", permanent: false },
    ];
  },
};
export default config;
