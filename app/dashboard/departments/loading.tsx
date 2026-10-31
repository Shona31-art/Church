import { HeaderSkeleton, SkeletonScreen, TileGridSkeleton } from "@/components/ui/Skeleton";

// Departments.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading departments…" className="max-w-4xl">
      <HeaderSkeleton withAction />
      <TileGridSkeleton tiles={6} className="h-28" />
    </SkeletonScreen>
  );
}
