import { HeaderSkeleton, ListSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Service plans.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading service plans…" className="max-w-4xl">
      <HeaderSkeleton withAction />
      <ListSkeleton rows={5} />
    </SkeletonScreen>
  );
}
