import Page from "@/app/dashboard/service-planner/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/service-planner/new — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal size="xl">
      <Page />
    </RouteModal>
  );
}
