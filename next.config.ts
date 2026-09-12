import type { NextConfig } from "next";

/**
 * Hosts allowed to load this **dev** server's internal assets.
 *
 * The tills reach the server by its LAN address, and `next dev` serves its own
 * chunks as ES modules — which browsers fetch in CORS mode, sending an Origin
 * header. Next refuses any origin but localhost with a 403, which leaves the
 * page rendered but dead: no JavaScript, so the sign-in form falls back to a
 * plain form submission and the credentials land in the address bar.
 *
 * Private LAN ranges only, plus anything in ALLOWED_DEV_ORIGINS (comma
 * separated) for a network that uses neither. A production build
 * (`next build` then `next start`) ignores this list entirely — it serves no
 * dev-only assets, so nothing is blocked.
 */
const lanDevOrigins = [
  // What routers hand out almost everywhere.
  "192.168.*.*",
  "10.*.*.*",
];

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle for the pharmacy's local server,
  // run under PM2. See docs/deployment notes in the implementation plan.
  output: "standalone",

  allowedDevOrigins: [
    ...lanDevOrigins,
    ...(process.env.ALLOWED_DEV_ORIGINS?.split(",")
      .map((host) => host.trim())
      .filter(Boolean) ?? []),
  ],

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
