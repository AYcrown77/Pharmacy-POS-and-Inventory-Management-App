/**
 * API configuration.
 *
 * `NEXT_PUBLIC_USE_MOCKS` is the single switch between the in-memory mock
 * adapters and the real Express API. Nothing else in the application branches
 * on it — services resolve their implementation once, at module load.
 */

/** Defaults to mocks so the app runs with no backend and no env file. */
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

/**
 * Same-origin by default. Next forwards `/api/*` to the Express server on
 * localhost (see `next.config.ts` rewrites), so the browser never makes a
 * cross-origin request and session cookies work without CORS.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

/** Requests that outlive this are treated as a server-unreachable failure. */
export const REQUEST_TIMEOUT_MS = 15_000;
