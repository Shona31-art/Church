import Page from "@/app/dashboard/announcements/[id]/edit/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/announcements/[id]/edit — see components/ui/RouteModal.tsx.
export default function Modal(props: React.ComponentProps<typeof Page>) {
  return (
    <RouteModal>
      <Page {...props} />
    </RouteModal>
  );
}
