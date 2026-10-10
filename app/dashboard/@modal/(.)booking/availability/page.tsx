import Page from "@/app/dashboard/booking/availability/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/booking/availability — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal>
      <Page />
    </RouteModal>
  );
}
