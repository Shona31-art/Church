import Page from "@/app/dashboard/support/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/support/new — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal size="md">
      <Page />
    </RouteModal>
  );
}
