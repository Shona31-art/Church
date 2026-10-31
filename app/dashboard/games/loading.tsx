import { HeaderSkeleton, SkeletonScreen, TileGridSkeleton } from "@/components/ui/Skeleton";

// Games hub and each game.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading games…" className="max-w-5xl">
      <HeaderSkeleton />
      <TileGridSkeleton tiles={9} />
    </SkeletonScreen>
  );
}
