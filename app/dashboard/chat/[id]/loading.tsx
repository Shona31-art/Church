import { Bone, SkeletonScreen } from "@/components/ui/Skeleton";

// A conversation: title bar, alternating message bubbles, the message box.
const BUBBLES = ["w-2/3", "ml-auto w-1/2", "w-1/2", "ml-auto w-2/5", "w-3/5"];

export default function ChatThreadLoading() {
  return (
    <SkeletonScreen label="Loading messages…" className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Bone className="h-10 w-10 rounded-full" />
        <Bone className="h-6 w-48" />
      </div>
      <div className="card-elevated space-y-4 rounded-2xl p-4 sm:p-6">
        {BUBBLES.map((width, i) => (
          <Bone key={i} className={`h-12 rounded-2xl ${width}`} />
        ))}
        <Bone className="mt-6 h-12 w-full rounded-xl" />
      </div>
    </SkeletonScreen>
  );
}
