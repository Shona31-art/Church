import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  Church,
  CreditCard,
  FolderKanban,
  Gamepad2,
  Gift,
  HandHeart,
  HeartHandshake,
  House,
  Image,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessagesSquare,
  Mic,
  NotebookPen,
  Settings,
  Sparkles,
  UserRound,
  Users,
  BookUser,
  type LucideIcon,
} from "lucide-react";

// The menu is built on the server (lib/navigation.ts) and handed to a client
// component, which can't receive icon components as props — so menu items
// name their icon with one of these keys instead.
export const NAV_ICONS = {
  home: House,
  members: Users,
  departments: FolderKanban,
  announcements: Megaphone,
  calendar: CalendarDays,
  servicePlanner: CalendarRange,
  sermons: Mic,
  booking: BookUser,
  pastoralCare: HeartHandshake,
  counseling: Sparkles,
  prayer: HandHeart,
  chat: MessagesSquare,
  bible: BookOpen,
  journal: NotebookPen,
  games: Gamepad2,
  posters: Image,
  giving: Gift,
  report: ChartColumn,
  billing: CreditCard,
  settings: Settings,
  support: LifeBuoy,
  overview: LayoutDashboard,
  churches: Church,
  user: UserRound,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof NAV_ICONS;

export function NavIcon({ name, className = "h-[18px] w-[18px]" }: { name: NavIconName; className?: string }) {
  const Icon = NAV_ICONS[name];
  return <Icon aria-hidden className={className} strokeWidth={1.75} />;
}
