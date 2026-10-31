import { aiAssistAvailable } from "@/lib/features";
import { moduleGate } from "@/lib/gate";
import { NewPrayerForm } from "./NewPrayerForm";

export default async function NewPrayerPage() {
  const gate = await moduleGate("prayer_board");
  if (gate) return gate;
  return <NewPrayerForm aiAvailable={await aiAssistAvailable()} />;
}
