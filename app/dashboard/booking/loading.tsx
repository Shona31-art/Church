import { HeaderSkeleton, ListSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Pastor booking.
export default function Loading() {
  return (
    <SkeletonScreen label="Loading bookings…" className="max-w-4xl">
      <HeaderSkeleton withAction />
      <ListSkeleton rows={5} />
    </SkeletonScreen>
  );
}
