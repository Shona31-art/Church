import Page from "@/app/dashboard/booking/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/booking/new — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal size="md">
      <Page />
    </RouteModal>
  );
}
