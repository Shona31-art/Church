import Page from "@/app/dashboard/prayer-board/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/prayer-board/new — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal size="md">
      <Page />
    </RouteModal>
  );
}
