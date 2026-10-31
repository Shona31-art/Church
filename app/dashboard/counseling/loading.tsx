import { CardStackSkeleton, HeaderSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Counseling conversations.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading…" className="max-w-3xl">
      <HeaderSkeleton />
      <CardStackSkeleton cards={3} />
    </SkeletonScreen>
  );
}
