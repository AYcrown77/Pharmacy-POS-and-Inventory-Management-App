"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import {
  FormField,
  FormGrid,
  FormSection,
} from "@/components/ui/FormField";
import { Input, NativeSelect, Textarea } from "@/components/ui/Input";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { TERMINAL_OPTIONS, useTerminal } from "@/hooks/useTerminal";
import { toErrorMessage } from "@/lib/api/http";
import { useAuth } from "@/lib/auth/AuthProvider";
import { auditKeys, settingsKeys } from "@/lib/query/keys";
import { TERMINAL_TYPE_LABELS } from "@/lib/status";
import { systemService } from "@/services/system.service";

const settingsSchema = z.object({
  name: z.string().trim().min(2, "Enter the pharmacy name").max(120),
  address: z.string().trim().min(4, "Enter the pharmacy address").max(200),
  phone: z.string().trim().min(6, "Enter a contact phone number").max(40),
  receiptFooter: z
    .string()
    .trim()
    .max(120, "Keep the footer short enough for an 80mm receipt"),
  showLogoOnReceipt: z.boolean(),
  lowStockAlertsEnabled: z.boolean(),
  expiryAlertDays: z
    .number({ error: "Enter a number of days" })
    .int("Use a whole number of days")
    .min(7, "Use at least 7 days")
    .max(365, "Use 365 days or fewer"),
});

type SettingsValues = z.input<typeof settingsSchema>;

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { terminalId, terminal, setTerminalId } = useTerminal();

  const settings = useQuery({
    queryKey: settingsKeys.pharmacy(),
    queryFn: () => systemService.getSettings(),
  });

  const save = useMutation({
    mutationFn: (values: SettingsValues) =>
      systemService.updateSettings(
        {
          ...settingsSchema.parse(values),
          currency: "NGN",
        },
        user?.id ?? "",
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      void queryClient.invalidateQueries({ queryKey: auditKeys.all });
      toast({
        tone: "success",
        title: "Settings saved",
        description: "New receipts will use these details.",
      });
    },
    onError: (error) => {
      toast({
        tone: "error",
        title: "Could not save settings",
        description: toErrorMessage(error),
      });
    },
  });

  if (settings.isError) {
    return (
      <PageContainer>
        <ErrorState onRetry={() => void settings.refetch()} />
      </PageContainer>
    );
  }

  if (settings.isPending) {
    return (
      <PageContainer>
        <SkeletonCard className="h-96" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        titleHidden
        description="Pharmacy details used on receipts, alert thresholds, and which terminal this computer is."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <SettingsForm
          defaults={settings.data}
          isSaving={save.isPending}
          onSubmit={(values) => save.mutateAsync(values)}
        />

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="This terminal"
              description="Stored on this computer, not on the server."
            />
            <CardBody className="flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-md bg-neutral-50 px-3 py-2.5 ring-1 ring-inset ring-neutral-200">
                <Monitor
                  className="size-4 shrink-0 text-neutral-400"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-neutral-900">
                    {terminal.name}
                  </p>
                  <p className="num truncate text-meta text-neutral-500">
                    {terminal.shortName} · {terminal.location}
                  </p>
                </div>
                <Badge tone="primary" size="sm">
                  {TERMINAL_TYPE_LABELS[terminal.type]}
                </Badge>
              </div>

              <FormField
                label="Terminal identity"
                hint="Recorded against every sale rung up on this computer."
              >
                {(ids) => (
                  <NativeSelect
                    {...ids}
                    value={terminalId}
                    onChange={(event) => setTerminalId(event.target.value)}
                  >
                    {TERMINAL_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} · {option.shortName}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="System" />
            <CardBody className="flex flex-col gap-2.5 text-base">
              <Row label="Currency" value="Nigerian Naira (₦)" />
              <Row label="Data source" value="Local pharmacy server" />
              <Row label="Internet" value="Not required" />
            </CardBody>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

function SettingsForm({
  defaults,
  isSaving,
  onSubmit,
}: {
  defaults: SettingsValues;
  isSaving: boolean;
  onSubmit: (values: SettingsValues) => Promise<unknown>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: defaults,
  });

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
        // Re-baseline so the form is no longer "dirty" after a save.
        reset(values);
      })}
      noValidate
    >
      <Card>
        <CardBody className="flex flex-col gap-6">
          <FormSection
            title="Pharmacy details"
            description="Printed at the top of every receipt."
          >
            <FormGrid columns={2}>
              <FormField
                label="Pharmacy name"
                error={errors.name?.message}
                required
                className="sm:col-span-2"
              >
                {(ids) => <Input {...ids} {...register("name")} />}
              </FormField>

              <FormField
                label="Address"
                error={errors.address?.message}
                required
                className="sm:col-span-2"
              >
                {(ids) => <Input {...ids} {...register("address")} />}
              </FormField>

              <FormField
                label="Phone number"
                error={errors.phone?.message}
                required
              >
                {(ids) => (
                  <Input {...ids} {...register("phone")} inputMode="tel" />
                )}
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            title="Receipt"
            description="How the printed receipt closes."
          >
            <FormGrid columns={2}>
              <FormField
                label="Receipt footer"
                error={errors.receiptFooter?.message}
                hint="Shown under “Your Health, Our Priority”."
                className="sm:col-span-2"
              >
                {(ids) => (
                  <Textarea {...ids} {...register("receiptFooter")} rows={2} />
                )}
              </FormField>

              <FormField
                label="Show logo on receipt"
                hint="Thermal printers render photographic logos poorly."
              >
                {(ids) => (
                  <NativeSelect
                    {...ids}
                    {...register("showLogoOnReceipt", {
                      setValueAs: (value) => value === "true" || value === true,
                    })}
                  >
                    <option value="true">Show</option>
                    <option value="false">Hide</option>
                  </NativeSelect>
                )}
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            title="Alerts"
            description="What the dashboard and expiry screens treat as urgent."
          >
            <FormGrid columns={2}>
              <FormField label="Low stock alerts">
                {(ids) => (
                  <NativeSelect
                    {...ids}
                    {...register("lowStockAlertsEnabled", {
                      setValueAs: (value) => value === "true" || value === true,
                    })}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </NativeSelect>
                )}
              </FormField>

              <FormField
                label="Expiry alert window"
                error={errors.expiryAlertDays?.message}
                hint="Days before expiry a batch starts being flagged."
              >
                {(ids) => (
                  <Input
                    {...ids}
                    {...register("expiryAlertDays", { valueAsNumber: true })}
                    type="number"
                    min={7}
                    max={365}
                    step={1}
                    className="num"
                  />
                )}
              </FormField>
            </FormGrid>
          </FormSection>

          {isDirty && (
            <Alert tone="info">
              Changes take effect on new receipts and alerts. Receipts already
              printed are unaffected.
            </Alert>
          )}
        </CardBody>

        <CardFooter>
          <Button
            variant="secondary"
            onClick={() => reset(defaults)}
            disabled={!isDirty || isSaving}
          >
            Discard changes
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSaving}
            disabled={!isDirty}
            leadingIcon={<Save className="size-4" />}
          >
            Save settings
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-meta text-neutral-500">{label}</span>
      <span className="text-base text-neutral-900">{value}</span>
    </div>
  );
}
