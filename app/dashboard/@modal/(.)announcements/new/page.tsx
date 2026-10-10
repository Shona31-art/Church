import Page from "@/app/dashboard/announcements/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/announcements/new — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal>
      <Page />
    </RouteModal>
  );
}
