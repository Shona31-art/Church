import { Bone, HeaderSkeleton, ListSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Giving, and the giving report.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading giving…" className="max-w-3xl space-y-4">
      <HeaderSkeleton />
      <Bone className="h-48 rounded-2xl" />
      <ListSkeleton rows={4} />
    </SkeletonScreen>
  );
}
