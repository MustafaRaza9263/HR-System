import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/firebase-messaging-sw.js",
        headers: [{ key: "Service-Worker-Allowed", value: "/" }],
      },
    ];
  },
  transpilePackages: ["react-phone-number-input", "libphonenumber-js", "country-flag-icons"],
};

export default nextConfig;
