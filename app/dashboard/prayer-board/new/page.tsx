import { aiAssistAvailable } from "@/lib/features";
import { NewPrayerForm } from "./NewPrayerForm";

export default async function NewPrayerPage() {
  return <NewPrayerForm aiAvailable={await aiAssistAvailable()} />;
}
