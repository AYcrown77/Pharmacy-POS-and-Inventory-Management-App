"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input, NativeSelect } from "@/components/ui/Input";
import { TERMINAL_OPTIONS, useTerminal } from "@/hooks/useTerminal";
import { toErrorMessage } from "@/lib/api/http";
import { useAuth } from "@/lib/auth/AuthProvider";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/services/auth.service";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
  terminalId: z.string().min(1, "Select the terminal you are using"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, homeRoute } = useAuth();
  const { terminalId, setTerminalId } = useTerminal();

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "", terminalId },
  });

  // Someone already signed in has no business on the login screen.
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(homeRoute);
  }, [isLoading, isAuthenticated, homeRoute, router]);

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      setTerminalId(values.terminalId);
      const session = await login(values);
      router.replace(
        session.user.role === "CASHIER" ? "/pos" : "/dashboard",
      );
    } catch (error) {
      setFormError(toErrorMessage(error));
    }
  }

  /** Fills the form so the demo roles can be tried without typing. */
  function fillDemoAccount(username: string) {
    setValue("username", username, { shouldValidate: true });
    setValue("password", DEMO_PASSWORD, { shouldValidate: true });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* Large enough that the wordmark inside the lockup is readable. */}
          <Image
            src="/logo-lockup.png"
            alt="Mustan Healthcare Pharmacy"
            width={176}
            height={176}
            priority
            className="h-44 w-44 object-contain"
          />
          <p className="-mt-1 text-meta text-neutral-500">
            Point of Sale &amp; Inventory Management
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-card">
          <div className="mb-5">
            <h1 className="text-title font-semibold text-neutral-900">
              Sign in
            </h1>
            <p className="mt-0.5 text-meta text-neutral-500">
              Use the staff account issued to you by the administrator.
            </p>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            {formError && <Alert tone="danger">{formError}</Alert>}

            <FormField label="Username" error={errors.username?.message} required>
              {(ids) => (
                <Input
                  {...ids}
                  {...register("username")}
                  autoComplete="username"
                  autoFocus
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="e.g. cashier"
                />
              )}
            </FormField>

            <FormField label="Password" error={errors.password?.message} required>
              {(ids) => (
                <Input
                  {...ids}
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
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

            <FormField
              label="Terminal"
              hint="Identifies this computer on the pharmacy network."
              error={errors.terminalId?.message}
              required
            >
              {(ids) => (
                <NativeSelect {...ids} {...register("terminalId")}>
                  {TERMINAL_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} · {option.shortName}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmitting}
              leadingIcon={<LogIn className="size-4" />}
              className="mt-1"
            >
              Sign in
            </Button>
          </form>
        </div>

        {/* Development aid — removed once the Express API issues real accounts. */}
        <div className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-white/60 p-3">
          <p className="text-micro font-semibold uppercase tracking-wide text-neutral-400">
            Demo accounts
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.username}
                type="button"
                onClick={() => fillDemoAccount(account.username)}
                className="rounded-md bg-neutral-100 px-2 py-1 text-meta text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
              >
                {account.label}
              </button>
            ))}
          </div>
          <p className="num mt-2 text-micro text-neutral-400">
            Password for all demo accounts: {DEMO_PASSWORD}
          </p>
        </div>

        <p className="mt-6 text-center text-micro text-neutral-400">
          Your Health, Our Priority
        </p>
      </div>
    </main>
  );
}
