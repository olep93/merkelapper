import type { NextConfig } from "next";
const config: NextConfig = {
  basePath: "/merkelapp",
  assetPrefix: "/merkelapp",
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/sheets/**/pdf": ["./public/zxing_reader.wasm"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=()" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};
export default config;
