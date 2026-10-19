import { HeaderSkeleton, ListSkeleton, SkeletonScreen } from "@/components/ui/Skeleton";

// Chat list. Threads have their own skeleton in [id]/loading.tsx.
export default function ChatLoading() {
  return (
    <SkeletonScreen label="Loading chats…" className="max-w-2xl">
      <HeaderSkeleton withAction />
      <ListSkeleton rows={6} />
    </SkeletonScreen>
  );
}
