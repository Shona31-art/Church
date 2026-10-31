import { CardStackSkeleton, HeaderSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Journal entries.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading your journal…" className="max-w-3xl">
      <HeaderSkeleton withAction />
      <CardStackSkeleton cards={3} />
    </SkeletonScreen>
  );
}
