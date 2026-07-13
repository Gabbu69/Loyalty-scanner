import { StaffManagement } from "@/components/loyalty/staff-management";
import { requireOwner } from "@/lib/auth/server";

export default async function StaffPage() {
  await requireOwner("/staff");
  return <StaffManagement />;
}
