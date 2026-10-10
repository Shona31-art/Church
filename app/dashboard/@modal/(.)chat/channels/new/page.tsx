import Page from "@/app/dashboard/chat/channels/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/chat/channels/new — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal>
      <Page />
    </RouteModal>
  );
}
