import { EditorSkeleton } from "@/components/posters/editor/EditorSkeleton";

// Overrides the poster-list skeleton (../loading.tsx), which looked wrong here.
export default function PosterEditorLoading() {
  return <EditorSkeleton />;
}
