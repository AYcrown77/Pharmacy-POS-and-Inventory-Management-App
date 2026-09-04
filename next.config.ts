import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle for the pharmacy's local server,
  // run under PM2. See docs/deployment notes in the implementation plan.
  output: "standalone",

  // The browser always talks to a same-origin `/api`, which Next forwards to
  // the Express API on localhost. Same origin means session cookies work and
  // there is no CORS to configure. Until the backend exists this is inert,
  // because the frontend runs against mock adapters.
  async rewrites() {
    const apiOrigin = process.env.API_PROXY_ORIGIN;
    if (!apiOrigin) return [];
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
