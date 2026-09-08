"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField, FormGrid } from "@/components/ui/FormField";
import { Input, NativeSelect } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ROLE_LABELS, ROLES } from "@/lib/status";
import type { User } from "@/types/domain";
import {
  buildUserSchema,
  resetPasswordSchema,
  type ResetPasswordValues,
  type UserFormValues,
} from "../schema";

/**
 * Create and edit share one modal. Five fields do not justify a page, and a
 * modal keeps the administrator's place in the list.
 */
export function UserFormModal({
  open,
  onOpenChange,
  user,
  isSubmitting,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent when creating. */
  user: User | null;
  isSubmitting: boolean;
  onCreate: (values: Required<UserFormValues>) => Promise<unknown>;
  onUpdate: (values: UserFormValues) => Promise<unknown>;
}) {
  const isEditing = Boolean(user);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(buildUserSchema(isEditing)),
    defaultValues: user
      ? {
          name: user.name,
          username: user.username,
          role: user.role,
          password: "",
        }
      : { name: "", username: "", role: "CASHIER", password: "" },
  });

  async function submit() {
    await handleSubmit(async (values) => {
      if (isEditing) {
        await onUpdate(values);
      } else {
        await onCreate({ ...values, password: values.password ?? "" });
        reset();
      }
      onOpenChange(false);
    })();
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? `Edit ${user?.name}` : "New staff account"}
      description={
        isEditing
          ? "Changing a role takes effect the next time they sign in."
          : "The account is active as soon as it is created."
      }
      size="md"
      dismissible={!isSubmitting}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button variant="primary" loading={isSubmitting} onClick={submit}>
            {isEditing ? "Save changes" : "Create account"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormGrid columns={2}>
          <FormField
            label="Full name"
            error={errors.name?.message}
            required
            className="sm:col-span-2"
          >
            {(ids) => (
              <Input
                {...ids}
                {...register("name")}
                autoFocus
                autoComplete="off"
                placeholder="e.g. Sarah Okonkwo"
              />
            )}
          </FormField>

          <FormField
            label="Username"
            error={errors.username?.message}
            required
            hint="What they type to sign in."
          >
            {(ids) => (
              <Input
                {...ids}
                {...register("username")}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="e.g. sarah"
              />
            )}
          </FormField>

          <FormField label="Role" error={errors.role?.message} required>
            {(ids) => (
              <NativeSelect {...ids} {...register("role")}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>

          {!isEditing && (
            <FormField
              label="Password"
              error={errors.password?.message}
              required
              hint="At least 8 characters. Give it to them directly."
              className="sm:col-span-2"
            >
              {(ids) => (
                <Input
                  {...ids}
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  trailingSlot={
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      className="flex size-6 items-center justify-center rounded-sm text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  }
                />
              )}
            </FormField>
          )}
        </FormGrid>

        {isEditing && (
          <Alert tone="info">
            Roles decide what this person can reach. An administrator can
            manage stock, users and reports; a cashier works the till and sees
            only their own sales.
          </Alert>
        )}
      </form>
    </Modal>
  );
}

/** Setting a new password is separate from editing the profile. */
export function ResetPasswordModal({
  open,
  onOpenChange,
  user,
  isSubmitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  isSubmitting: boolean;
  onSubmit: (password: string, currentPassword: string) => Promise<unknown>;
}) {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", currentPassword: "" },
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Reset password for ${user?.name ?? ""}`}
      description="Confirm with your own password. The staff member is not notified — hand them the new one yourself."
      size="sm"
      dismissible={!isSubmitting}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={isSubmitting}
            onClick={() =>
              void handleSubmit(async (values) => {
                await onSubmit(values.password, values.currentPassword);
                reset();
                onOpenChange(false);
              })()
            }
          >
            Reset password
          </Button>
        </>
      }
    >
      <FormField
        label="New password"
        error={errors.password?.message}
        required
        hint="At least 8 characters."
      >
        {(ids) => (
          <Input
            {...ids}
            {...register("password")}
            type={showPassword ? "text" : "password"}
            autoFocus
            autoComplete="new-password"
            trailingSlot={
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="flex size-6 items-center justify-center rounded-sm text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            }
          />
        )}
      </FormField>

      <FormField
        label="Your password"
        error={errors.currentPassword?.message}
        required
        hint="Confirms it is you making this change, not someone at your unattended terminal."
      >
        {(ids) => (
          <Input
            {...ids}
            {...register("currentPassword")}
            type="password"
            autoComplete="current-password"
          />
        )}
      </FormField>
    </Modal>
  );
}

