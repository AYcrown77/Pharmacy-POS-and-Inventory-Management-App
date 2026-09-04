import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle for the pharmacy's local server,
  // run under PM2. See docs/deployment notes in the implementation plan.
  output: "standalone",

  // The browser always talks to a same-origin `/api`, which Next forwards to
  // the Express API on localhost. Same origin means session cookies work and
  // there is no CORS to configure.
  //
  // The version prefix is added here rather than in the client, so `/api/v2`
  // later is a change to this one line instead of every service module.
  async rewrites() {
    const apiOrigin = process.env.API_PROXY_ORIGIN;
    if (!apiOrigin) return [];
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/v1/:path*` }];
  },
};

export default nextConfig;
