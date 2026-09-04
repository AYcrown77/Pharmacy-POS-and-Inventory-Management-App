/**
 * HTTP client for the Express API.
 *
 * Unused while `USE_MOCKS` is on, but written now rather than later: the mock
 * adapters are built to satisfy the same contracts and raise the same error
 * shape, so switching over is a configuration change, not a refactor.
 */

import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "./config";

/** Field-level validation errors, keyed by form field name. */
export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public fieldErrors?: FieldErrors,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The session is gone — the user must sign in again. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** Signed in, but the role does not permit this. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** A business-rule conflict, e.g. stock ran out between adding and paying. */
  get isConflict(): boolean {
    return this.status === 409;
  }

  /** The pharmacy server could not be reached at all. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /**
   * Appended as a query string. Empty, null and undefined values are dropped,
   * as are non-primitives.
   *
   * Typed as `object` rather than `Record<string, unknown>` on purpose:
   * services pass their filter interfaces straight through, and a TypeScript
   * interface has no implicit index signature.
   */
  params?: object;
  signal?: AbortSignal;
  /** Identifies the till this request came from, for the audit trail. */
  terminalId?: string | null;
}

function buildUrl(
  path: string,
  params?: RequestOptions["params"],
): string {
  const url = `${API_BASE_URL}${path}`;
  if (!params) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      continue;
    }
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `${url}?${query}` : url;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, params, signal, terminalId } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  signal?.addEventListener("abort", () => controller.abort());

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      // Session cookie travels with every request.
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(terminalId ? { "X-Terminal-Id": terminalId } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      0,
      "The pharmacy server could not be reached. Check the network connection to the server.",
      "SERVER_UNREACHABLE",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    payload = await response.json().catch(() => null);
  }

  if (!response.ok) {
    throw toApiError(response.status, payload);
  }

  return unwrap<T>(payload);
}

/* -------------------------------------------------------------------------
   The API envelope

   Express wraps every response as `{ message, success, statusCode, data }`.
   Services are written against the payload itself, so the envelope is opened
   here — in one place — rather than in twenty adapters.
   ------------------------------------------------------------------------- */

interface ApiEnvelope {
  message?: string;
  success?: boolean;
  statusCode?: number;
  data?: unknown;
}

function isEnvelope(payload: unknown): payload is ApiEnvelope {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "success" in payload &&
    "data" in payload
  );
}

function unwrap<T>(payload: unknown): T {
  return (isEnvelope(payload) ? payload.data : payload) as T;
}

/** express-validator's 422 body, which does not use the envelope. */
interface ValidationBody {
  errors?: Array<{ path?: string; param?: string; msg?: string }>;
}

function toApiError(status: number, payload: unknown): ApiError {
  const body = (payload ?? {}) as ApiEnvelope & ValidationBody;

  // A validation failure comes back as a flat list of field errors. Mapping it
  // to `fieldErrors` is what lets the forms mark the offending input rather
  // than showing one generic message above everything.
  if (Array.isArray(body.errors)) {
    const fieldErrors: FieldErrors = {};
    for (const entry of body.errors) {
      const field = entry.path ?? entry.param;
      if (field && entry.msg && !fieldErrors[field]) {
        fieldErrors[field] = entry.msg;
      }
    }

    const first = Object.values(fieldErrors)[0];
    return new ApiError(
      status,
      first ?? "Please correct the highlighted fields.",
      "VALIDATION_ERROR",
      fieldErrors,
    );
  }

  // Business-rule failures carry their machine-readable code and any extra
  // context (available stock, for instance) inside `data`.
  const details =
    typeof body.data === "object" && body.data !== null
      ? (body.data as Record<string, unknown>)
      : undefined;

  const code = typeof details?.code === "string" ? details.code : undefined;

  return new ApiError(
    status,
    body.message ?? `Request failed with status ${status}`,
    code,
    undefined,
    details,
  );
}

export const http = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

/** Turn any thrown value into a message worth showing a member of staff. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
