import { Bone, HeaderSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Shown instantly while any dashboard page's server data loads (Next.js
// route convention) — a skeleton instead of a blank screen. Busier sections
// (members, chat, posters) have their own loading.tsx shaped like the page.
export default function DashboardLoading() {
  return (
    <SkeletonScreen className="max-w-3xl space-y-4">
      <HeaderSkeleton />
      <Bone className="h-28 rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Bone className="h-40 rounded-2xl" />
        <Bone className="h-40 rounded-2xl" />
      </div>
    </SkeletonScreen>
  );
}
