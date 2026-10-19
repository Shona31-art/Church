import { Bone, SkeletonScreen } from "@/components/ui/Skeleton";

/**
 * Placeholder in the editor's shape (toolbar, side panels, canvas). Shown
 * while the page's data loads (app/dashboard/posters/editor/loading.tsx) and
 * then while the canvas code downloads (EditorLoader), so it reads as one wait.
 */
export function EditorSkeleton() {
  return (
    <SkeletonScreen label="Opening the editor…" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Bone className="h-9 w-48" />
        <div className="flex gap-2">
          <Bone className="h-10 w-24 rounded-xl" />
          <Bone className="h-10 w-28 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_16rem]">
        <Bone className="hidden h-[60vh] rounded-2xl lg:block" />
        <Bone className="mx-auto aspect-square w-full max-w-[min(100%,60vh)] rounded-2xl" />
        <Bone className="hidden h-[60vh] rounded-2xl lg:block" />
      </div>
    </SkeletonScreen>
  );
}
