import Page from "@/app/dashboard/pastoral-care/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/pastoral-care/new — see components/ui/RouteModal.tsx.
export default function Modal(props: React.ComponentProps<typeof Page>) {
  return (
    <RouteModal>
      <Page {...props} />
    </RouteModal>
  );
}
