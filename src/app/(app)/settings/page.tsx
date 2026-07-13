import { ProgramSettings } from "@/components/loyalty/program-settings";
import { requireOwner } from "@/lib/auth/server";

export default async function SettingsPage() {
  await requireOwner("/settings");
  return <ProgramSettings />;
}
