import { StatCardSkeleton } from "@/components/ui/StatCard";
import { SkeletonCard } from "@/components/ui/Skeleton";

/**
 * Shown while the route chunk loads. Data-level loading is handled by each
 * panel's own skeleton — this covers only the navigation transition.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5 p-6" role="status" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <StatCardSkeleton key={index} size="sm" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <SkeletonCard className="h-72 xl:col-span-2" />
        <SkeletonCard className="h-72" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-64" />
      </div>
    </div>
  );
}
