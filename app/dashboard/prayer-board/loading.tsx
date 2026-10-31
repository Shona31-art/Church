import { CardStackSkeleton, HeaderSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Prayer board and wall.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading prayers…" className="max-w-3xl">
      <HeaderSkeleton withAction />
      <CardStackSkeleton />
    </SkeletonScreen>
  );
}
