import Page from "@/app/dashboard/super-admin/churches/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/super-admin/churches/new — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal size="xl">
      <Page />
    </RouteModal>
  );
}
