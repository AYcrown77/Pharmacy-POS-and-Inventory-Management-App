/**
 * Authentication.
 *
 * Session-based, exactly as the specification requires: the mock keeps a
 * "current user" the way the server will keep a session cookie. No token is
 * invented, so replacing this with the Express implementation changes nothing
 * about how the rest of the application behaves.
 */

import { ApiError, http } from "@/lib/api/http";
import { USE_MOCKS } from "@/lib/api/config";
import { db, recordAudit } from "@/mocks/db";
import { mockRequest } from "@/mocks/latency";
import type { Terminal, User } from "@/types/domain";

export interface LoginInput {
  username: string;
  password: string;
  terminalId: string;
}

export interface Session {
  user: User;
  terminal: Terminal | null;
}

export interface AuthService {
  login(input: LoginInput): Promise<Session>;
  logout(): Promise<void>;
  /** Resolves the signed-in user, or null when there is no session. */
  getSession(): Promise<Session | null>;
}

/* -------------------------------------------------------------------------
   Mock adapter
   ------------------------------------------------------------------------- */

/**
 * Demo credentials. Every seeded account uses this password — the mock does
 * not model password hashing, which is the backend's job (bcrypt, per §4).
 */
export const DEMO_PASSWORD = "pharmacy";

export const DEMO_ACCOUNTS = [
  { username: "admin", label: "Administrator", name: "Quadri Adeyemi" },
  { username: "cashier", label: "Cashier", name: "Sarah Okonkwo" },
] as const;

/** Survives a reload so refreshing does not sign staff out mid-shift. */
const SESSION_STORAGE_KEY = "mhp.session";

interface StoredSession {
  userId: string;
  terminalId: string;
}

function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode, blocked site data). The
    // session simply will not survive a reload — not worth failing the login.
  }
}

function resolveSession(stored: StoredSession): Session | null {
  const user = db.users.find((item) => item.id === stored.userId);
  if (!user || !user.isActive) return null;
  return {
    user,
    terminal: db.terminals.find((item) => item.id === stored.terminalId) ?? null,
  };
}

const mockAuthService: AuthService = {
  login: (input) =>
    mockRequest(() => {
      const user = db.users.find(
        (item) => item.username.toLowerCase() === input.username.toLowerCase(),
      );

      // Deliberately the same message for unknown user and wrong password —
      // it should not be possible to enumerate staff usernames.
      if (!user || input.password !== DEMO_PASSWORD) {
        throw new ApiError(401, "Incorrect username or password.");
      }

      if (!user.isActive) {
        throw new ApiError(
          403,
          "This account has been disabled. Contact an administrator.",
        );
      }

      user.lastLoginAt = new Date().toISOString();

      recordAudit({
        userId: user.id,
        userName: user.name,
        action: "USER_LOGIN",
        entityType: "SESSION",
        entityId: user.id,
        newValue: { terminalId: input.terminalId },
      });

      writeStoredSession({ userId: user.id, terminalId: input.terminalId });

      return {
        user,
        terminal:
          db.terminals.find((item) => item.id === input.terminalId) ?? null,
      };
    }),

  logout: () =>
    mockRequest(() => {
      const stored = readStoredSession();
      const user = stored
        ? db.users.find((item) => item.id === stored.userId)
        : null;

      if (user) {
        recordAudit({
          userId: user.id,
          userName: user.name,
          action: "USER_LOGOUT",
          entityType: "SESSION",
          entityId: user.id,
        });
      }

      writeStoredSession(null);
    }),

  getSession: () =>
    mockRequest(() => {
      const stored = readStoredSession();
      if (!stored) return null;

      const session = resolveSession(stored);
      if (!session) writeStoredSession(null);
      return session;
    }),
};

/* -------------------------------------------------------------------------
   HTTP adapter
   ------------------------------------------------------------------------- */

const httpAuthService: AuthService = {
  login: (input) => http.post<Session>("/auth/login", input),
  logout: () => http.post<void>("/auth/logout"),
  getSession: async () => {
    try {
      return await http.get<Session>("/auth/session");
    } catch (error) {
      // No session is a normal state, not an error to surface.
      if (error instanceof ApiError && error.isUnauthorized) return null;
      throw error;
    }
  },
};

export const authService: AuthService = USE_MOCKS
  ? mockAuthService
  : httpAuthService;
