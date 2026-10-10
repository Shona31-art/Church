import Page from "@/app/dashboard/games/questions/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/games/questions/new — see components/ui/RouteModal.tsx.
export default function Modal() {
  return (
    <RouteModal size="md">
      <Page />
    </RouteModal>
  );
}
