import Page from "@/app/dashboard/sermons/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/sermons/new — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal>
      <Page />
    </RouteModal>
  );
}
