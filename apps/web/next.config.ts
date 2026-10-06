import { webServerConfig } from "@nslinkhub/config/web-server";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function config(phase: string): NextConfig {
  return {
    poweredByHeader: false,
    agentRules: false,
    transpilePackages: ["@nslinkhub/types", "@nslinkhub/config"],
    webpack(config) {
      config.resolve.extensionAlias = {
        ...config.resolve.extensionAlias,
        ".js": [".ts", ".tsx", ".js"],
      };
      return config;
    },
    logging: { incomingRequests: false },
    experimental: { serverComponentsHmrCache: false },
    async rewrites() {
      return phase === PHASE_DEVELOPMENT_SERVER
        ? [{ source: "/api/:path*", destination: `${webServerConfig().apiOrigin}/api/:path*` }]
        : [];
    },
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            { key: "Referrer-Policy", value: "no-referrer" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "X-Frame-Options", value: "DENY" },
            { key: "Cache-Control", value: "private, no-store, max-age=0" },
          ],
        },
      ];
    },
  };
}
