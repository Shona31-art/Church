import Page from "@/app/dashboard/posters/[id]/edit/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/posters/[id]/edit — see components/ui/RouteModal.tsx.
export default function Modal(props: React.ComponentProps<typeof Page>) {
  return (
    <RouteModal size="xl">
      <Page {...props} />
    </RouteModal>
  );
}
