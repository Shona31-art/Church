import Page from "@/app/dashboard/pastoral-care/[id]/edit/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/pastoral-care/[id]/edit — see components/ui/RouteModal.tsx.
export default function Modal(props: React.ComponentProps<typeof Page>) {
  return (
    <RouteModal>
      <Page {...props} />
    </RouteModal>
  );
}
