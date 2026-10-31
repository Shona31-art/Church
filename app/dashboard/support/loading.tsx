import { HeaderSkeleton, ListSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Support tickets.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading support…" className="max-w-4xl">
      <HeaderSkeleton withAction />
      <ListSkeleton rows={5} />
    </SkeletonScreen>
  );
}
