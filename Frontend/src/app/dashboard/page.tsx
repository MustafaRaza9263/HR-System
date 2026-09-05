import { DashboardManager } from "@/components/dashboard/dashboard-manager";
import { getCurrentUser } from "@/lib/server-api";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  return <DashboardManager userName={user?.name ?? ""} />;
}
