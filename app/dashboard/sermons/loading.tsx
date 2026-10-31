import { CardStackSkeleton, HeaderSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Sermons list and sermon pages.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading sermons…" className="max-w-4xl">
      <HeaderSkeleton withAction />
      <CardStackSkeleton />
    </SkeletonScreen>
  );
}
