import Page from "@/app/dashboard/departments/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/departments/new — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal size="md">
      <Page />
    </RouteModal>
  );
}
