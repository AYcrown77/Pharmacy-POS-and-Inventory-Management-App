"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/components/ui/Toast";
import { toErrorMessage } from "@/lib/api/http";
import { useAuth } from "@/lib/auth/AuthProvider";
import { auditKeys, userKeys } from "@/lib/query/keys";
import {
  usersService,
  type CreateUserInput,
  type UpdateUserInput,
  type UserFilters,
} from "@/services/users.service";

export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => usersService.list(filters),
  });
}

function useAfterUserChange() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: userKeys.all });
    // A user change is an audited action, so the log is now stale too.
    void queryClient.invalidateQueries({ queryKey: auditKeys.all });
  };
}

export function useCreateUser() {
  const { toast } = useToast();
  const { user } = useAuth();
  const invalidate = useAfterUserChange();

  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      usersService.create(input, user?.id ?? ""),
    onSuccess: (created) => {
      invalidate();
      toast({
        tone: "success",
        title: "User created",
        description: `${created.name} can now sign in as ${created.username}.`,
      });
    },
    onError: (error) => {
      toast({
        tone: "error",
        title: "Could not create the user",
        description: toErrorMessage(error),
      });
    },
  });
}

export function useUpdateUser() {
  const { toast } = useToast();
  const { user } = useAuth();
  const invalidate = useAfterUserChange();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      usersService.update(id, input, user?.id ?? ""),
    onSuccess: (updated) => {
      invalidate();
      toast({
        tone: "success",
        title: "User updated",
        description: `${updated.name}'s details have been saved.`,
      });
    },
    onError: (error) => {
      toast({
        tone: "error",
        title: "Could not save the user",
        description: toErrorMessage(error),
      });
    },
  });
}

export function useSetUserActive() {
  const { toast } = useToast();
  const { user } = useAuth();
  const invalidate = useAfterUserChange();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersService.setActive(id, isActive, user?.id ?? ""),
    onSuccess: (updated) => {
      invalidate();
      toast({
        tone: updated.isActive ? "success" : "info",
        title: updated.isActive ? "Account enabled" : "Account disabled",
        description: updated.isActive
          ? `${updated.name} can sign in again.`
          : `${updated.name} can no longer sign in. Their past sales are unchanged.`,
      });
    },
    onError: (error) => {
      toast({
        tone: "error",
        title: "Could not change the account",
        description: toErrorMessage(error),
      });
    },
  });
}

export function useResetPassword() {
  const { toast } = useToast();
  const { user } = useAuth();
  const invalidate = useAfterUserChange();

  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      usersService.resetPassword(id, password, user?.id ?? ""),
    onSuccess: () => {
      invalidate();
      toast({
        tone: "success",
        title: "Password reset",
        description: "Give the new password to the staff member directly.",
      });
    },
    onError: (error) => {
      toast({
        tone: "error",
        title: "Could not reset the password",
        description: toErrorMessage(error),
      });
    },
  });
}
