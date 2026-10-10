import Page from "@/app/dashboard/setup/profile/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/setup/profile — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal size="md">
      <Page />
    </RouteModal>
  );
}
