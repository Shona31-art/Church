import Page from "@/app/dashboard/members/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/members/new — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal>
      <Page />
    </RouteModal>
  );
}
