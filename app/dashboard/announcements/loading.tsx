import { CardStackSkeleton, HeaderSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Announcements list, and announcements opened directly.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading announcements…" className="max-w-3xl">
      <HeaderSkeleton withAction />
      <CardStackSkeleton />
    </SkeletonScreen>
  );
}
