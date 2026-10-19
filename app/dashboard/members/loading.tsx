import { HeaderSkeleton, ListSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Members list, and member pages opened directly (not as a popup).
export default function MembersLoading() {
  return (
    <SkeletonScreen label="Loading members…" className="max-w-5xl">
      <HeaderSkeleton withAction />
      <ListSkeleton rows={8} />
    </SkeletonScreen>
  );
}
