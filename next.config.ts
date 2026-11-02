import type { NextConfig } from "next";
const config: NextConfig = {
  allowedDevOrigins: ["192.168.100.10"],
  async redirects() {
    return [{ source: "/plans", destination: "/pricing", permanent: true }];
  },
};
export default config;
