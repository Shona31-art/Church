import { HeaderSkeleton, ListSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Notifications list.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading notifications…" className="max-w-3xl">
      <HeaderSkeleton />
      <ListSkeleton rows={8} />
    </SkeletonScreen>
  );
}
