import { z } from "zod";

import { ROLES } from "@/lib/status";
import type { Role } from "@/types/domain";

const nameField = z
  .string()
  .trim()
  .min(2, "Enter the staff member's full name")
  .max(80, "Name is too long");

const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Usernames are at least 3 characters")
  .max(30, "Username is too long")
  .regex(
    /^[a-z0-9._-]+$/,
    "Use letters, numbers, dots, dashes or underscores only",
  );

const roleField = z.enum(ROLES as unknown as [Role, ...Role[]]);

/**
 * Passwords are checked for length only. Complexity rules that force a
 * symbol tend to end up on a sticky note beside the till; length is the
 * property that actually helps, and the backend hashes with bcrypt.
 */
const passwordField = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long");

/**
 * One shape for both create and edit, with the password requirement decided
 * at build time.
 *
 * Two separate schemas would give the form two different value types, and a
 * component holding either would end up with a union that TypeScript cannot
 * call. One shape keeps the form — and its `register` — concrete.
 */
export function buildUserSchema(isEditing: boolean) {
  return z.object({
    name: nameField,
    username: usernameField,
    role: roleField,
    // Editing never changes a password; that is its own action.
    password: isEditing ? z.string().optional() : passwordField,
  });
}

export interface UserFormValues {
  name: string;
  username: string;
  role: Role;
  /**
   * Present but possibly empty, rather than an optional key: `z.optional()`
   * produces `string | undefined` on a required property, and the resolver
   * type must line up with the form's exactly.
   */
  password: string | undefined;
}

export const resetPasswordSchema = z.object({
  password: passwordField,
});

export type ResetPasswordValues = z.input<typeof resetPasswordSchema>;
