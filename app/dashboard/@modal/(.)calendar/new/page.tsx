import Page from "@/app/dashboard/calendar/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/calendar/new — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal>
      <Page />
    </RouteModal>
  );
}
