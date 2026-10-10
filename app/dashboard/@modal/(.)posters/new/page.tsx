import Page from "@/app/dashboard/posters/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/posters/new — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal size="xl">
      <Page />
    </RouteModal>
  );
}
