"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseBackup, HardDrive, ShieldCheck } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { toErrorMessage } from "@/lib/api/http";
import { settingsKeys } from "@/lib/query/keys";
import type { Tone } from "@/lib/status";
import { systemService } from "@/services/system.service";
import type { BackupHealth, BackupStatus } from "@/types/backup";

/**
 * The backups, for someone who will never open a terminal.
 *
 * The shop's data is backed up on a schedule by the server itself; this says
 * whether that is actually happening and gives one button to take an extra
 * copy - before a stock count, say, or before handing the day over.
 */

const HEALTH: Record<BackupHealth, { tone: Tone; label: string }> = {
  OK: { tone: "success", label: "Protected" },
  ATTENTION: { tone: "warning", label: "Needs attention" },
  CRITICAL: { tone: "danger", label: "At risk" },
  UNKNOWN: { tone: "neutral", label: "Not set up" },
};

/** "25 minutes ago" - the only form of this the shop needs. */
function age(timestamp: string | null): string {
  if (!timestamp) return "never";
  const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function size(bytes: number): string {
  if (bytes <= 0) return "";
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function BackupCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const status = useQuery({
    queryKey: settingsKeys.backups(),
    queryFn: () => systemService.getBackupStatus(),
    // While a backup is running the answer changes on its own, so the card
    // follows it rather than leaving the reader to guess.
    refetchInterval: (query) =>
      (query.state.data as BackupStatus | undefined)?.running ? 2_000 : false,
  });

  const run = useMutation({
    mutationFn: () => systemService.runBackup(),
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.backups(), data);
      void queryClient.invalidateQueries({ queryKey: settingsKeys.backups() });
      toast({
        tone: "success",
        title: "Backup started",
        description: "It takes a few seconds. This card updates when it is done.",
      });
    },
    onError: (error) => {
      toast({
        tone: "error",
        title: "Could not start the backup",
        description: toErrorMessage(error),
      });
    },
  });

  if (status.isPending) return <SkeletonCard className="h-64" />;

  if (status.isError) {
    return (
      <Card>
        <CardHeader title="Backups" />
        <CardBody>
          <Alert tone="danger" title="Cannot read the backup status">
            {toErrorMessage(status.error)}
          </Alert>
        </CardBody>
      </Card>
    );
  }

  const data = status.data;
  const health = HEALTH[data.health];
  const running = data.running || run.isPending;

  return (
    <Card>
      <CardHeader
        title="Backups"
        description="A copy of everything the shop has recorded."
        actions={
          <Badge tone={health.tone} dot>
            {health.label}
          </Badge>
        }
      />

      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-2.5 text-base">
          <Line
            icon={<DatabaseBackup className="size-4 text-neutral-400" aria-hidden />}
            label="Last backup"
            value={running ? "running now…" : age(data.lastBackupAt)}
            detail={
              running
                ? null
                : [size(data.lastBackupSize), data.backupCount ? `${data.backupCount} kept` : ""]
                    .filter(Boolean)
                    .join(" · ")
            }
          />

          {data.copies.length === 0 ? (
            <Line
              icon={<HardDrive className="size-4 text-neutral-400" aria-hidden />}
              label="Second copy"
              value="none"
              detail="every copy is on this computer"
            />
          ) : (
            data.copies.map((copy) => (
              <Line
                key={`${copy.kind}-${copy.target}`}
                icon={<HardDrive className="size-4 text-neutral-400" aria-hidden />}
                label={copy.kind === "OFFSITE" ? "Copy off the premises" : "Copy on a second disk"}
                value={copy.working ? age(copy.lastCopiedAt) : "not working"}
                detail={copy.target}
              />
            ))
          )}

          <Line
            icon={<ShieldCheck className="size-4 text-neutral-400" aria-hidden />}
            label="Last tested"
            value={
              data.restoreTestPassed === false
                ? "failed"
                : age(data.lastRestoreTestAt)
            }
            detail={
              data.restoreTestPassed === false
                ? "a backup could not be read back"
                : "restored into a spare copy to prove it works"
            }
          />
        </div>

        {data.problems.length > 0 && (
          <Alert tone={data.health === "CRITICAL" ? "danger" : "warning"}>
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {data.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
            <p className="mt-2 text-meta">
              Ask whoever set the system up to run <span className="num">check-backups</span> on
              the pharmacy&apos;s computer.
            </p>
          </Alert>
        )}

        {!data.scheduled && (
          <Alert tone="warning">
            This computer is not the pharmacy&apos;s server, so backups are not taken here.
          </Alert>
        )}
      </CardBody>

      <CardFooter>
        <Button
          variant="secondary"
          loading={running}
          disabled={running || !data.scheduled}
          onClick={() => run.mutate()}
          leadingIcon={<DatabaseBackup className="size-4" />}
        >
          {running ? "Backing up…" : "Back up now"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function Line({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-meta text-neutral-500">{label}</span>
          <span className="text-base text-neutral-900">{value}</span>
        </div>
        {detail && <p className="num truncate text-meta text-neutral-400">{detail}</p>}
      </div>
    </div>
  );
}
