import { HeaderSkeleton, ListSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Care log.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading pastoral care…" className="max-w-5xl">
      <HeaderSkeleton withAction />
      <ListSkeleton rows={6} />
    </SkeletonScreen>
  );
}
