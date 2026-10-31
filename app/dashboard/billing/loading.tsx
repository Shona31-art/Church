import { Bone, HeaderSkeleton, SkeletonScreen, TileGridSkeleton } from "@/components/ui/Skeleton";

// Billing and plans.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading billing…" className="max-w-4xl space-y-4">
      <HeaderSkeleton />
      <Bone className="h-36 rounded-2xl" />
      <TileGridSkeleton tiles={2} className="h-72" />
    </SkeletonScreen>
  );
}
