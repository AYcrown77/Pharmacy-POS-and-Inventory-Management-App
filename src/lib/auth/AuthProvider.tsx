"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { authKeys } from "@/lib/query/keys";
import { authService, type LoginInput, type Session } from "@/services/auth.service";
import type { Role, Terminal, User } from "@/types/domain";
import {
  hasPermission,
  ROLE_HOME_ROUTE,
  type Permission,
} from "./permissions";

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  terminal: Terminal | null;
  /** True until the stored session has been resolved — guards must wait. */
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<Session>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
  /** Where this user's role should land after signing in. */
  homeRoute: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: session, isPending } = useQuery({
    queryKey: authKeys.session(),
    queryFn: () => authService.getSession(),
    // The session is the root of every guard; keep it warm and never retried
    // into a redirect loop.
    staleTime: 5 * 60_000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    onSuccess: (result) => {
      queryClient.setQueryData(authKeys.session(), result);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Clear every cache on sign-out so the next user never sees the
      // previous user's data flash on screen.
      queryClient.clear();
      router.replace("/login");
    },
  });

  const login = useCallback(
    (input: LoginInput) => loginMutation.mutateAsync(input),
    [loginMutation],
  );

  const logout = useCallback(
    () => logoutMutation.mutateAsync(),
    [logoutMutation],
  );

  const user = session?.user ?? null;
  const role = user?.role ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      terminal: session?.terminal ?? null,
      isLoading: isPending,
      isAuthenticated: Boolean(user),
      login,
      logout,
      can: (permission: Permission) => hasPermission(role, permission),
      homeRoute: role ? ROLE_HOME_ROUTE[role] : "/login",
    }),
    [user, role, session?.terminal, isPending, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/** Convenience for gating a single action. */
export function useCan(permission: Permission): boolean {
  return useAuth().can(permission);
}

/**
 * Renders children only when the signed-in role holds the permission.
 *
 * This hides UI; it does not secure anything. The Express API is the
 * enforcer — see the note in `permissions.ts`.
 */
export function Can({
  permission,
  fallback = null,
  children,
}: {
  permission: Permission;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const allowed = useCan(permission);
  return <>{allowed ? children : fallback}</>;
}
