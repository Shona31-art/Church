import { Bone, HeaderSkeleton, SkeletonScreen, TileGridSkeleton } from "@/components/ui/Skeleton";

// Bible home, reader and search.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading the Bible…" className="max-w-4xl space-y-4">
      <HeaderSkeleton />
      <Bone className="h-36 rounded-2xl" />
      <TileGridSkeleton tiles={6} className="h-16" />
    </SkeletonScreen>
  );
}
