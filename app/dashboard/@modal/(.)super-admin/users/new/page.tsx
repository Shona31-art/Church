import Page from "@/app/dashboard/super-admin/users/new/page";
import { RouteModal } from "@/components/ui/RouteModal";

// Popup version of /dashboard/super-admin/users/new — see components/ui/RouteModal.tsx.
export default function Modal(props: React.ComponentProps<typeof Page>) {
  return (
    <RouteModal>
      <Page {...props} />
    </RouteModal>
  );
}
