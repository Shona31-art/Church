import Page from "@/app/dashboard/journal/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/journal/new — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal>
      <Page />
    </RouteModal>
  );
}
