import { Bone, HeaderSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Poster list (grid of square thumbnails) and poster pages opened directly.
export default function PostersLoading() {
  return (
    <SkeletonScreen label="Loading posters…" className="max-w-5xl">
      <HeaderSkeleton withAction />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="card-elevated space-y-3 rounded-2xl p-3">
            <Bone className="aspect-square w-full rounded-xl" />
            <Bone className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
