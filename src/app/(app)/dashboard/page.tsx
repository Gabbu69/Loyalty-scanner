import { DashboardOverview } from "@/components/loyalty/dashboard-overview";
import { requireOwner } from "@/lib/auth/server";

export default async function DashboardPage() {
  await requireOwner("/dashboard");
  return <DashboardOverview />;
}
