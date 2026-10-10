import Page from "@/app/dashboard/members/[id]/edit/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/members/[id]/edit — see components/ui/RouteModal.tsx.
export default function Modal(props: React.ComponentProps<typeof Page>) {
  return (
    <RouteModal>
      <Page {...props} />
    </RouteModal>
  );
}
