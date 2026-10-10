import Page from "@/app/dashboard/chat/dm/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/chat/dm/new — see components/ui/RouteModal.tsx.
export default function Modal(props: React.ComponentProps<typeof Page>) {
  return (
    <RouteModal size="md">
      <Page {...props} />
    </RouteModal>
  );
}
