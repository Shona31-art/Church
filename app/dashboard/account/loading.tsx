import { DetailSkeleton, HeaderSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// My account.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading your account…" className="max-w-3xl">
      <HeaderSkeleton />
      <DetailSkeleton />
    </SkeletonScreen>
  );
}
