import Page from "@/app/dashboard/account/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/account — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal size="md">
      <Page />
    </RouteModal>
  );
}
