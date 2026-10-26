import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone on the same Wi-Fi open the dev server by its network address.
  allowedDevOrigins: ["192.168.18.2", "192.168.*.*"],
};

export default nextConfig;
