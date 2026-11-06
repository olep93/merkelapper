import type { NextConfig } from "next";
const config: NextConfig = {
  basePath: "/merkelapp",
  assetPrefix: "/merkelapp",
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/sheets/**/pdf": ["./public/zxing_reader.wasm"],
  },
  // Addresses outside /merkelapp on the old host (merkelapp.vercel.app/) go to the portal. The portal always asks
  // under /merkelapp, so its own requests never match; pages under /merkelapp move on in the browser (layout.tsx).
  async redirects() {
    return [{
      source: "/:path((?!merkelapp(?:[/.]|$)|_next/).*)",
      basePath: false,
      has: [{ type: "host", value: "merkelapp(-ole93|-git-main-ole93)?\\.vercel\\.app" }],
      destination: "https://jobbverktoy.no/merkelapp/:path",
      permanent: false,
    }];
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
