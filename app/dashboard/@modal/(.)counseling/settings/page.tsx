import Page from "@/app/dashboard/counseling/settings/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/counseling/settings — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal>
      <Page />
    </RouteModal>
  );
}
