import { Hammer } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";

/**
 * Temporary stand-in for a route whose feature lands in a later phase.
 *
 * Routes exist from phase one so navigation, permissions and the shell can be
 * exercised end-to-end before every screen is built. Each of these is replaced
 * by its real feature module; none should survive to production.
 */
export function PhasePlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: number;
}) {
  return (
    <PageContainer>
      <PageHeader title={title} titleHidden description={description} />
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white">
        <EmptyState
          icon={<Hammer className="size-5" />}
          title={`${title} arrives in phase ${phase}`}
          description="The route, navigation entry and permission checks are already wired up. The screen itself is built in a later phase."
        />
      </div>
    </PageContainer>
  );
}
