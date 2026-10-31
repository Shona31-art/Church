import { Bone, HeaderSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Month view (event pages show the same frame briefly).
export default function Loading() {
  return (
    <SkeletonScreen label="Loading the calendar…" className="max-w-5xl">
      <HeaderSkeleton withAction />
      <Bone className="h-[28rem] rounded-2xl" />
    </SkeletonScreen>
  );
}
