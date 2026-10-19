import Page from "@/app/dashboard/setup/giving/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/setup/giving — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal size="md">
      <Page />
    </RouteModal>
  );
}
